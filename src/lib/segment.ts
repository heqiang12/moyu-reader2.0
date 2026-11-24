// 正文统一分段：主窗口与隐蔽窗口共用同一坐标系（progress 按字符 offset 计算）
import type { Segment } from "../api/types";

/** 句子结束符（中文 + 英文） */
const SENTENCE_END = /[。！？!?…;；]/;

/**
 * 把正文切成有序的"行段"：
 * 1. 先按原文换行分段（保留原书排版）
 * 2. 超长段落按 maxChars 软切，优先在句子结束符处断
 * 每段记录字符区间 [start, end)，主窗口按段渲染 <p>，隐蔽窗口按段翻行。
 */
export function segmentText(text: string, maxChars: number): Segment[] {
  if (!text) return [];
  const segments: Segment[] = [];
  // 按换行切块（\r\n / \r / \n），保留非空行
  const rawLines = text.split(/\r\n|\r|\n/);
  let pos = 0;

  const push = (lineText: string, startOffset: number) => {
    const trimmed = lineText.trim();
    if (!trimmed) return;
    let cursor = startOffset;
    let remaining = lineText;
    // 单行超长时软切
    while (remaining.length > maxChars) {
      const cut = findCut(remaining, maxChars);
      const piece = remaining.slice(0, cut);
      segments.push({ start: cursor, end: cursor + piece.length, text: piece.trimEnd() });
      cursor += cut;
      remaining = remaining.slice(cut);
    }
    if (remaining.trim()) {
      segments.push({ start: cursor, end: cursor + remaining.length, text: remaining.trim() });
    }
  };

  for (const line of rawLines) {
    push(line, pos);
    pos += line.length + 1; // +1 换行符（实际按 \n 长度算，多算少算不影响比例精度）
  }

  // 完全无换行的长文（整章一段）：按标点二次切
  if (segments.length <= 1 && text.length > maxChars * 2) {
    return reSplitBySentence(text);
  }
  return segments;
}

/** 在 maxChars 附近找最近的句子结束符作为切点 */
function findCut(s: string, maxChars: number): number {
  const window = s.slice(Math.floor(maxChars * 0.6), maxChars + 1);
  let best = -1;
  for (let i = window.length - 1; i >= 0; i--) {
    if (SENTENCE_END.test(window[i])) {
      best = Math.floor(maxChars * 0.6) + i + 1;
      break;
    }
  }
  return best > 0 ? best : maxChars;
}

/** 整段无换行时按句子重切（兜底） */
function reSplitBySentence(text: string): Segment[] {
  const segments: Segment[] = [];
  const re = /[^。！？!?…;；]+[。！？!?…;；]?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const piece = m[0];
    if (piece.trim()) {
      segments.push({ start: m.index, end: m.index + piece.length, text: piece.trim() });
    }
  }
  return segments.length > 0 ? segments : [{ start: 0, end: text.length, text }];
}

/**
 * 由字符 offset 计算章内 progress（0-1）。
 * 主窗口滚动和隐蔽窗口行号都换算成字符 offset 后调用它。
 */
export function progressFromOffset(offset: number, totalLength: number): number {
  if (totalLength <= 0) return 0;
  return Math.min(1, Math.max(0, offset / totalLength));
}

/** progress → 字符 offset */
export function offsetFromProgress(progress: number, totalLength: number): number {
  return Math.round(progress * totalLength);
}

/** 找包含指定 offset 的段 index */
export function segmentIndexAtOffset(segments: Segment[], offset: number): number {
  if (segments.length === 0) return 0;
  for (let i = 0; i < segments.length; i++) {
    if (offset < segments[i].end) return i;
  }
  return segments.length - 1;
}
