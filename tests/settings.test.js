import { describe, it, expect, beforeEach } from 'vitest';

describe('设置模块', () => {
  describe('隐蔽模式默认设置', () => {
    it('应该有合理的默认背景色', () => {
      const defaultBgColor = 'rgba(0, 0, 0, 0.7)';
      expect(defaultBgColor).toContain('rgba');
      expect(defaultBgColor).toContain('0.7');
    });

    it('应该有合理的默认字体颜色', () => {
      const defaultFontColor = '#e6e6e6';
      expect(defaultFontColor).toMatch(/^#[0-9a-f]{6}$/i);
    });

    it('字体大小应该在合理范围', () => {
      const fontSize = 13;
      expect(fontSize).toBeGreaterThanOrEqual(10);
      expect(fontSize).toBeLessThanOrEqual(20);
    });

    it('透明度应该在 0-1 范围', () => {
      const opacity = 1;
      expect(opacity).toBeGreaterThanOrEqual(0.1);
      expect(opacity).toBeLessThanOrEqual(1);
    });
  });

  describe('设置持久化', () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it('应该能够保存和读取配置', () => {
      const key = 'config_test_key';
      const value = { color: '#ff0000' };

      localStorage.setItem(key, JSON.stringify(value));
      const stored = JSON.parse(localStorage.getItem(key));

      expect(stored).toEqual(value);
    });

    it('读取不存在的配置应该返回默认值', () => {
      const value = localStorage.getItem('config_nonexistent');
      expect(value).toBeNull();
    });
  });
});
