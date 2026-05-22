use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::Manager;
use tauri::LogicalSize;
use std::sync::Mutex;
use tauri_plugin_global_shortcut::Shortcut;

pub struct BossState {
  pub current_shortcut: Mutex<Option<Shortcut>>,
  pub in_stealth: Mutex<bool>,
}

#[tauri::command]
fn register_boss_key(
  app: tauri::AppHandle,
  state: tauri::State<'_, BossState>,
  shortcut_str: String,
) -> Result<(), String> {
  use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut};

  let shortcut = shortcut_str.parse::<Shortcut>()
    .map_err(|e| format!("解析快捷键失败: {}", e))?;

  let mut current = state.current_shortcut.lock().unwrap();

  // 1. 如果已有快捷键，先注销
  if let Some(old_shortcut) = current.take() {
    let _ = app.global_shortcut().unregister(old_shortcut);
  }

  // 2. 注册新的快捷键
  app.global_shortcut().register(shortcut.clone())
    .map_err(|e| format!("注册快捷键失败: {}", e))?;

  // 3. 保存到状态中
  *current = Some(shortcut);

  Ok(())
}

#[tauri::command]
fn unregister_boss_key(
  app: tauri::AppHandle,
  state: tauri::State<'_, BossState>,
) -> Result<(), String> {
  use tauri_plugin_global_shortcut::GlobalShortcutExt;

  let mut current = state.current_shortcut.lock().unwrap();
  if let Some(old_shortcut) = current.take() {
    let _ = app.global_shortcut().unregister(old_shortcut);
  }
  Ok(())
}

#[tauri::command]
fn set_stealth_mode(
  state: tauri::State<'_, BossState>,
  active: bool,
) -> Result<(), String> {
  let mut in_stealth = state.in_stealth.lock().unwrap();
  *in_stealth = active;
  Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    .plugin(
      tauri_plugin_global_shortcut::Builder::new()
        .with_handler(|app, shortcut, event| {
          if event.state() == tauri_plugin_global_shortcut::ShortcutState::Pressed {
            let state = app.state::<BossState>();
            let current = state.current_shortcut.lock().unwrap();
            if let Some(ref current_shortcut) = *current {
              if current_shortcut == shortcut {
                toggle_window(app);
              }
            }
          }
        })
        .build(),
    )
    .setup(|app| {
      app.manage(BossState {
        current_shortcut: Mutex::new(None),
        in_stealth: Mutex::new(false),
      });

      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      // 系统托盘
      let show_hide = MenuItemBuilder::new("显示/隐藏").id("show_hide").build(app)?;
      let quit = MenuItemBuilder::new("退出").id("quit").build(app)?;
      let menu = MenuBuilder::new(app).items(&[&show_hide, &quit]).build()?;

      let _tray = TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&menu)
        .tooltip("摸鱼阅读器")
        .on_menu_event(move |app, event| {
          match event.id().as_ref() {
            "show_hide" => {
              toggle_window(app);
            }
            "quit" => {
              app.exit(0);
            }
            _ => {}
          }
        })
        .on_tray_icon_event(|tray, event| {
          if let TrayIconEvent::Click {
            button: MouseButton::Left,
            button_state: MouseButtonState::Up,
            ..
          } = event
          {
            toggle_window(tray.app_handle());
          }
        })
        .build(app)?;

      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      register_boss_key,
      unregister_boss_key,
      set_stealth_mode
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

fn toggle_window(app: &tauri::AppHandle) {
  if let Some(window) = app.get_webview_window("main") {
    if window.is_visible().unwrap_or(true) {
      let _ = window.hide();
    } else {
      let in_stealth = {
        let state = app.state::<BossState>();
        let val = *state.in_stealth.lock().unwrap();
        val
      };

      if in_stealth {
        // 隐蔽模式：只显示窗口，不改变尺寸和标志
        // JS 侧的 bossKeyShown 事件会重新应用隐蔽窗口配置
        let _ = window.show();
      } else {
        // 正常模式：从托盘恢复时确保窗口尺寸和状态正常
        let _ = window.set_size(LogicalSize::new(800, 600));
        let _ = window.set_resizable(true);
        let _ = window.set_always_on_top(false);
        let _ = window.show();
        let _ = window.set_focus();
      }
    }
  }
}
