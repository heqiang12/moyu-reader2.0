/**
 * 隐蔽模式窗口管理
 * 负责 Tauri 窗口的变形、恢复、拖动
 */

let savedWindowState = null;
let transitionId = 0;
let stealthModeActive = false;

/**
 * 进入隐蔽模式：窗口缩小为单行条
 */
export async function enterStealthWindow() {
  const id = ++transitionId;
  try {
    const { getCurrentWindow, LogicalSize, LogicalPosition } = await import('@tauri-apps/api/window');
    const win = getCurrentWindow();

    // 只在首次进入时保存原始状态，避免老板键恢复时覆盖
    if (!savedWindowState) {
      const outerSize = await win.outerSize();
      const outerPos = await win.outerPosition();
      savedWindowState = {
        width: outerSize.width,
        height: outerSize.height,
        x: outerPos.x,
        y: outerPos.y,
        resizable: await win.isResizable(),
      };
    }

    // 同步隐蔽模式状态到 Rust 端，让老板键 toggle_window 知道当前模式
    if (!stealthModeActive) {
      stealthModeActive = true;
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('set_stealth_mode', { active: true });
      } catch (e) { /* 浏览器环境忽略 */ }
    }

    if (id !== transitionId) return;

    await win.setSize(new LogicalSize(800, 32));
    await win.setAlwaysOnTop(true);
    await win.setResizable(false);
    // 从任务栏隐藏，只保留托盘图标
    try { await win.setSkipTaskbar(true); } catch (e) { /* ignore if unsupported */ }
  } catch (e) {
    console.warn('enterStealthWindow:', e);
  }
}

/**
 * 退出隐蔽模式：恢复窗口原始状态
 */
export async function exitStealthWindow() {
  const id = ++transitionId;
  try {
    // 同步隐蔽模式状态到 Rust 端
    if (stealthModeActive) {
      stealthModeActive = false;
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('set_stealth_mode', { active: false });
      } catch (e) { /* 浏览器环境忽略 */ }
    }

    const { getCurrentWindow, LogicalSize, LogicalPosition } = await import('@tauri-apps/api/window');
    const win = getCurrentWindow();

    if (savedWindowState) {
      await win.setSize(new LogicalSize(savedWindowState.width, savedWindowState.height));
      await win.setPosition(new LogicalPosition(savedWindowState.x, savedWindowState.y));
      await win.setResizable(savedWindowState.resizable);
      savedWindowState = null;
    } else {
      await win.setSize(new LogicalSize(800, 600));
      await win.setResizable(true);
    }

    if (id !== transitionId) return;

    await win.setAlwaysOnTop(false);
    // 恢复任务栏显示
    try { await win.setSkipTaskbar(false); } catch (e) { /* ignore */ }
  } catch (e) {
    console.warn('exitStealthWindow:', e);
  }
}

/**
 * 开始原生窗口拖动
 */
export async function startStealthDrag() {
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    await getCurrentWindow().startDragging();
  } catch (e) {
    console.warn('startStealthDrag:', e);
  }
}
