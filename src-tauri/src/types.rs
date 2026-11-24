use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Book {
    pub book_url: String,
    pub name: String,
    pub author: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub kind: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cover_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub custom_cover_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub intro: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub custom_intro: Option<String>,
    pub origin: String,
    pub origin_name: String,
    pub dur_chapter_index: i32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dur_chapter_title: Option<String>,
    pub total_chapter_num: i32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub latest_chapter_title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub latest_chapter_time: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub group: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub word_count: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub can_update: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub order: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dur_chapter_time: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sources: Option<Vec<SearchBook>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BookChapter {
    pub url: String,
    pub title: String,
    pub index: i32,
    pub book_url: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_volume: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub base_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchBook {
    pub book_url: String,
    pub name: String,
    pub author: String,
    pub origin: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub origin_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cover_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub toc_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub latest_chapter_title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub intro: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub word_count: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub kind: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sources: Option<Vec<SearchBook>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchBatch {
    pub request_id: String,
    pub books: Vec<SearchBook>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExploreKind {
    pub title: String,
    pub url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct RuleSearch {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub book_list: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub author: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub intro: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub kind: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub book_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cover_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_chapter: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub word_count: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct RuleBookInfo {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub init: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub author: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub intro: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub kind: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cover_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_chapter: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub toc_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub word_count: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct RuleToc {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub chapter_list: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub chapter_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub chapter_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub next_toc_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct RuleContent {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub next_content_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub replace_regex: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct BookSource {
    pub book_source_name: String,
    pub book_source_url: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub book_source_group: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub book_source_type: Option<i32>,
    #[serde(default)]
    pub enabled: bool,
    #[serde(default)]
    pub enabled_explore: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub explore_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub search_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub custom_order: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub weight: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_update_time: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub book_source_comment: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub header: Option<String>,

    // 详细规则（兼容新旧 Legado 同时存在 ruleX 与 xRule 的情况）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rule_search: Option<RuleSearch>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub search_rule: Option<RuleSearch>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub rule_explore: Option<RuleSearch>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub explore_rule: Option<RuleSearch>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub rule_book_info: Option<RuleBookInfo>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub book_info_rule: Option<RuleBookInfo>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub rule_toc: Option<RuleToc>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub toc_rule: Option<RuleToc>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub rule_content: Option<RuleContent>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content_rule: Option<RuleContent>,
}

impl BookSource {
    pub fn get_rule_search(&self) -> Option<&RuleSearch> {
        self.rule_search.as_ref().or(self.search_rule.as_ref())
    }

    pub fn get_rule_explore(&self) -> Option<&RuleSearch> {
        self.rule_explore.as_ref().or(self.explore_rule.as_ref()).or(self.get_rule_search())
    }

    pub fn get_rule_toc(&self) -> Option<&RuleToc> {
        self.rule_toc.as_ref().or(self.toc_rule.as_ref())
    }

    pub fn get_rule_content(&self) -> Option<&RuleContent> {
        self.rule_content.as_ref().or(self.content_rule.as_ref())
    }

    pub fn get_rule_book_info(&self) -> Option<&RuleBookInfo> {
        self.rule_book_info.as_ref().or(self.book_info_rule.as_ref())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn search_batch_matches_frontend_fields() {
        let batch = SearchBatch { request_id: "request-1".into(), books: vec![] };
        assert_eq!(serde_json::to_value(batch).unwrap(), serde_json::json!({
            "requestId": "request-1", "books": []
        }));
    }
}
