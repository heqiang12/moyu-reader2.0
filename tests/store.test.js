import { describe, it, expect, vi } from 'vitest';

// 需要在 jsdom 环境下测试
describe('Store', () => {
  let store;

  beforeEach(async () => {
    // 动态导入以获得干净的实例
    const module = await import('../src/core/store.js');
    store = module.store;
  });

  it('应该返回初始状态', () => {
    const state = store.getState();
    expect(state.page).toBe('bookshelf');
    expect(state.currentBook).toBeNull();
    expect(state.readingMode).toBe('normal');
    expect(state.books).toEqual([]);
  });

  it('应该更新状态', () => {
    store.setState({ page: 'reader' });
    expect(store.getState().page).toBe('reader');
  });

  it('应该支持函数式更新', () => {
    store.setState(state => ({ ...state, currentCharOffset: 500 }));
    expect(store.getState().currentCharOffset).toBe(500);
  });

  it('应该触发订阅回调', () => {
    const callback = vi.fn();
    store.subscribe('page', callback);
    const prevPage = store.getState().page;
    store.setState({ page: 'settings' });
    expect(callback).toHaveBeenCalledWith('settings', prevPage);
  });

  it('应该能够取消订阅', () => {
    const callback = vi.fn();
    const unsubscribe = store.subscribe('page', callback);
    unsubscribe();
    store.setState({ page: 'reader' });
    expect(callback).not.toHaveBeenCalled();
  });
});
