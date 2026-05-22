import { store } from '../../core/store.js';
import { eventBus } from '../../core/event-bus.js';
import { router } from '../../core/router.js';

/**
 * 阅读模式管理器
 */
class ModeManager {
  constructor() {
    this.currentMode = 'normal';
  }

  init() {
    // 监听状态变化
    store.subscribe('readingMode', (mode, prevMode) => {
      if (mode !== prevMode) {
        this.currentMode = mode;
        // 强制重新渲染当前页面
        router.forceRender();
      }
    });
  }

  getMode() {
    return this.currentMode;
  }
}

export const modeManager = new ModeManager();
