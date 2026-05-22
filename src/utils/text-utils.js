/**
 * 自动检测文本编码并解码
 */
export function decodeText(buffer) {
  const bytes = new Uint8Array(buffer);

  if (bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
    return new TextDecoder('utf-8').decode(buffer);
  }
  if (bytes[0] === 0xFF && bytes[1] === 0xFE) {
    return new TextDecoder('utf-16le').decode(buffer);
  }
  if (bytes[0] === 0xFE && bytes[1] === 0xFF) {
    return new TextDecoder('utf-16be').decode(buffer);
  }

  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    if (!text.includes('�')) {
      return text;
    }
  } catch {
    // UTF-8 解码失败
  }

  try {
    return new TextDecoder('gbk').decode(buffer);
  } catch {
    return new TextDecoder('utf-8', { fatal: false }).decode(buffer);
  }
}

/**
 * 提取章节目录
 */
export function extractChapters(text) {
  const patterns = [
    /^第[零一二三四五六七八九十百千万\d]+[章节回篇卷]/m,
    /^(?:Chapter|CHAPTER)\s+\d+/m,
    /^\d{1,4}[.、]\s*\S/m,
    /^[【\[（(]?第[零一二三四五六七八九十百千万\d]+[卷部][】\]）)]?/m,
  ];

  const chapters = [];
  const lines = text.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    for (const pattern of patterns) {
      if (pattern.test(line) && line.length < 50) {
        chapters.push({
          title: line,
          lineIndex: i,
        });
        break;
      }
    }
  }

  if (chapters.length === 0) {
    const linesPerPage = 50;
    for (let i = 0; i < lines.length; i += linesPerPage) {
      chapters.push({
        title: `第 ${Math.floor(i / linesPerPage) + 1} 节`,
        lineIndex: i,
      });
    }
  }

  return chapters;
}
