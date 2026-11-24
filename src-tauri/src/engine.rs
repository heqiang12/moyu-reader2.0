use scraper::{Html, Selector};
use serde_json::Value;
use regex::Regex;
use url::Url;

/// 规则提取类型
#[derive(Debug, Clone)]
pub enum RuleType {
    Css {
        selector: String,
        attr: Option<String>,
    },
    JsonPath(String),
    Regex(String),
    Text,
}

pub struct RuleEngine;

impl RuleEngine {
    /// 解析 Legado CSS 规则并提取内容
    /// 例如:
    /// "class.title@text" -> 查找 class 包含 title 的元素，提取文本
    /// "tag.a@href" -> 查找 a 标签，提取 href 属性
    /// "#content@html" -> 查找 id 为 content 的元素，提取 innerHTML
    /// "tag.p@textNodes" -> 提取段落文本
    pub fn parse_css_rule(rule_str: &str) -> (String, Option<String>) {
        let parts: Vec<&str> = rule_str.split('@').collect();
        let raw_sel = parts[0].trim();
        let attr = if parts.len() > 1 {
            Some(parts[1].trim().to_string())
        } else {
            None
        };

        // 转换 Legado 简写格式: class.name -> .name, tag.name -> name, id.name -> #name
        let mut selector = String::new();
        let tokens: Vec<&str> = raw_sel.split_whitespace().collect();
        for (i, token) in tokens.iter().enumerate() {
            if i > 0 {
                selector.push(' ');
            }
            if let Some(rest) = token.strip_prefix("class.") {
                selector.push('.');
                selector.push_str(rest);
            } else if let Some(rest) = token.strip_prefix("id.") {
                selector.push('#');
                selector.push_str(rest);
            } else if let Some(rest) = token.strip_prefix("tag.") {
                selector.push_str(rest);
            } else {
                selector.push_str(token);
            }
        }

        (selector, attr)
    }

    /// 在 HTML 字符串中提取单个字符串
    pub fn extract_single(html_str: &str, rule_str: &str, base_url: Option<&str>) -> Option<String> {
        let results = Self::extract_list(html_str, rule_str, base_url);
        results.into_iter().next()
    }

    /// 在 HTML 字符串中根据规则提取一组字符串
    pub fn extract_list(html_str: &str, rule_str: &str, base_url: Option<&str>) -> Vec<String> {
        let rule_str = rule_str.trim();
        if rule_str.is_empty() {
            return Vec::new();
        }

        // 分离基础选择器与正则替换后缀: "h3@a@text##.*\\]" -> base: "h3@a@text", regex: "##.*\\]"
        let (base_rule, regex_rule) = if let Some(idx) = rule_str.find("##") {
            (rule_str[..idx].trim(), Some(&rule_str[idx..]))
        } else {
            (rule_str, None)
        };

        // 处理 JSONPath 提取
        if base_rule.starts_with('$') {
            let mut list = Self::extract_jsonpath(html_str, base_rule);
            if let Some(reg) = regex_rule {
                list = list.into_iter().map(|item| apply_replace_regex(&item, reg)).collect();
            }
            return list;
        }

        // 处理 CSS 选择器规则
        let (selector_str, attr) = Self::parse_css_rule(base_rule);
        let document = Html::parse_document(html_str);
        let selector = match Selector::parse(&selector_str) {
            Ok(s) => s,
            Err(_) => return Vec::new(),
        };

        let mut results = Vec::new();
        for element in document.select(&selector) {
            let mut extracted = match attr.as_deref() {
                Some("text") | Some("textNodes") | None => {
                    let text = element.text().collect::<Vec<_>>().join(" ");
                    text.trim().to_string()
                }
                Some("html") => element.inner_html().trim().to_string(),
                Some("href") => {
                    let raw = element.value().attr("href").unwrap_or_default().trim();
                    resolve_url(base_url, raw)
                }
                Some("src") => {
                    let raw = element.value().attr("src").unwrap_or_default().trim();
                    resolve_url(base_url, raw)
                }
                Some(other_attr) => {
                    element.value().attr(other_attr).unwrap_or_default().trim().to_string()
                }
            };

            if let Some(reg) = regex_rule {
                extracted = apply_replace_regex(&extracted, reg);
            }

            if !extracted.is_empty() {
                results.push(extracted);
            }
        }

        results
    }

