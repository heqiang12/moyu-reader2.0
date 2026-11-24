// 隐蔽（摸鱼）窗口管理：创建、显隐、穿透模式、托盘、全局快捷键
use std::sync::atomic::{AtomicBool, Ordering};

use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIcon, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, Runtime, WebviewUrl, WebviewWindowBuilder,
};

pub const STEALTH_LABEL: &str = "stealth";

/// 穿透模式状态（进程内共享，跨 command/快捷键）
static PASSTHROUGH: AtomicBool = AtomicBool::new(false);

/// 托盘图标持有（防止被 drop 后图标消失）
pub struct TrayHolder<R: Runtime>(pub TrayIcon<R>);

/// 惰性创建 stealth 窗口（首次打开时创建，之后 hide/show 复用）
pub fn ensure_stealth_window<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    if app.get_webview_window(STEALTH_LABEL).is_some() {
        return Ok(());
    }
    WebviewWindowBuilder::new(
        app,
        STEALTH_LABEL,
        WebviewUrl::App("index.html#/stealth".into()),
    )
    .title("摸鱼阅读 - 隐蔽模式")
    .inner_size(480.0, 96.0)
    .decorations(false)
    .always_on_top(true)
    .skip_taskbar(true)
    .transparent(true)
    .resizable(false)
    .visible(false)
    .build()?;
    Ok(())
}

fn show_main<R: Runtime>(app: &AppHandle<R>) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
    }
}

/// 显示 stealth（交互模式：可点击、可拖动）
pub fn show_stealth<R: Runtime>(app: &AppHandle<R>) {
    let Some(win) = app.get_webview_window(STEALTH_LABEL) else {
        return;
    };
    let _ = win.show();
    let _ = win.set_focus();
    let _ = win.set_ignore_cursor_events(false);
    PASSTHROUGH.store(false, Ordering::SeqCst);
    let _ = app.emit_to(STEALTH_LABEL, "stealth:show", ());
}

pub fn hide_stealth<R: Runtime>(app: &AppHandle<R>) {
    if let Some(win) = app.get_webview_window(STEALTH_LABEL) {
        let _ = win.hide();
    }
}

/// 切换穿透模式，返回切换后的状态
pub fn toggle_passthrough<R: Runtime>(app: &AppHandle<R>) -> bool {
    let Some(win) = app.get_webview_window(STEALTH_LABEL) else {
        return false;
    };
    let next = !PASSTHROUGH.load(Ordering::SeqCst);
    let _ = win.set_ignore_cursor_events(next);
    PASSTHROUGH.store(next, Ordering::SeqCst);
    next
}

/// boss 键三态循环：隐藏 → 显示(交互) → 穿透 → 隐藏
pub fn cycle_stealth<R: Runtime>(app: &AppHandle<R>) {
    if let Err(e) = ensure_stealth_window(app) {
        eprintln!("创建隐蔽窗口失败: {}", e);
        return;
    }
    let Some(win) = app.get_webview_window(STEALTH_LABEL) else {
        return;
    };
    let visible = win.is_visible().unwrap_or(false);
    if !visible {
        show_stealth(app);
    } else if !PASSTHROUGH.load(Ordering::SeqCst) {
        // 交互 → 穿透（纯显示，鼠标穿过）
        let _ = win.set_ignore_cursor_events(true);
        PASSTHROUGH.store(true, Ordering::SeqCst);
    } else {
        hide_stealth(app);
    }
}

/// stealth 翻行：Rust 发事件给 stealth 窗口，前端处理
pub fn nav_stealth<R: Runtime>(app: &AppHandle<R>, direction: &str) {
    if let Some(win) = app.get_webview_window(STEALTH_LABEL) {
        if win.is_visible().unwrap_or(false) {
            let _ = app.emit_to(STEALTH_LABEL, "stealth:nav", direction);
        }
    }
}

pub fn stealth_state_json<R: Runtime>(app: &AppHandle<R>) -> serde_json::Value {
    let win = app.get_webview_window(STEALTH_LABEL);
    let visible = win.as_ref().and_then(|w| w.is_visible().ok()).unwrap_or(false);
    serde_json::json!({
        "visible": visible,
        "passthrough": PASSTHROUGH.load(Ordering::SeqCst),
    })
}

pub fn set_bounds<R: Runtime>(app: &AppHandle<R>, width: f64, height: f64) -> tauri::Result<()> {
    if let Some(win) = app.get_webview_window(STEALTH_LABEL) {
        win.set_size(tauri::LogicalSize::new(width, height))?;
    }
    Ok(())
}

/// 托盘：显示主窗口 / 退出
pub fn setup_tray<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, "show", "显示主窗口", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &quit])?;

    let mut builder = TrayIconBuilder::with_id("main-tray").menu(&menu);
    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }
    let tray = builder
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => show_main(app),
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                show_main(tray.app_handle());
            }
        })
        .build(app)?;
    // 持有 tray，防止 drop 销毁图标
    app.manage(TrayHolder(tray));
    Ok(())
}

/// 全局快捷键注册（Rust 侧注册，不依赖前端）
pub fn register_shortcuts<R: Runtime>(app: &AppHandle<R>) -> Result<(), Box<dyn std::error::Error>> {
    use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

    // boss 键：隐蔽窗口三态循环
    app.global_shortcut()
        .on_shortcut("Control+Alt+M", |app, _sc, event| {
            if event.state() == ShortcutState::Pressed {
                // Windows WebView2 不能在同步事件处理器中建窗。
                let app = app.clone();
                tauri::async_runtime::spawn_blocking(move || cycle_stealth(&app));
            }
        })?;
    // 下一行
    app.global_shortcut()
        .on_shortcut("Control+Alt+Right", |app, _sc, event| {
            if event.state() == ShortcutState::Pressed {
                nav_stealth(app, "next");
            }
        })?;
    // 上一行
    app.global_shortcut()
        .on_shortcut("Control+Alt+Left", |app, _sc, event| {
            if event.state() == ShortcutState::Pressed {
                nav_stealth(app, "prev");
            }
        })?;
    // 透明度调高（背景更透）
    app.global_shortcut()
        .on_shortcut("Control+Alt+Up", |app, _sc, event| {
            if event.state() == ShortcutState::Pressed {
                opacity_stealth(app, 1);
            }
        })?;
    // 透明度调低（背景更实）
    app.global_shortcut()
        .on_shortcut("Control+Alt+Down", |app, _sc, event| {
            if event.state() == ShortcutState::Pressed {
                opacity_stealth(app, -1);
            }
        })?;
    Ok(())
}

/// stealth 透明度调节：发事件给前端（前端用 CSS 背景 alpha 实现，Windows 上窗口 set_opacity 不稳定）
fn opacity_stealth<R: Runtime>(app: &AppHandle<R>, delta: i32) {
    if let Some(win) = app.get_webview_window(STEALTH_LABEL) {
        if win.is_visible().unwrap_or(false) {
            let _ = app.emit_to(STEALTH_LABEL, "stealth:opacity", delta);
        }
    }
}
