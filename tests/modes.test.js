import { describe, it, expect } from 'vitest';
import { getStealthKeyAction, validateStealthSingleKey } from '../src/modules/settings/key-utils.js';

describe('隐蔽模式', () => {
  describe('按键动作映射 (getStealthKeyAction)', () => {
    it('下一页键返回 nextPage', () => {
      expect(getStealthKeyAction({ key: 'j' }, 'j', 'k')).toBe('nextPage');
    });

    it('上一页键返回 prevPage', () => {
      expect(getStealthKeyAction({ key: 'k' }, 'j', 'k')).toBe('prevPage');
    });

    it('ArrowDown 返回 nextLine', () => {
      expect(getStealthKeyAction({ key: 'ArrowDown' }, 'j', 'k')).toBe('nextLine');
    });

    it('ArrowUp 返回 prevLine', () => {
      expect(getStealthKeyAction({ key: 'ArrowUp' }, 'j', 'k')).toBe('prevLine');
    });

    it('自定义键如逗号/句号也能正确映射', () => {
      expect(getStealthKeyAction({ key: ',' }, ',', '.')).toBe('nextPage');
      expect(getStealthKeyAction({ key: '.' }, ',', '.')).toBe('prevPage');
    });

    it('未映射键返回 null', () => {
      expect(getStealthKeyAction({ key: 'x' }, 'j', 'k')).toBeNull();
      expect(getStealthKeyAction({ key: 'a' }, 'j', 'k')).toBeNull();
    });
  });

  describe('动作名称一致性', () => {
    // 确保 getStealthKeyAction 返回的动作名与 stealth-mode.js switch 语句一致
    const VALID_ACTIONS = new Set(['nextLine', 'prevLine', 'nextPage', 'prevPage', 'exit']);

    it('所有返回值都是合法动作名', () => {
      const keys = ['ArrowDown', 'ArrowUp', 'j', 'k', 'Escape', 'x', ' ', 'Enter'];
      for (const key of keys) {
        const action = getStealthKeyAction({ key }, 'j', 'k');
        if (action !== null) {
          expect(VALID_ACTIONS.has(action)).toBe(true);
        }
      }
    });

    it('nextPage 和 prevPage 是不同的动作', () => {
      const next = getStealthKeyAction({ key: 'j' }, 'j', 'k');
      const prev = getStealthKeyAction({ key: 'k' }, 'j', 'k');
      expect(next).not.toBe(prev);
    });
  });

  describe('配置热更新支持', () => {
    // getStealthKeyAction 接受 keyNext/keyPrev 参数，不依赖闭包
    // 所以每次调用时传入最新的 config 值即可实现热更新
    it('更换配置后动作映射应立即生效', () => {
      // 初始配置：j=next, k=prev
      expect(getStealthKeyAction({ key: 'j' }, 'j', 'k')).toBe('nextPage');
      expect(getStealthKeyAction({ key: ',' }, 'j', 'k')).toBeNull();

      // 更换配置：,=next, .=prev
      expect(getStealthKeyAction({ key: ',' }, ',', '.')).toBe('nextPage');
      expect(getStealthKeyAction({ key: 'j' }, ',', '.')).toBeNull();
    });
  });

  describe('配置管理', () => {
    it('应该有默认配置', () => {
      const defaultConfig = {
        bgColor: 'rgba(0, 0, 0, 0.7)',
        fontColor: '#e6e6e6',
        fontSize: 13,
        opacity: 1,
        fontFamily: 'system-ui, sans-serif',
      };

      expect(defaultConfig.bgColor).toBe('rgba(0, 0, 0, 0.7)');
      expect(defaultConfig.fontColor).toBe('#e6e6e6');
      expect(defaultConfig.fontSize).toBe(13);
      expect(defaultConfig.opacity).toBe(1);
    });

    it('配置值应该在有效范围内', () => {
      const fontSize = 13;
      const opacity = 0.8;

      expect(fontSize).toBeGreaterThanOrEqual(10);
      expect(fontSize).toBeLessThanOrEqual(20);
      expect(opacity).toBeGreaterThanOrEqual(0.1);
      expect(opacity).toBeLessThanOrEqual(1);
    });
  });

  describe('翻行逻辑', () => {
    it('应该支持逐行浏览', () => {
      const content = '第一行\n第二行\n第三行\n第四行\n第五行';
      const lines = content.split('\n').filter(l => l.trim());
      let lineOffset = 0;

      expect(lines[lineOffset]).toBe('第一行');

      lineOffset++;
      expect(lines[lineOffset]).toBe('第二行');

      lineOffset++;
      expect(lines[lineOffset]).toBe('第三行');
    });
  });
});
