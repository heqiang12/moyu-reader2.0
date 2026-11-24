use crate::db::Database;
use crate::engine::RuleEngine;
use crate::network::NetworkClient;
use crate::types::{BookChapter, BookSource, ExploreKind, RuleSearch, SearchBook};
use scraper::{Html, Selector};

#[derive(Clone)]
pub struct Crawler {
    client: NetworkClient,
    db: Database,
}

fn parse_books_from_html(html: &str, rule_search: &RuleSearch, source: &BookSource) -> Vec<SearchBook> {
    let book_list_rule = match rule_search.book_list.as_deref() {
        Some(r) => r,
        None => return Vec::new(),
    };

    let (selector_str, _) = RuleEngine::parse_css_rule(book_list_rule);
    let doc = Html::parse_document(html);
    let selector = match Selector::parse(&selector_str) {
        Ok(s) => s,
        Err(_) => return Vec::new(),
    };

    let mut books = Vec::new();

    for item in doc.select(&selector) {
        let item_html = item.html();

        let name = rule_search
            .name
            .as_deref()
            .and_then(|r| RuleEngine::extract_single(&item_html, r, None))
            .unwrap_or_default();

        if name.is_empty() {
            continue;
        }

        let author = rule_search
            .author
            .as_deref()
            .and_then(|r| RuleEngine::extract_single(&item_html, r, None))
            .unwrap_or_default();

        let book_url = rule_search
            .book_url
            .as_deref()
            .and_then(|r| RuleEngine::extract_single(&item_html, r, Some(&source.book_source_url)))
            .unwrap_or_default();

        if book_url.is_empty() {
            continue;
        }

        let cover_url = rule_search
            .cover_url
            .as_deref()
            .and_then(|r| RuleEngine::extract_single(&item_html, r, Some(&source.book_source_url)));

        let intro = rule_search
            .intro
            .as_deref()
            .and_then(|r| RuleEngine::extract_single(&item_html, r, None));

        let latest_chapter = rule_search
            .last_chapter
            .as_deref()
            .and_then(|r| RuleEngine::extract_single(&item_html, r, None));

        let word_count = rule_search
            .word_count
            .as_deref()
            .and_then(|r| RuleEngine::extract_single(&item_html, r, None));

        let kind = rule_search
            .kind
            .as_deref()
            .and_then(|r| RuleEngine::extract_single(&item_html, r, None));

        books.push(SearchBook {
            book_url,
            name,
            author,
            origin: source.book_source_url.clone(),
            origin_name: Some(source.book_source_name.clone()),
            cover_url,
            toc_url: None,
            latest_chapter_title: latest_chapter,
            intro,
            word_count,
            kind,
            sources: None,
        });
    }

    books
}

impl Crawler {
    pub fn new(client: NetworkClient, db: Database) -> Self {
        Self { client, db }
    }

    /// 针对单个书源执行搜索
    pub async fn search_single_source(
        &self,
        source: &BookSource,
        keyword: &str,
    ) -> Result<Vec<SearchBook>, String> {
        let raw_search_url = source
            .search_url
            .as_deref()
            .ok_or_else(|| "书源缺少 searchUrl".to_string())?;

        let rule_search = source
            .get_rule_search()
            .ok_or_else(|| "书源缺少 ruleSearch/searchRule 规则".to_string())?;

        // 构造搜索 URL
        let encoded_key = urlencoding::encode(keyword);
        let target_url = crate::engine::resolve_url(
            Some(&source.book_source_url), &raw_search_url.replace("{{key}}", &encoded_key)
        );

        // 发起网络请求获取搜索结果 HTML
        let html = self
            .client
            .get_html(&target_url, None)
            .await
            .map_err(|e| format!("搜索请求失败: {}", e))?;

        Ok(parse_books_from_html(&html, rule_search, source))
    }

