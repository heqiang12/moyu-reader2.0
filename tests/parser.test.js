import { describe, it, expect } from 'vitest';
import { TextParser } from '../src/modules/reader/parser.js';

describe('TextParser', () => {
  const sampleText = `第一章 开始
这是第一章的内容。
有很多段落。

第二章 发展
这是第二章的内容。
也很精彩。

第三章 结束
大结局到了。`;

  it('应该正确解析章节', () => {
    const parser = new TextParser(sampleText);
    expect(parser.getChapterCount()).toBe(3);
  });

  it('应该返回正确的章节标题', () => {
    const parser = new TextParser(sampleText);
    expect(parser.getChapterTitle(0)).toBe('第一章 开始');
    expect(parser.getChapterTitle(1)).toBe('第二章 发展');
    expect(parser.getChapterTitle(2)).toBe('第三章 结束');
  });

  it('应该返回章节内容和段落元数据', () => {
    const parser = new TextParser(sampleText);
    const data = parser.getChapterContent(0);
    expect(data.text).toContain('第一章的内容');
    expect(data.paragraphs.length).toBeGreaterThan(0);
    expect(data.paragraphs[0]).toHaveProperty('text');
    expect(data.paragraphs[0]).toHaveProperty('offset');
  });

  it('应该返回章节列表', () => {
    const parser = new TextParser(sampleText);
    const list = parser.getChapterList();
    expect(list).toHaveLength(3);
    expect(list[0]).toEqual({ index: 0, title: '第一章 开始' });
  });

  it('没有章节时应该有默认分割', () => {
    const text = Array(200).fill('测试内容行').join('\n');
    const parser = new TextParser(text);
    expect(parser.getChapterCount()).toBeGreaterThan(1);
  });
});
