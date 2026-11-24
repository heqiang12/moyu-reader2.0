pub mod commands;
pub mod crawler;
pub mod db;
pub mod engine;
pub mod network;
pub mod stealth;
pub mod types;

use std::fs;
use std::path::PathBuf;
use tauri::{Manager, WindowEvent};
use commands::AppState;
use crawler::Crawler;
use db::Database;
use network::NetworkClient;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.show();
                let _ = w.unminimize();
                let _ = w.set_focus();
            }
        }))
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .on_window_event(|window, event| {
            if window.label() == "main" && matches!(event, WindowEvent::CloseRequested { .. }) {
                // 主窗关闭始终退出，不能留下只含隐藏隐蔽窗的后台进程。
                window.app_handle().exit(0);
            }
        })
        .setup(|app| {
            // 获取用户数据存储目录
            let app_data_dir = app
                .path()
                .app_data_dir()
                .unwrap_or_else(|_| PathBuf::from("./"));
            let _ = fs::create_dir_all(&app_data_dir);
            let db_path = app_data_dir.join("moyu_reader.db");

            let db = Database::new(db_path).expect("初始化数据库失败");
            let network = NetworkClient::new().expect("初始化网络客户端失败");
            let crawler = Crawler::new(network.clone(), db.clone());

            app.manage(AppState {
                db,
                crawler,
                network,
            });

            // 初始化系统托盘
            if let Err(e) = stealth::setup_tray(app.handle()) {
                eprintln!("设置托盘失败: {}", e);
            }

            // 注册全局快捷键 (Boss 键 Control+Alt+M 等)
            if let Err(e) = stealth::register_shortcuts(app.handle()) {
                eprintln!("注册全局快捷键失败: {}", e);
            }

            // 确保主窗口显示并聚焦
            if let Some(main_win) = app.get_webview_window("main") {
                let _ = main_win.show();
                let _ = main_win.set_focus();
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::backend_state,
            commands::backend_health,
            // 书架
            commands::get_bookshelf,
            commands::save_book,
            commands::delete_book,
            commands::get_book_info,
            commands::change_book_source,
            commands::save_book_progress,
            // 章节与正文
            commands::get_chapter_list,
            commands::get_book_content,
            // 书源
            commands::get_book_sources,
            commands::save_book_source,
            commands::save_book_sources,
            commands::delete_book_source,
            commands::delete_all_book_sources,
            commands::import_remote_sources,
            // 分类发现
            commands::get_source_explore_kinds,
            commands::explore_source_kind,
            // 搜索
            commands::start_search,
            // 摸鱼窗口
            commands::open_stealth_window,
            commands::hide_stealth_window,
            commands::toggle_stealth_passthrough,
            commands::cycle_stealth_mode,
            commands::get_stealth_state,
            commands::set_stealth_bounds,
        ])
        .run(tauri::generate_context!())
        .expect("运行 Moyu Reader 失败");
}