    /// 解析书源的分类/发现入口列表
    pub fn get_source_explore_kinds(&self, source_url: &str) -> Result<Vec<ExploreKind>, String> {
        let source = self
            .db
            .get_book_source(source_url)
            .map_err(|e| e.to_string())?
            .ok_or_else(|| format!("未找到书源: {}", source_url))?;

        let raw_explore = match source.explore_url.as_deref() {
            Some(s) if !s.trim().is_empty() => s.trim(),
            _ => return Ok(Vec::new()),
        };

        let mut kinds = Vec::new();

        // 格式 1：JSON 数组
        if raw_explore.starts_with('[') {
            if let Ok(val) = serde_json::from_str::<serde_json::Value>(raw_explore) {
                if let Some(arr) = val.as_array() {
                    for item in arr {
                        let title = item.get("title").and_then(|v| v.as_str()).unwrap_or("").trim();
                        let url = item.get("url").and_then(|v| v.as_str()).unwrap_or("").trim();
                        if !title.is_empty() && !url.is_empty() {
                            let resolved_url = crate::engine::resolve_url(Some(&source.book_source_url), url);
                            kinds.push(ExploreKind {
                                title: title.to_string(),
                                url: resolved_url,
                            });
                        }
                    }
                }
            }
        } else {
            // 格式 2：按行分割格式 (武侠::url 或 武侠&&url)
            for line in raw_explore.lines() {
                let trimmed = line.trim();
                if trimmed.is_empty() || trimmed.starts_with('#') {
                    continue;
                }
                let parts: Vec<&str> = if trimmed.contains("::") {
                    trimmed.split("::").collect()
                } else if trimmed.contains("&&") {
                    trimmed.split("&&").collect()
                } else {
                    Vec::new()
                };

                if parts.len() >= 2 {
                    let title = parts[0].trim();
                    let url = parts[1].trim();
                    if !title.is_empty() && !url.is_empty() {
                        let resolved_url = crate::engine::resolve_url(Some(&source.book_source_url), url);
                        kinds.push(ExploreKind {
                            title: title.to_string(),
                            url: resolved_url,
                        });
                    }
                }
            }
        }

        Ok(kinds)
    }

    /// 根据书源与分类 URL 抓取该分类的书籍列表
    pub async fn explore_source_kind(
        &self,
        source_url: &str,
        kind_url: &str,
        page: i32,
    ) -> Result<Vec<SearchBook>, String> {
        let source = self
            .db
            .get_book_source(source_url)
            .map_err(|e| e.to_string())?
            .ok_or_else(|| format!("未找到书源: {}", source_url))?;

        let rule_explore = source
            .get_rule_explore()
            .ok_or_else(|| "书源缺少 ruleExplore/ruleSearch 规则".to_string())?;

        // 处理分页宏: {{page}} 或 <,_{{page}}>
        let mut target_url = kind_url.to_string();
        let page_str = page.to_string();
        if target_url.contains("<,") && target_url.contains('>') {
            let re_pattern = if page <= 1 { "" } else { &format!("_{}", page) };
            if let Some(start) = target_url.find("<,") {
                if let Some(end) = target_url.find('>') {
                    let before = &target_url[..start];
                    let after = &target_url[end + 1..];
                    target_url = format!("{}{}{}", before, re_pattern, after);
                }
            }
        }
        target_url = target_url.replace("{{page}}", &page_str);
        target_url = target_url.replace("{page}", &page_str);

        let final_url = crate::engine::resolve_url(Some(&source.book_source_url), &target_url);

        let html = self
            .client
            .get_html(&final_url, None)
            .await
            .map_err(|e| format!("请求分类书籍失败: {}", e))?;

        let books = parse_books_from_html(&html, rule_explore, &source);
        Ok(books)
    }

    /// 获取书籍的完整章节目录
    pub async fn get_chapter_list(
        &self,
        book_url: &str,
        book_source_url: Option<&str>,
    ) -> Result<Vec<BookChapter>, String> {
        // 先检查本地缓存
        if let Ok(Some(cached)) = self.db.get_cached_chapter_list(book_url) {
            if !cached.is_empty() {
                return Ok(cached);
            }
        }

        // 查找对应书源规则
        let source_url = match book_source_url {
            Some(url) => url.to_string(),
            None => {
                let book = self
                    .db
                    .get_book(book_url)
                    .map_err(|e| e.to_string())?
                    .ok_or_else(|| "未找到该书籍记录且未指定书源".to_string())?;
                book.origin
            }
        };

        let source = self
            .db
            .get_book_source(&source_url)
            .map_err(|e| e.to_string())?
            .ok_or_else(|| format!("未找到对应书源: {}", source_url))?;

        let rule_toc = source
            .get_rule_toc()
            .ok_or_else(|| "书源缺少 ruleToc/tocRule 目录规则".to_string())?;

        let chapter_list_rule = rule_toc
            .chapter_list
            .as_deref()
            .ok_or_else(|| "缺少 chapterList 规则".to_string())?;

        let chapter_name_rule = rule_toc
            .chapter_name
            .as_deref()
            .unwrap_or("text");

        let chapter_url_rule = rule_toc
            .chapter_url
            .as_deref()
            .unwrap_or("href");

        // 请求书籍主页或目录页
        let html = self
            .client
            .get_html(book_url, None)
            .await
            .map_err(|e| format!("请求书籍目录失败: {}", e))?;

        let (selector_str, _) = RuleEngine::parse_css_rule(chapter_list_rule);
        let doc = Html::parse_document(&html);
        let selector = match Selector::parse(&selector_str) {
            Ok(s) => s,
            Err(_) => return Ok(Vec::new()),
        };

        let mut chapters = Vec::new();
        let mut index = 0;

        for item in doc.select(&selector) {
            let item_html = item.html();

            let title = RuleEngine::extract_single(&item_html, chapter_name_rule, None)
                .unwrap_or_default();

            let url = RuleEngine::extract_single(&item_html, chapter_url_rule, Some(book_url))
                .unwrap_or_default();

            if !title.is_empty() && !url.is_empty() {
                chapters.push(BookChapter {
                    url,
                    title,
                    index,
                    book_url: book_url.to_string(),
                    is_volume: Some(false),
                    base_url: Some(book_url.to_string()),
                });
                index += 1;
            }
        }

        // 保存到数据库本地缓存
        let _ = self.db.save_chapter_list(book_url, &chapters);

        Ok(chapters)
    }

