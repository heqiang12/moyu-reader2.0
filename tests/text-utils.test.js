import { describe, it, expect } from 'vitest';
import { extractChapters, decodeText } from '../src/utils/text-utils.js';

describe('text-utils', () => {
  describe('extractChapters', () => {
    it('应该提取中文章节标题', () => {
      const text = `第一章 初入江湖
这是第一章的内容。

第二章 风云再起
这是第二章的内容。

第三章 大结局
这是第三章的内容。`;

      const chapters = extractChapters(text);
      expect(chapters).toHaveLength(3);
      expect(chapters[0].title).toBe('第一章 初入江湖');
      expect(chapters[1].title).toBe('第二章 风云再起');
      expect(chapters[2].title).toBe('第三章 大结局');
    });

    it('应该提取数字章节标题', () => {
      const text = `1. 开始
内容一

2. 发展
内容二

3. 结束
内容三`;

      const chapters = extractChapters(text);
      expect(chapters).toHaveLength(3);
    });

    it('没有章节时应该按行数分割', () => {
      const lines = Array(150).fill('这是一行测试文本内容。').join('\n');
      const chapters = extractChapters(lines);
      expect(chapters.length).toBeGreaterThan(1);
      expect(chapters[0].title).toContain('第');
      expect(chapters[0].title).toContain('节');
    });

    it('章节标题过长时应该忽略', () => {
      const text = `第一章 短标题
内容。

这是很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长很长的行
更多内容。`;

      const chapters = extractChapters(text);
      expect(chapters).toHaveLength(1);
    });
  });

  describe('decodeText', () => {
    it('应该解码 UTF-8 文本', () => {
      const encoder = new TextEncoder();
      const buffer = encoder.encode('你好世界').buffer;
      const text = decodeText(buffer);
      expect(text).toBe('你好世界');
    });
  });
});
