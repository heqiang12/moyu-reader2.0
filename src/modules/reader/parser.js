import { extractChapters } from '../../utils/text-utils.js';

/**
 * TXT 文件解析器
 */
export class TextParser {
  constructor(content) {
    this.content = content;
    this.lines = content.split('\n');
    this.chapters = extractChapters(content);
  }

  getChapterCount() {
    return this.chapters.length;
  }

  getChapterTitle(index) {
    return this.chapters[index]?.title || `第 ${index + 1} 节`;
  }

  /**
   * 获取章节内容（全文 + 段落元数据）
   * @returns {{ text: string, paragraphs: { text: string, offset: number }[] }}
   */
  getChapterContent(index) {
    const chapter = this.chapters[index];
    if (!chapter) return { text: '', paragraphs: [] };

    const startLine = chapter.lineIndex;
    const endLine = index < this.chapters.length - 1
      ? this.chapters[index + 1].lineIndex
      : this.lines.length;

    const chapterText = this.lines.slice(startLine, endLine).join('\n');

    // 构建段落元数据（非空行）
    const rawLines = this.lines.slice(startLine, endLine);
    const paragraphs = [];
    let offset = 0;
    for (let i = 0; i < rawLines.length; i++) {
      const line = rawLines[i];
      if (i > 0) offset += 1; // \n 分隔符
      if (line.trim()) {
        paragraphs.push({ text: line, offset });
      }
      offset += line.length;
    }

    return { text: chapterText, paragraphs };
  }

  getChapterList() {
    return this.chapters.map((ch, i) => ({
      index: i,
      title: ch.title,
    }));
  }
}
