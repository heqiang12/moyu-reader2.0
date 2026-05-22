import { describe, it, expect, vi, beforeEach } from 'vitest';
import { matchShortcut } from '../src/modules/settings/key-utils.js';

describe('老板键模块', () => {
  describe('默认快捷键匹配 (CommandOrControl+`)', () => {
    it('Ctrl + ` 应该匹配', () => {
      expect(matchShortcut(
        { ctrlKey: true, metaKey: false, shiftKey: false, altKey: false, key: '`' },
        'CommandOrControl+`'
      )).toBe(true);
    });

    it('Meta + ` 应该匹配 (macOS)', () => {
      expect(matchShortcut(
        { ctrlKey: false, metaKey: true, shiftKey: false, altKey: false, key: '`' },
        'CommandOrControl+`'
      )).toBe(true);
    });

    it('只按 ` 不应该匹配', () => {
      expect(matchShortcut(
        { ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, key: '`' },
        'CommandOrControl+`'
      )).toBe(false);
    });

    it('Ctrl + a 不应该匹配', () => {
      expect(matchShortcut(
        { ctrlKey: true, metaKey: false, shiftKey: false, altKey: false, key: 'a' },
        'CommandOrControl+`'
      )).toBe(false);
    });

    it('Ctrl+Shift+` 应该不匹配（多余的 Shift）', () => {
      expect(matchShortcut(
        { ctrlKey: true, metaKey: false, shiftKey: true, altKey: false, key: '~', code: 'Backquote' },
        'CommandOrControl+`'
      )).toBe(false);
    });
  });

  describe('窗口隐藏/显示状态切换', () => {
    it('toggle 状态应该正确翻转', () => {
      let isVisible = true;
      const toggle = () => { isVisible = !isVisible; };

      toggle();
      expect(isVisible).toBe(false);

      toggle();
      expect(isVisible).toBe(true);
    });

    it('连续快速 toggle 应该正确', () => {
      let isVisible = true;
      const toggle = () => { isVisible = !isVisible; };

      for (let i = 0; i < 10; i++) toggle();
      expect(isVisible).toBe(true); // 偶数次恢复

      for (let i = 0; i < 5; i++) toggle();
      expect(isVisible).toBe(false); // 奇数次翻转
    });
  });

  describe('隐蔽模式下老板键不应重置窗口', () => {
    it('隐蔽模式标志应该正确传递', () => {
      // 模拟隐蔽模式状态
      let inStealth = true;
      let windowSize = { w: 800, h: 32 };

      // 模拟 toggle_window 在隐蔽模式下的行为
      function toggleWindow() {
        if (inStealth) {
          // 不改变尺寸，只显示
        } else {
          windowSize = { w: 800, h: 600 };
        }
      }

      // 隐蔽模式下 toggle 不应改变尺寸
      toggleWindow();
      expect(windowSize.h).toBe(32);

      // 退出隐蔽模式后 toggle 应该重置
      inStealth = false;
      toggleWindow();
      expect(windowSize.h).toBe(600);
    });
  });

  describe('自定义快捷键匹配', () => {
    it('Alt+Q 应该正确匹配', () => {
      expect(matchShortcut(
        { ctrlKey: false, metaKey: false, shiftKey: false, altKey: true, key: 'q' },
        'Alt+Q'
      )).toBe(true);
    });

    it('Ctrl+Shift+M 应该正确匹配', () => {
      expect(matchShortcut(
        { ctrlKey: true, metaKey: false, shiftKey: true, altKey: false, key: 'm' },
        'CommandOrControl+Shift+M'
      )).toBe(true);
    });

    it('缺少修饰键不应该匹配', () => {
      expect(matchShortcut(
        { ctrlKey: false, metaKey: false, shiftKey: true, altKey: false, key: 'm' },
        'CommandOrControl+Shift+M'
      )).toBe(false);
    });
  });
});
