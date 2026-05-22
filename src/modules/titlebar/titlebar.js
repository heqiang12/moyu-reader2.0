import { createElement } from '../../utils/dom-utils.js';

/**
 * 自定义标题栏模块
 */
export function createTitlebar(title = '摸鱼阅读器', showControls = true) {
  const titlebar = createElement('div', { className: 'titlebar' });

  const titleEl = createElement('span', { className: 'titlebar__title' }, title);
  titlebar.appendChild(titleEl);

  let maxBtn = null;

  if (showControls) {
    const controls = createElement('div', { className: 'titlebar__controls' });

    const minimizeBtn = createElement('button', {
      className: 'titlebar__btn',
      title: '最小化',
      onClick: () => handleMinimize(),
    }, '─');

    maxBtn = createElement('button', {
      className: 'titlebar__btn',
      title: '最大化',
      onClick: () => handleMaximize(maxBtn),
    }, '□');

    const closeBtn = createElement('button', {
      className: 'titlebar__btn titlebar__btn--close',
      title: '关闭',
      onClick: () => handleClose(),
    }, '✕');

    controls.appendChild(minimizeBtn);
    controls.appendChild(maxBtn);
    controls.appendChild(closeBtn);
    titlebar.appendChild(controls);
  }

  // 双击标题栏切换最大化
  titlebar.addEventListener('dblclick', async (e) => {
    if (e.target.closest('.titlebar__controls')) return;
    if (maxBtn) await handleMaximize(maxBtn);
  });

  // 监听窗口大小变化，同步最大化按钮状态
  syncMaximizeState(maxBtn);

  return titlebar;
}

async function syncMaximizeState(btn) {
  if (!btn) return;
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    const win = getCurrentWindow();

    const update = async () => {
      const maximized = await win.isMaximized();
      btn.textContent = maximized ? '❐' : '□';
      btn.title = maximized ? '还原' : '最大化';
    };

    await win.onResized(() => update());
    await update();
  } catch (e) {
    // 浏览器环境忽略
  }
}

async function handleMinimize() {
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    await getCurrentWindow().minimize();
  } catch (e) {
    console.warn('Tauri API 不可用:', e);
  }
}

async function handleMaximize(btn) {
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    const win = getCurrentWindow();
    const isMaximized = await win.isMaximized();

    if (isMaximized) {
      await win.unmaximize();
      btn.textContent = '□';
      btn.title = '最大化';
    } else {
      await win.maximize();
      btn.textContent = '❐';
      btn.title = '还原';
    }
  } catch (e) {
    console.warn('Tauri API 不可用:', e);
  }
}

async function handleClose() {
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    await getCurrentWindow().hide();
  } catch (e) {
    console.warn('Tauri API 不可用:', e);
  }
}
