use moyu_reader_lib::db::Database;
use moyu_reader_lib::engine::RuleEngine;
use moyu_reader_lib::network::NetworkClient;
use moyu_reader_lib::types::{BookChapter, BookSource, RuleContent, RuleSearch, RuleToc, SearchBook};

#[test]
fn test_full_pipeline_mock() {
    // 1. 初始化内存数据库
    let db = Database::new_in_memory().expect("初始化内存数据库失败");

    // 2. 构造 Legado 3.0 格式书源并入库
    let sample_source = BookSource {
        book_source_name: "笔趣阁模拟源".to_string(),
        book_source_url: "https://mock.biquge.tv".to_string(),
        book_source_group: Some("精选".to_string()),
        book_source_type: Some(0),
        enabled: true,
        enabled_explore: true,
        explore_url: None,
        search_url: Some("https://mock.biquge.tv/search?key={{key}}".to_string()),
        custom_order: Some(1),
        weight: Some(10),
        last_update_time: Some(1700000000),
        book_source_comment: Some("用于测试的高性能书源".to_string()),
        header: None,
        rule_search: Some(RuleSearch {
            book_list: Some(".book-item".to_string()),
            name: Some("h4.title@text".to_string()),
            author: Some("span.author@text".to_string()),
            book_url: Some("a@href".to_string()),
            intro: Some(".desc@text".to_string()),
            kind: Some(".tag@text".to_string()),
            cover_url: Some("img@src".to_string()),
            last_chapter: Some(".latest@text".to_string()),
            word_count: None,
        }),
        rule_book_info: None,
        rule_toc: Some(RuleToc {
            chapter_list: Some("#chapterList li a".to_string()),
            chapter_name: Some("text".to_string()),
            chapter_url: Some("href".to_string()),
            next_toc_url: None,
        }),
        rule_content: Some(RuleContent {
            content: Some("#content".to_string()),
            next_content_url: None,
            replace_regex: Some("##笔趣阁.*最新章节##".to_string()),
            title: Some("h1@text".to_string()),
        }),
        ..Default::default()
    };

    db.save_book_source(&sample_source).expect("保存书源失败");

    let sources = db.get_book_sources().expect("获取书源失败");
    assert_eq!(sources.len(), 1);
    assert_eq!(sources[0].book_source_name, "笔趣阁模拟源");

    // 3. 模拟搜索结果解析
    let mock_search_html = r#"
        <div class="search-results">
            <div class="book-item">
                <a href="/book/1001"><h4 class="title">大奉打更人</h4></a>
                <span class="author">卖报小郎君</span>
                <span class="tag">仙侠</span>
                <p class="desc">这个世界，有儒；有道；有佛；有妖；有术士。</p>
                <span class="latest">第100章 勾栏听曲</span>
            </div>
        </div>
    "#;

    let names = RuleEngine::extract_list(mock_search_html, ".book-item h4.title@text", None);
    assert_eq!(names.len(), 1);
    assert_eq!(names[0], "大奉打更人");

    // 4. 保存到书架
    let book = SearchBook {
        book_url: "https://mock.biquge.tv/book/1001".to_string(),
        name: "大奉打更人".to_string(),
        author: "卖报小郎君".to_string(),
        origin: "https://mock.biquge.tv".to_string(),
        origin_name: Some("笔趣阁模拟源".to_string()),
        cover_url: None,
        toc_url: None,
        latest_chapter_title: Some("第100章 勾栏听曲".to_string()),
        intro: Some("这个世界，有儒；有道；有佛...".to_string()),
        word_count: Some("380万字".to_string()),
        kind: Some("仙侠".to_string()),
        sources: None,
    };

    let saved_book = db.save_book(&book).expect("加入书架失败");
    assert_eq!(saved_book.name, "大奉打更人");

    // 5. 模拟目录解析与缓存
    let mock_toc_html = r#"
        <ul id="chapterList">
            <li><a href="/book/1001/ch1.html">第一章 牢狱之灾</a></li>
            <li><a href="/book/1001/ch2.html">第二章 绝境逢生</a></li>
            <li><a href="/book/1001/ch3.html">第三章 炼金术的奥秘</a></li>
        </ul>
    "#;

    let chapters_titles = RuleEngine::extract_list(mock_toc_html, "#chapterList li a@text", None);
    let chapters_urls = RuleEngine::extract_list(mock_toc_html, "#chapterList li a@href", Some("https://mock.biquge.tv/book/1001/"));

    assert_eq!(chapters_titles.len(), 3);
    assert_eq!(chapters_urls[0], "https://mock.biquge.tv/book/1001/ch1.html");

    let chapters = vec![
        BookChapter {
            url: chapters_urls[0].clone(),
            title: chapters_titles[0].clone(),
            index: 0,
            book_url: book.book_url.clone(),
            is_volume: Some(false),
            base_url: Some(book.book_url.clone()),
        },
        BookChapter {
            url: chapters_urls[1].clone(),
            title: chapters_titles[1].clone(),
            index: 1,
            book_url: book.book_url.clone(),
            is_volume: Some(false),
            base_url: Some(book.book_url.clone()),
        },
    ];

    db.save_chapter_list(&book.book_url, &chapters).expect("保存章节目录失败");

    let cached_chapters = db.get_cached_chapter_list(&book.book_url).expect("获取章节失败").unwrap();
    assert_eq!(cached_chapters.len(), 2);
    assert_eq!(cached_chapters[1].title, "第二章 绝境逢生");

    // 6. 模拟正文解析与正文清洗
    let mock_content_html = r#"
        <div id="content">
            许七安悠悠醒来，发现自己身处大牢。<br/>
            阴暗潮湿的气味扑面而来。<br><br>
            笔趣阁免费提供最新章节<br/>
            他摸了摸怀里的铜钱。
        </div>
    "#;

    let cleaned_content = RuleEngine::extract_content(
        mock_content_html,
        "#content",
        Some("##笔趣阁.*最新章节##"),
    );

    assert!(cleaned_content.contains("许七安悠悠醒来，发现自己身处大牢。"));
    assert!(cleaned_content.contains("他摸了摸怀里的铜钱。"));
    assert!(!cleaned_content.contains("笔趣阁免费提供最新章节"));

    // 7. 测试阅读进度更新
    db.save_book_progress(&book.book_url, 1, Some("第二章 绝境逢生")).expect("保存进度失败");
    let shelf = db.get_bookshelf().expect("获取书架失败");
    assert_eq!(shelf[0].dur_chapter_index, 1);
    assert_eq!(shelf[0].dur_chapter_title.as_deref(), Some("第二章 绝境逢生"));
    assert_eq!(shelf[0].total_chapter_num, cached_chapters.len() as i32);
}

