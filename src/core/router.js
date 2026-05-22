import { store } from './store.js';
import { eventBus } from './event-bus.js';

/**
 * 简易 SPA 路由（基于状态管理）
 */
class Router {
  constructor() {
    this.routes = new Map();
    this.currentView = null;

    store.subscribe('page', (page) => {
      this._render(page);
    });
  }

  register(page, renderFn) {
    this.routes.set(page, renderFn);
  }

  navigate(page) {
    store.setState({ page });
  }

  forceRender() {
    const page = store.getState().page;
    this._render(page);
  }

  async _render(page) {
    const renderFn = this.routes.get(page);
    if (!renderFn) return;

    // 通知旧视图即将切换，让 cleanup 先执行
    eventBus.emit('routeWillChange', page);

    const app = document.getElementById('app');
    if (!app) return;

    app.innerHTML = '';
    const view = await renderFn();
    if (typeof view === 'string') {
      app.innerHTML = view;
    } else if (view instanceof HTMLElement) {
      app.appendChild(view);
    }
    this.currentView = page;
    eventBus.emit('routeChange', page);
  }

  init() {
    const page = store.getState().page;
    this._render(page);
  }
}

export const router = new Router();
