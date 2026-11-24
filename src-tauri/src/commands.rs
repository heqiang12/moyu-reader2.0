use tauri::{AppHandle, Emitter, State};
use crate::crawler::Crawler;
use crate::db::Database;
use crate::network::NetworkClient;
use crate::stealth;
use crate::types::{Book, BookChapter, BookSource, SearchBatch, SearchBook};

pub struct AppState {
    pub db: Database,
    pub crawler: Crawler,
    pub network: NetworkClient,
}

#[tauri::command]
pub fn backend_state() -> String {
    "ready".to_string()
}

#[tauri::command]
pub fn backend_health() -> bool {
    true
}

// ---- 书架管理 ----

#[tauri::command]
pub fn get_bookshelf(state: State<'_, AppState>) -> Result<Vec<Book>, String> {
    state.db.get_bookshelf().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_book(book: SearchBook, state: State<'_, AppState>) -> Result<Book, String> {
    state.db.save_book(&book).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_book(book_url: String, state: State<'_, AppState>) -> Result<(), String> {
    state.db.delete_book(&book_url).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_book_info(url: String, state: State<'_, AppState>) -> Result<Option<Book>, String> {
    state.db.get_book(&url).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn change_book_source(
    book_url: String,
    new_book_url: String,
    new_origin: String,
    new_origin_name: String,
    state: State<'_, AppState>,
) -> Result<Option<Book>, String> {
    state.db.change_book_source(&book_url, &new_book_url, &new_origin, &new_origin_name).map_err(|e| e.to_string())
}

// ---- 章节与正文 ----

#[tauri::command]
pub async fn get_chapter_list(
    book_url: String,
    book_source_url: Option<String>,
    state: State<'_, AppState>,
) -> Result<Vec<BookChapter>, String> {
    state.crawler.get_chapter_list(&book_url, book_source_url.as_deref()).await
}

#[tauri::command]
pub async fn get_book_content(
    book_url: String,
    chapter_url: String,
    index: i32,
    book_source_url: Option<String>,
    state: State<'_, AppState>,
) -> Result<String, String> {
    state.crawler.get_chapter_content(&book_url, &chapter_url, index, book_source_url.as_deref()).await
}

#[tauri::command]
pub fn save_book_progress(
    url: String,
    index: i32,
    title: Option<String>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    state.db.save_book_progress(&url, index, title.as_deref()).map_err(|e| e.to_string())
}

// ---- 书源管理 ----

#[tauri::command]
pub fn get_book_sources(state: State<'_, AppState>) -> Result<Vec<BookSource>, String> {
    state.db.get_book_sources().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_book_source(source: BookSource, state: State<'_, AppState>) -> Result<(), String> {
    state.db.save_book_source(&source).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_book_sources(sources: Vec<BookSource>, state: State<'_, AppState>) -> Result<(), String> {
    state.db.save_book_sources(&sources).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_book_source(book_source_url: String, state: State<'_, AppState>) -> Result<(), String> {
    state.db.delete_book_source(&book_source_url).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_all_book_sources(state: State<'_, AppState>) -> Result<(), String> {
    state.db.delete_all_book_sources().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn import_remote_sources(url: String, state: State<'_, AppState>) -> Result<usize, String> {
    let json_text = state.network.get_html(&url, None).await.map_err(|e| e.to_string())?;
    let trimmed = json_text.trim().trim_start_matches('\u{feff}');

    let sources: Vec<BookSource> = if let Ok(list) = serde_json::from_str::<Vec<BookSource>>(trimmed) {
        list
    } else if let Ok(single) = serde_json::from_str::<BookSource>(trimmed) {
        vec![single]
    } else if let Ok(val) = serde_json::from_str::<serde_json::Value>(trimmed) {
        if let Some(arr) = val.get("bookSources").or_else(|| val.get("data")).and_then(|v| v.as_array()) {
            serde_json::from_value(serde_json::Value::Array(arr.clone())).map_err(|e| format!("解析书源失败: {}", e))?
        } else {
            return Err("未识别的书源 JSON 数据结构".to_string());
        }
    } else {
        return Err("解析书源 JSON 失败".to_string());
    };

    let count = sources.len();
    state.db.save_book_sources(&sources).map_err(|e| e.to_string())?;
    Ok(count)
}

// ---- 书源分类/发现探索 ----

#[tauri::command]
pub fn get_source_explore_kinds(
    source_url: String,
    state: State<'_, AppState>,
) -> Result<Vec<crate::types::ExploreKind>, String> {
    state.crawler.get_source_explore_kinds(&source_url)
}

#[tauri::command]
pub async fn explore_source_kind(
    source_url: String,
    kind_url: String,
    page: i32,
    state: State<'_, AppState>,
) -> Result<Vec<SearchBook>, String> {
    state.crawler.explore_source_kind(&source_url, &kind_url, page).await
}

// ---- 并发流式搜索 ----

#[tauri::command]
pub async fn start_search(keyword: String, request_id: String, app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    let sources = state.db.get_enabled_book_sources().map_err(|e| e.to_string())?;
    let crawler = state.crawler.clone();

    tokio::spawn(async move {
        // 控制并发度为 10
        let semaphore = std::sync::Arc::new(tokio::sync::Semaphore::new(10));
        let mut tasks = Vec::new();

        for source in sources {
            let sem = semaphore.clone();
            let kw = keyword.clone();
            let c = crawler.clone();
            let app_h = app.clone();
            let request_id = request_id.clone();

            tasks.push(tokio::spawn(async move {
                let _permit = sem.acquire_owned().await;
                let search_task = c.search_single_source(&source, &kw);
                if let Ok(Ok(results)) = tokio::time::timeout(std::time::Duration::from_secs(20), search_task).await {
                    if !results.is_empty() {
                        let _ = app_h.emit("search:item", SearchBatch { request_id, books: results });
                    }
                }
            }));
        }

        for task in tasks {
            let _ = task.await;
        }

        let _ = app.emit("search:end", request_id);
    });

    Ok(())
}

// ---- 摸鱼窗口管理 ----

#[tauri::command]
pub async fn open_stealth_window(app: AppHandle) -> Result<(), String> {
    stealth::ensure_stealth_window(&app).map_err(|e| e.to_string())?;
    stealth::show_stealth(&app);
    Ok(())
}

#[tauri::command]
pub fn hide_stealth_window(app: AppHandle) -> Result<(), String> {
    stealth::hide_stealth(&app);
    Ok(())
}

#[tauri::command]
pub fn toggle_stealth_passthrough(app: AppHandle) -> bool {
    stealth::toggle_passthrough(&app)
}

#[tauri::command]
pub async fn cycle_stealth_mode(app: AppHandle) {
    stealth::cycle_stealth(&app);
}

#[tauri::command]
pub fn get_stealth_state(app: AppHandle) -> serde_json::Value {
    stealth::stealth_state_json(&app)
}

#[tauri::command]
pub fn set_stealth_bounds(app: AppHandle, width: f64, height: f64) -> Result<(), String> {
    stealth::set_bounds(&app, width, height).map_err(|e| e.to_string())
}