    /// 提取正文内容并进行清洗（换行排版、去除多余标签）
    pub fn extract_content(html_str: &str, content_rule: &str, replace_regex: Option<&str>) -> String {
        let (selector_str, _) = Self::parse_css_rule(content_rule);
        let document = Html::parse_document(html_str);
        let selector = match Selector::parse(&selector_str) {
            Ok(s) => s,
            Err(_) => {
                // 如果规则无法解析，避免将整段原始 HTML 返回造成界面乱码
                return String::new();
            }
        };

        let mut paragraphs = Vec::new();
        for element in document.select(&selector) {
            // 将 <br>, <p>, <div> 替换为换行
            let raw_html = element.inner_html();
            let cleaned_html = raw_html
                .replace("<br>", "\n")
                .replace("<br/>", "\n")
                .replace("<br />", "\n")
                .replace("</p>", "\n")
                .replace("</div>", "\n");

            let fragment = Html::parse_fragment(&cleaned_html);
            let text = fragment.root_element().text().collect::<Vec<_>>().join("");
            
            for line in text.lines() {
                let trimmed = line.trim();
                if !trimmed.is_empty() {
                    paragraphs.push(format!("    {}", trimmed));
                }
            }
        }

        let mut content = paragraphs.join("\n\n");

        // 如果配置了正则清洗规则
        if let Some(regex_rule) = replace_regex {
            content = apply_replace_regex(&content, regex_rule);
        }

        content
    }

    /// JSONPath 规则提取
    fn extract_jsonpath(json_str: &str, path: &str) -> Vec<String> {
        let json_val: Value = match serde_json::from_str(json_str) {
            Ok(v) => v,
            Err(_) => return Vec::new(),
        };

        let query = match serde_json_path::JsonPath::parse(path) {
            Ok(q) => q,
            Err(_) => return Vec::new(),
        };

        let nodes = query.query(&json_val);
        nodes
            .all()
            .into_iter()
            .map(|node| match node {
                Value::String(s) => s.clone(),
                Value::Number(n) => n.to_string(),
                Value::Bool(b) => b.to_string(),
                other => other.to_string(),
            })
            .collect()
    }
}

/// 绝对 URL 补全
pub fn resolve_url(base: Option<&str>, rel: &str) -> String {
    if rel.starts_with("http://") || rel.starts_with("https://") {
        return rel.to_string();
    }
    if let Some(base_str) = base {
        if let Ok(base_url) = Url::parse(base_str) {
            if let Ok(joined) = base_url.join(rel) {
                return joined.to_string();
            }
        }
    }
    rel.to_string()
}

/// 执行 Legado 形式的正则替换: "##pattern##replacement" 或 "##pattern"
fn apply_replace_regex(text: &str, rule: &str) -> String {
    let parts: Vec<&str> = rule.split("##").collect();
    if parts.len() >= 2 {
        let pattern = parts[1];
        let replacement = if parts.len() >= 3 { parts[2] } else { "" };
        if let Ok(re) = Regex::new(pattern) {
            return re.replace_all(text, replacement).to_string();
        }
    }
    text.to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_css_rule_parsing() {
        let (sel, attr) = RuleEngine::parse_css_rule("class.title@text");
        assert_eq!(sel, ".title");
        assert_eq!(attr.as_deref(), Some("text"));

        let (sel, attr) = RuleEngine::parse_css_rule("tag.div class.item tag.a@href");
        assert_eq!(sel, "div .item a");
        assert_eq!(attr.as_deref(), Some("href"));
    }

    #[test]
    fn test_extract_html() {
        let html = r#"
            <html>
                <body>
                    <div class="book-name">宿命之环</div>
                    <ul class="chapters">
                        <li><a href="/ch1.html">第一章 远方来信</a></li>
                        <li><a href="/ch2.html">第二章 异变</a></li>
                    </ul>
                </body>
            </html>
        "#;

        let title = RuleEngine::extract_single(html, "class.book-name@text", None);
        assert_eq!(title.as_deref(), Some("宿命之环"));

        let chapters = RuleEngine::extract_list(html, "ul.chapters li a@text", None);
        assert_eq!(chapters.len(), 2);
        assert_eq!(chapters[0], "第一章 远方来信");

        let links = RuleEngine::extract_list(html, "ul.chapters li a@href", Some("https://example.com/book/"));
        assert_eq!(links.len(), 2);
        assert_eq!(links[0], "https://example.com/ch1.html");
    }

    #[test]
    fn test_content_extraction() {
        let html = r#"
            <div id="content">
                夜幕降临。<br/>
                古老街道上的煤气路灯逐一亮起。<br><br>
                蒸汽机车发出低沉的轰鸣声。
            </div>
        "#;

        let content = RuleEngine::extract_content(html, "#content", None);
        assert!(content.contains("夜幕降临。"));
        assert!(content.contains("蒸汽机车发出低沉的轰鸣声。"));
    }
}