    /// 获取特定章节的正文内容
    pub async fn get_chapter_content(
        &self,
        book_url: &str,
        chapter_url: &str,
        chapter_index: i32,
        book_source_url: Option<&str>,
    ) -> Result<String, String> {
        // 先检查本地缓存
        if let Ok(Some(cached_content)) = self.db.get_cached_chapter_content(book_url, chapter_index) {
            if !cached_content.is_empty() {
                return Ok(cached_content);
            }
        }

        let source_url = match book_source_url {
            Some(url) => url.to_string(),
            None => {
                let book = self
                    .db
                    .get_book(book_url)
                    .map_err(|e| e.to_string())?
                    .ok_or_else(|| "未找到该书籍记录".to_string())?;
                book.origin
            }
        };

        let source = self
            .db
            .get_book_source(&source_url)
            .map_err(|e| e.to_string())?
            .ok_or_else(|| format!("未找到对应书源: {}", source_url))?;

        let rule_content = source
            .get_rule_content()
            .ok_or_else(|| "书源缺少 ruleContent/contentRule 规则".to_string())?;

        let content_rule = rule_content
            .content
            .as_deref()
            .ok_or_else(|| "缺少正文提取规则".to_string())?;

        let html = self
            .client
            .get_html(chapter_url, None)
            .await
            .map_err(|e| format!("正文请求失败: {}", e))?;

        let content = RuleEngine::extract_content(
            &html,
            content_rule,
            rule_content.replace_regex.as_deref(),
        );

        // 存入本地缓存
        let _ = self.db.save_chapter_content(
            book_url,
            chapter_index,
            chapter_url,
            "",
            &content,
        );

        Ok(content)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    use tokio::net::TcpListener;

    // 只使用回环HTTP及内嵌HTML，验证真实搜索调用构造的请求，不访问外部书源。
    async fn assert_search_request(template: &str, expected_path: &str) {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let origin = format!("http://{}", listener.local_addr().unwrap());
        let template = template.replace("{origin}", &origin);
        let response = tokio::spawn(async move {
            let (mut socket, _) = listener.accept().await.unwrap();
            let mut request = Vec::new();
            let mut buffer = [0; 1024];
            while !request.windows(4).any(|part| part == b"\r\n\r\n") {
                let length = socket.read(&mut buffer).await.unwrap();
                assert!(length > 0);
                request.extend_from_slice(&buffer[..length]);
            }
            let html = "<div class='book'><a href='/book/1'>测试书籍</a></div>";
            let http = format!(
                "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                html.len(), html
            );
            socket.write_all(http.as_bytes()).await.unwrap();
            String::from_utf8(request).unwrap().lines().next().unwrap().to_string()
        });
        let source = BookSource {
            book_source_name: "回环测试源".to_string(),
            book_source_url: format!("{origin}/books/"),
            search_url: Some(template.clone()),
            rule_search: Some(RuleSearch {
                book_list: Some(".book".to_string()),
                name: Some("a@text".to_string()),
                book_url: Some("a@href".to_string()),
                ..Default::default()
            }),
            ..Default::default()
        };
        let crawler = Crawler::new(NetworkClient::new().unwrap(), Database::new_in_memory().unwrap());
        let books = tokio::time::timeout(
            std::time::Duration::from_secs(5), crawler.search_single_source(&source, "三体")
        ).await.unwrap().unwrap();
        assert_eq!(response.await.unwrap(), format!("GET {expected_path} HTTP/1.1"));
        assert_eq!(books.len(), 1);
        assert_eq!(books[0].name, "测试书籍");
        assert_eq!(books[0].book_url, format!("{origin}/book/1"));
        assert_eq!(source.search_url.as_deref(), Some(template.as_str()));
    }

    #[tokio::test]
    async fn test_root_relative_search_url_uses_source_origin() {
        assert_search_request("/?s={{key}}", "/?s=%E4%B8%89%E4%BD%93").await;
    }

    #[tokio::test]
    async fn test_search_url_relative_and_absolute_controls() {
        for (template, path) in [
            ("search?s={{key}}", "/books/search?s=%E4%B8%89%E4%BD%93"),
            ("?s={{key}}", "/books/?s=%E4%B8%89%E4%BD%93"),
            ("{origin}/search?s={{key}}", "/search?s=%E4%B8%89%E4%BD%93"),
        ] {
            assert_search_request(template, path).await;
        }
    }
}
