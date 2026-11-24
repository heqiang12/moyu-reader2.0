use std::time::Duration;
use reqwest::header::{HeaderMap, HeaderValue, ACCEPT, ACCEPT_LANGUAGE, USER_AGENT};
use reqwest::Client;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum NetworkError {
    #[error("HTTP 请求失败: {0}")]
    ReqwestError(#[from] reqwest::Error),
    #[error("URL 格式错误: {0}")]
    UrlParseError(#[from] url::ParseError),
    #[error("遭遇网站反爬拦截 (Cloudflare / 503 盾 / 验证码): {0}")]
    AntiBotBlocked(String),
    #[error("HTTP 状态异常 ({0}): {1}")]
    HttpStatus(u16, String),
    #[error("响应解码失败")]
    DecodeError,
}

#[derive(Clone)]
pub struct NetworkClient {
    client: Client,
}

impl NetworkClient {
    pub fn new() -> Result<Self, NetworkError> {
        let mut headers = HeaderMap::new();
        // 伪装 Windows 平台真实的 Chrome 128+ 指纹
        headers.insert(
            USER_AGENT,
            HeaderValue::from_static("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0"),
        );
        headers.insert(
            ACCEPT,
            HeaderValue::from_static("text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7"),
        );
        headers.insert(
            ACCEPT_LANGUAGE,
            HeaderValue::from_static("zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6"),
        );
        headers.insert(
            "sec-ch-ua",
            HeaderValue::from_static("\"Chromium\";v=\"130\", \"Microsoft Edge\";v=\"130\", \"Not?A_Brand\";v=\"99\""),
        );
        headers.insert("sec-ch-ua-mobile", HeaderValue::from_static("?0"));
        headers.insert("sec-ch-ua-platform", HeaderValue::from_static("\"Windows\""));
        headers.insert("sec-fetch-dest", HeaderValue::from_static("document"));
        headers.insert("sec-fetch-mode", HeaderValue::from_static("navigate"));
        headers.insert("sec-fetch-site", HeaderValue::from_static("none"));
        headers.insert("sec-fetch-user", HeaderValue::from_static("?1"));
        headers.insert("upgrade-insecure-requests", HeaderValue::from_static("1"));

        let client = Client::builder()
            .default_headers(headers)
            .timeout(Duration::from_secs(30))
            .cookie_store(true)
            .gzip(true)
            .redirect(reqwest::redirect::Policy::limited(10))
            .build()?;

        Ok(Self { client })
    }

    /// 发起 GET 请求并自动智能处理 GBK / UTF-8 编码与 Cloudflare 反爬识别
    pub async fn get_html(&self, url: &str, custom_headers: Option<&HeaderMap>) -> Result<String, NetworkError> {
        let mut req = self.client.get(url);
        if let Some(headers) = custom_headers {
            req = req.headers(headers.clone());
        }

        let res = req.send().await?;
        let status = res.status();

        let bytes = res.bytes().await?;

        // 智能解码：检测 Content-Type 或 HTML meta charset
        let html = decode_bytes(&bytes);

        // 检测是否触发反爬盾或验证码
        if is_shield_detected(&html) {
            return Err(NetworkError::AntiBotBlocked(format!(
                "站点 [{}] 触发防护质询 (检测到 Cloudflare/WAF 拦截)",
                url
            )));
        }

        if !status.is_success() {
            return Err(NetworkError::HttpStatus(
                status.as_u16(),
                format!("站点 [{}] 请求异常，HTTP 状态码: {}", url, status),
            ));
        }

        Ok(html)
    }

    /// 发起 POST 请求
    pub async fn post_html(&self, url: &str, body: &str, content_type: Option<&str>, custom_headers: Option<&HeaderMap>) -> Result<String, NetworkError> {
        let mut req = self.client.post(url);
        if let Some(headers) = custom_headers {
            req = req.headers(headers.clone());
        }
        if let Some(ct) = content_type {
            req = req.header("Content-Type", ct);
        }
        req = req.body(body.to_string());

        let res = req.send().await?;
        let status = res.status();
        let bytes = res.bytes().await?;
        let html = decode_bytes(&bytes);

        if is_shield_detected(&html) {
            return Err(NetworkError::AntiBotBlocked(format!(
                "站点 [{}] 触发防护质询 (检测到 Cloudflare/WAF 拦截)",
                url
            )));
        }

        if !status.is_success() {
            return Err(NetworkError::HttpStatus(
                status.as_u16(),
                format!("站点 [{}] 请求异常，HTTP 状态码: {}", url, status),
            ));
        }

        Ok(html)
    }
}

/// 识别是否属于 Cloudflare 5s 盾、人机验证等防护拦截页
fn is_shield_detected(content: &str) -> bool {
    // JSON规则/说明中的防护词不是HTML质询页；真实HTML防护和HTTP错误仍正常识别。
    let trimmed = content.trim().trim_start_matches('\u{feff}');
    if serde_json::from_str::<serde_json::Value>(trimmed).is_ok() {
        return false;
    }
    let lower = content.to_lowercase();
    lower.contains("cf-browser-verification")
        || lower.contains("challenge-platform")
        || lower.contains("cf-turnstile")
        || lower.contains("just a moment...")
        || lower.contains("checking your browser")
        || lower.contains("安全验证")
        || lower.contains("waf") && lower.contains("blocked")
}

/// 自动根据编码解出正确中文字符串 (支持 UTF-8, GBK, GB2312, GB18030)
fn decode_bytes(bytes: &[u8]) -> String {
    // 先尝试标准的 UTF-8
    if let Ok(s) = std::str::from_utf8(bytes) {
        return s.to_string();
    }

    // 检测 HTML 内是否有 charset=gbk 或 gb2312
    let ascii_head: String = bytes.iter().take(2048).map(|&b| b as char).collect();
    let lower_head = ascii_head.to_lowercase();

    if lower_head.contains("gbk") || lower_head.contains("gb2312") || lower_head.contains("gb18030") {
        let (cow, _, _) = encoding_rs::GB18030.decode(bytes);
        return cow.into_owned();
    }

    // 默认回退使用 GB18030 解码中文网页
    let (cow, _, _) = encoding_rs::GB18030.decode(bytes);
    cow.into_owned()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_shield_detection() {
        assert!(is_shield_detected("<html><title>Just a moment...</title><body>challenge-platform</body></html>"));
        assert!(is_shield_detected("<div class='cf-turnstile'></div>"));
        assert!(!is_shield_detected("<html><body><h1>第一章 破晓</h1><p>正文内容...</p></body></html>"));
    }

    #[test]
    fn test_valid_json_with_protection_words_is_not_a_challenge_page() {
        let sources = serde_json::json!([{
            "bookSourceName": "正常书源",
            "bookSourceUrl": "https://source.test",
            "ruleContent": { "content": "<js>检查安全验证及challenge-platform</js>" },
            "bookSourceComment": "Cloudflare cf-turnstile / WAF blocked"
        }]).to_string();
        assert!(!is_shield_detected(&sources));
        assert!(!is_shield_detected(&format!(" \u{feff}{{\"bookSources\":{sources}}}\n")));
        assert!(is_shield_detected("<html><body>安全验证 challenge-platform</body></html>"));
    }

    #[test]
    fn test_decode_bytes() {
        let text = "你好，世界";
        let (gbk_bytes, _, _) = encoding_rs::GBK.encode(text);
        let decoded = decode_bytes(&gbk_bytes);
        assert_eq!(decoded, text);
    }
}
