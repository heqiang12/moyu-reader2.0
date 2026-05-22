/**
 * 窗口边缘拖拽调整大小
 * 在无边框窗口的四边和四角创建透明拖拽区域
 */

const DIRECTIONS = {
  'resize-n':     'North',
  'resize-s':     'South',
  'resize-e':     'East',
  'resize-w':     'West',
  'resize-ne':    'NorthEast',
  'resize-nw':    'NorthWest',
  'resize-se':    'SouthEast',
  'resize-sw':    'SouthWest',
};

export function createResizeHandles() {
  const fragment = document.createDocumentFragment();

  for (const [className, direction] of Object.entries(DIRECTIONS)) {
    const handle = document.createElement('div');
    handle.className = `resize-handle ${className}`;
    handle.dataset.direction = direction;
    fragment.appendChild(handle);
  }

  document.body.appendChild(fragment);

  document.body.addEventListener('mousedown', async (e) => {
    const handle = e.target.closest('.resize-handle');
    if (!handle) return;

    e.preventDefault();
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      await getCurrentWindow().startResizeDragging(handle.dataset.direction);
    } catch (err) {
      console.warn('startResizeDragging:', err);
    }
  });
}