#[tokio::test]
async fn test_fetch_1335_json() {
    let network = NetworkClient::new().unwrap();
    let res = network.get_html("https://www.yckceo.com/yuedu/shuyuans/json/id/1335.json", None).await;
    match res {
        Ok(html) => {
            let trimmed = html.trim().trim_start_matches('\u{feff}');
            let sources: Result<Vec<BookSource>, _> = serde_json::from_str(trimmed);
            match sources {
                Ok(s) => println!(">>> 成功解析书源数量: {}", s.len()),
                Err(e) => println!(">>> 反序列化失败: {}", e),
            }
        }
        Err(e) => {
            println!(">>> 网络请求失败: {:?}", e);
        }
    }
}

#[test]
fn test_real_world_sources_parsing() {
    let source_file = r"D:\mywork\moyu-yuedu\storage\data\default\bookSource.json";
    if std::path::Path::new(source_file).exists() {
        let content = std::fs::read_to_string(source_file).expect("读取书源文件失败");
        let sources: Vec<BookSource> = serde_json::from_str(&content).expect("反序列化 232 个真实书源失败");
        assert!(sources.len() >= 200, "真实书源数量应在 200 以上");
        println!("成功解析 {} 个真实网络书源！", sources.len());

        let db = Database::new_in_memory().unwrap();
        for s in &sources {
            db.save_book_source(s).unwrap();
        }
        let saved = db.get_book_sources().unwrap();
        assert_eq!(saved.len(), sources.len());

        let crawler = moyu_reader_lib::crawler::Crawler::new(
            moyu_reader_lib::network::NetworkClient::new().unwrap(),
            db.clone(),
        );

        // 验证分类解析
        if let Some(s) = sources.iter().find(|s| s.explore_url.as_deref().map(|u| u.starts_with('[')).unwrap_or(false)) {
            let kinds = crawler.get_source_explore_kinds(&s.book_source_url).unwrap();
            assert!(!kinds.is_empty(), "分类提取应非空");
            println!("测试书源 [{}] 成功提取分类 {} 个，例如: {}", s.book_source_name, kinds.len(), kinds[0].title);
        }
    }
}
