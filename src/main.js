import './style/index.css';
import './style/titlebar.css';
import './style/bookshelf.css';
import './style/reader.css';
import './style/settings.css';
import './style/modes/normal-mode.css';
import './style/modes/stealth-mode.css';
import './style/resize-handles.css';

import { router } from './core/router.js';
import { store } from './core/store.js';
import { eventBus } from './core/event-bus.js';
import { bossKey } from './modules/boss-key/boss-key.js';
import { modeManager } from './modules/modes/manager.js';
import { createTitlebar } from './modules/titlebar/titlebar.js';
import { createResizeHandles } from './modules/titlebar/resize-handles.js';
import { renderBookshelf } from './modules/bookshelf/bookshelf.js';
import { renderReader } from './modules/reader/reader.js';
import { renderSettings } from './modules/settings/settings.js';

// 注册路由
router.register('bookshelf', renderBookshelf);
router.register('reader', renderReader);
router.register('settings', renderSettings);

// 全局标题栏（在 #app 外部，路由切换不会被清除）
const titlebar = createTitlebar('MoYu Reader 2.0');
document.body.insertBefore(titlebar, document.getElementById('app'));

// 窗口边缘拖拽调整大小
createResizeHandles();

// 更新标题栏标题
function updateTitlebarTitle() {
  const state = store.getState();
  const titleEl = titlebar.querySelector('.titlebar__title');
  if (!titleEl) return;

  if (state.page === 'reader' && state.currentBook) {
    titleEl.textContent = state.currentBook.name;
  } else if (state.page === 'settings') {
    titleEl.textContent = '设置';
  } else {
    titleEl.textContent = 'MoYu Reader 2.0';
  }
}

store.subscribe('page', updateTitlebarTitle);
store.subscribe('currentBook', updateTitlebarTitle);

// 初始化模块
bossKey.init();
modeManager.init();

// 启动应用
router.init();


// Tauri 窗口配置
async function initTauriWindow() {
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    const window = getCurrentWindow();

    // 无边框模式
    // 注意：需要在 tauri.conf.json 中配置 decorations: false

    // 监听窗口关闭事件
    await window.onCloseRequested(async (event) => {
      event.preventDefault();
      await window.hide();
    });
  } catch (e) {
    console.warn('Tauri 窗口初始化:', e);
  }
}

initTauriWindow();

// 开发模式提示
if (import.meta.env.DEV) {
  console.log('MoYu Reader 2.0 2.0 - 开发模式');
}


