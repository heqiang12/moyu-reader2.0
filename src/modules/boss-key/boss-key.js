import { storage } from '../../core/storage.js';
import { eventBus } from '../../core/event-bus.js';
import { matchShortcut } from '../settings/key-utils.js';
import { invoke } from '@tauri-apps/api/core';

/**
 * 将前端快捷键格式规范化为 Rust 插件能直接解析的格式。
 * 例如：CommandOrControl+` 转换为 ctrl+` (在 Windows 下) 或 super+` (在 macOS 下)
 */
function normalizeShortcutForRust(shortcut) {
  if (!shortcut) return '';
  const isMac = navigator.userAgent.toLowerCase().includes('macintosh') || 
                navigator.userAgent.toLowerCase().includes('mac os x');
  
  return shortcut
    .replace(/CommandOrControl/g, isMac ? 'super' : 'ctrl')
    .replace(/Control/g, 'ctrl')
    .replace(/Command/g, 'super')
    .replace(/Option/g, 'alt')
    .replace(/Alt/g, 'alt')
    .replace(/Shift/g, 'shift')
    .replace(/Key([A-Z])/g, '$1') // 移除 KeyA 这样的前缀，变成 A
    .replace(/Digit([0-9])/g, '$1'); // 移除 Digit1 这样的前缀，变成 1
}

/**
 * 老板键模块
 * 全局快捷键由 Rust 侧接管和管理，确保极其稳定且不受 HMR 干扰。
 * 如果不支持 Tauri 环境（如浏览器测试等），则降级使用 DOM keydown 事件监听。
 */
class BossKey {
  constructor() {
    this.isVisible = true;
    this.usingGlobalShortcut = false;
    this.currentShortcut = null;
    this.handleKeydown = this.handleKeydown.bind(this);
    this._regPromise = Promise.resolve(); // 串行化锁
  }

  async init() {
    const shortcut = storage.getConfig('bossKey_shortcut', 'CommandOrControl+`');
    await this._register(shortcut);
  }

  async _register(shortcut) {
    // 串行化：等上一次操作完成
    const prev = this._regPromise;
    let resolve;
    this._regPromise = new Promise(r => { resolve = r; });

    try {
      await prev;

      // 总是先移除 DOM 键盘事件监听
      document.removeEventListener('keydown', this.handleKeydown);

      this.currentShortcut = shortcut;
      const rustShortcut = normalizeShortcutForRust(shortcut);

      try {
        // 调用 Rust 端进行全局注册
        await invoke('register_boss_key', { shortcutStr: rustShortcut });
        this.usingGlobalShortcut = true;
      } catch (e) {
        console.warn('Rust全局快捷键注册失败，降级为DOM监听方式:', e);
        this.usingGlobalShortcut = false;
        // 降级为 DOM 键盘事件监听
        document.addEventListener('keydown', this.handleKeydown);
      }
    } finally {
      resolve();
    }
  }

  async reinit() {
    const shortcut = storage.getConfig('bossKey_shortcut', 'CommandOrControl+`');
    await this._register(shortcut);
  }

  async destroy() {
    document.removeEventListener('keydown', this.handleKeydown);
    await this._regPromise;
    try {
      await invoke('unregister_boss_key');
    } catch (e) {
      // 忽略
    }
    this.usingGlobalShortcut = false;
    this.currentShortcut = null;
  }

  handleKeydown(e) {
    const shortcut = this.currentShortcut || 'CommandOrControl+`';
    if (matchShortcut(e, shortcut)) {
      e.preventDefault();
      e.stopPropagation();
      this.toggle();
    }
  }

  async toggle() {
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      const win = getCurrentWindow();
      const visible = await win.isVisible();

      if (visible) {
        await win.hide();
        this.isVisible = false;
        eventBus.emit('bossKeyHidden');
      } else {
        await win.show();
        this.isVisible = true;
        eventBus.emit('bossKeyShown');
      }
    } catch (e) {
      this.isVisible = !this.isVisible;
      eventBus.emit(this.isVisible ? 'bossKeyShown' : 'bossKeyHidden');
    }
  }
}

export const bossKey = new BossKey();

// HMR 自恢复：当 bossKey 被热替换时，重新向 Rust 同步当前的快捷键配置
if (import.meta.hot) {
  import.meta.hot.accept(async () => {
    await bossKey.init();
  });
}


