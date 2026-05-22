import { createElement } from '../../utils/dom-utils.js';

/**
 * 章节目录导航组件
 */
export function createChapterNav(chapters, currentChapter, onSelect) {
  const nav = createElement('div', {
    className: 'chapter-nav',
    style: {
      position: 'absolute',
      top: '32px',
      left: '0',
      width: '240px',
      height: 'calc(100% - 32px)',
      background: 'var(--color-bg-secondary)',
      borderRight: '1px solid var(--color-border)',
      overflowY: 'auto',
      zIndex: '100',
      display: 'none',
    },
  });

  chapters.forEach((chapter, index) => {
    const item = createElement('div', {
      className: 'chapter-nav__item',
      style: {
        padding: '8px 16px',
        fontSize: '13px',
        cursor: 'pointer',
        color: index === currentChapter ? 'var(--color-accent)' : 'var(--color-text)',
        background: index === currentChapter ? 'rgba(233, 69, 96, 0.1)' : 'transparent',
        borderBottom: '1px solid var(--color-border)',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      },
      onClick: () => {
        onSelect(index);
        nav.style.display = 'none';
      },
    }, chapter.title);
    nav.appendChild(item);
  });

  return nav;
}
