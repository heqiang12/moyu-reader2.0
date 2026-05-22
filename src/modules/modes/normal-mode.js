import { createElement } from '../../utils/dom-utils.js';
import { store } from '../../core/store.js';
import { eventBus } from '../../core/event-bus.js';
import { createChapterNav } from '../reader/chapter-nav.js';
import {
  switchChapter, syncCurrentProgress, getChapterData,
  charOffsetToParagraphIndex, getParser,
  goNextChapterFirstPage, goPrevChapterLastPage,
} from '../reader/reader.js';

/**
 * 正常阅读模式渲染器 — 整章滚动展示
 */
export function renderNormalMode(parser, chapterData) {
  const container = createElement('div', { className: 'normal-mode' });
  const state = store.getState();

  // 章节目录
  const chapters = parser.getChapterList();
  const chapterNav = createChapterNav(chapters, state.currentChapter, (index) => {
    switchChapter(index, 0);
  });
  container.appendChild(chapterNav);

  // 阅读内容区
  const content = createElement('div', { className: 'reader__content' });
  renderChapter(content, chapterData.paragraphs);
  container.appendChild(content);

  // 底部状态栏
  const footer = createElement('div', { className: 'reader__footer' });

  const pageInfo = createElement('div', { className: 'reader__page-info' });
  const chapterInfo = createElement('span', {},
    `章节: ${parser.getChapterTitle(state.currentChapter)}`
  );
  pageInfo.appendChild(chapterInfo);

  const nav = createElement('div', { className: 'reader__nav' });

  const toggleChapterBtn = createElement('button', {
    className: 'reader__nav-btn',
    title: '章节目录',
    onClick: () => {
      chapterNav.style.display = chapterNav.style.display === 'none' ? 'block' : 'none';
    },
  }, '☰');

  const prevChapterBtn = createElement('button', {
    className: 'reader__nav-btn',
    title: '上一章',
    onClick: () => {
      saveScrollOffset(content);
      goPrevChapterLastPage();
    },
  }, '◀');

  const nextChapterBtn = createElement('button', {
    className: 'reader__nav-btn',
    title: '下一章',
    onClick: () => {
      saveScrollOffset(content);
      goNextChapterFirstPage();
    },
  }, '▶');

  const stealthBtn = createElement('button', {
    className: 'reader__nav-btn',
    title: '切换到隐蔽模式',
    onClick: () => {
      // 保存当前滚动位置对应的偏移量再切换
      saveScrollOffset(content);
      store.setState({ readingMode: 'stealth' });
    },
  }, '🥷');

  const backBtn = createElement('button', {
    className: 'reader__nav-btn',
    title: '返回书架',
    onClick: () => {
      saveScrollOffset(content);
      store.setState({ page: 'bookshelf' });
    },
  }, '📚');

  nav.appendChild(toggleChapterBtn);
  nav.appendChild(prevChapterBtn);
  nav.appendChild(nextChapterBtn);
  nav.appendChild(stealthBtn);
  nav.appendChild(backBtn);

  footer.appendChild(pageInfo);
  footer.appendChild(nav);
  container.appendChild(footer);

  // 滚动进度追踪（防抖 300ms）
  let scrollTimer = null;
  function onScroll() {
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => saveScrollOffset(content), 300);
  }
  content.addEventListener('scroll', onScroll);

  // 恢复阅读位置
  requestAnimationFrame(() => {
    scrollToOffset(content, chapterData.paragraphs, state.currentCharOffset);
  });

  // 监听章节切换
  const unsub = eventBus.on('chapterChanged', ({ chapterIndex, charOffset }) => {
    const data = getChapterData();
    renderChapter(content, data.paragraphs);
    chapterInfo.textContent = `章节: ${getParser().getChapterTitle(chapterIndex)}`;
    requestAnimationFrame(() => {
      scrollToOffset(content, data.paragraphs, charOffset);
    });
  });

  // 清理
  eventBus.once('routeWillChange', () => {
    clearTimeout(scrollTimer);
    content.removeEventListener('scroll', onScroll);
    unsub();
  });

  return container;
}

/**
 * 渲染章节全部段落到容器
 */
function renderChapter(container, paragraphs) {
  container.innerHTML = '';
  for (const para of paragraphs) {
    const p = createElement('p', { 'data-offset': String(para.offset) }, para.text);
    container.appendChild(p);
  }
  if (paragraphs.length === 0) {
    container.innerHTML = '<p>暂无内容</p>';
  }
}

/**
 * 滚动到包含指定偏移量的段落
 */
function scrollToOffset(container, paragraphs, offset) {
  if (!paragraphs || paragraphs.length === 0 || offset <= 0) {
    container.scrollTop = 0;
    return;
  }
  const idx = charOffsetToParagraphIndex(paragraphs, offset);
  const targetP = container.children[idx];
  if (targetP) {
    targetP.scrollIntoView({ block: 'start' });
  }
}

/**
 * 保存当前滚动位置对应的字符偏移量
 */
function saveScrollOffset(container) {
  const paragraphs = container.querySelectorAll('p[data-offset]');
  if (paragraphs.length === 0) return;

  const scrollTop = container.scrollTop;
  let bestOffset = 0;
  let bestDist = Infinity;

  for (const p of paragraphs) {
    const top = p.offsetTop - container.offsetTop;
    const dist = Math.abs(top - scrollTop);
    if (dist < bestDist) {
      bestDist = dist;
      bestOffset = parseInt(p.dataset.offset, 10) || 0;
    }
  }

  syncCurrentProgress(bestOffset);
}
