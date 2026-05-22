import { eventBus } from './event-bus.js';

/**
 * 轻量级响应式状态管理
 */
class Store {
  constructor(initialState = {}) {
    this.state = initialState;
    this.subscribers = new Map();
  }

  getState() {
    return this.state;
  }

  setState(updater) {
    const prevState = this.state;
    this.state = typeof updater === 'function'
      ? updater(prevState)
      : { ...prevState, ...updater };

    this.subscribers.forEach((callbacks, key) => {
      if (prevState[key] !== this.state[key]) {
        callbacks.forEach(cb => cb(this.state[key], prevState[key]));
      }
    });

    eventBus.emit('stateChange', this.state, prevState);
  }

  subscribe(key, callback) {
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, new Set());
    }
    this.subscribers.get(key).add(callback);
    return () => {
      const callbacks = this.subscribers.get(key);
      if (callbacks) callbacks.delete(callback);
    };
  }
}

export const store = new Store({
  // 当前页面: 'bookshelf' | 'reader' | 'settings'
  page: 'bookshelf',
  // 当前书籍
  currentBook: null,
  // 当前章节索引
  currentChapter: 0,
  // 当前字符偏移量（章节内）
  currentCharOffset: 0,
  // 阅读模式: 'normal' | 'stealth'
  readingMode: 'normal',
  // 书籍列表
  books: [],
});
