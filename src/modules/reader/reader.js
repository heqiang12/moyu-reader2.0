import { createElement } from '../../utils/dom-utils.js';
import { storage } from '../../core/storage.js';
import { store } from '../../core/store.js';
import { eventBus } from '../../core/event-bus.js';
import { TextParser } from './parser.js';
import { createChapterNav } from './chapter-nav.js';
import { renderNormalMode } from '../modes/normal-mode.js';
import { renderStealthMode } from '../modes/stealth-mode.js';

let parser = null;
let currentChapterData = null;

/**
 * 阅读器页面模块
 */
export async function renderReader() {
  const { currentBook, currentChapter, currentCharOffset, readingMode } = store.getState();

  if (!currentBook) {
    store.setState({ page: 'bookshelf' });
    return createElement('div');
  }

  const content = await storage.getBookContent(currentBook.id);
  if (!content) {
    alert('书籍内容加载失败');
    store.setState({ page: 'bookshelf' });
    return createElement('div');
  }

  parser = new TextParser(content);
  currentChapterData = parser.getChapterContent(currentChapter);

  if (readingMode === 'stealth') {
    return renderStealthMode(parser, currentChapterData);
  }

  return renderNormalMode(parser, currentChapterData);
}

/**
 * 切换章节
 */
export function switchChapter(chapterIndex, charOffset = 0) {
  if (!parser) return;

  currentChapterData = parser.getChapterContent(chapterIndex);

  store.setState({
    currentChapter: chapterIndex,
    currentCharOffset: charOffset,
  });

  storage.saveProgress(store.getState().currentBook.id, chapterIndex, charOffset);
  eventBus.emit('chapterChanged', { chapterIndex, charOffset });
}

/**
 * 同步当前阅读进度到 store 和 storage
 */
export function syncCurrentProgress(charOffset) {
  const state = store.getState();
  store.setState({ currentCharOffset: charOffset });
  storage.saveProgress(state.currentBook.id, state.currentChapter, charOffset);
}

/**
 * 获取当前章节数据
 */
export function getChapterData() {
  return currentChapterData;
}

/**
 * 在段落列表中查找包含指定字符偏移量的段落索引
 */
export function charOffsetToParagraphIndex(paragraphs, offset) {
  if (!paragraphs || paragraphs.length === 0) return 0;
  if (offset <= 0) return 0;

  // 二分查找最后一个 offset <= target 的段落
  let lo = 0;
  let hi = paragraphs.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (paragraphs[mid].offset <= offset) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  return lo;
}

/**
 * 跳到下一章开头
 */
export function goNextChapterFirstPage() {
  const state = store.getState();
  const totalChapters = parser.getChapterCount();
  if (state.currentChapter >= totalChapters - 1) return false;
  switchChapter(state.currentChapter + 1, 0);
  return true;
}

/**
 * 跳到上一章末尾
 */
export function goPrevChapterLastPage() {
  const state = store.getState();
  if (state.currentChapter <= 0) return false;

  const prevChapter = state.currentChapter - 1;
  const data = parser.getChapterContent(prevChapter);
  // 跳到最后一段
  const lastOffset = data.paragraphs.length > 0
    ? data.paragraphs[data.paragraphs.length - 1].offset
    : 0;
  switchChapter(prevChapter, lastOffset);
  return true;
}

export function getParser() {
  return parser;
}
