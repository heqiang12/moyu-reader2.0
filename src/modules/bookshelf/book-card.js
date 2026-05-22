import { createElement } from '../../utils/dom-utils.js';
import { storage } from '../../core/storage.js';

/**
 * 书籍卡片组件
 */
export function createBookCard(book, { onClick, onDelete }) {
  const progress = storage.getProgress(book.id);
  const totalChapters = book.chapters?.length || 1;
  const progressPercent = Math.round((progress.chapter / totalChapters) * 100);

  const card = createElement('div', {
    className: 'book-card',
    onClick,
  });

  const deleteBtn = createElement('button', {
    className: 'book-card__delete',
    title: '删除',
    onClick: (e) => {
      e.stopPropagation();
      onDelete();
    },
  }, '✕');

  const title = createElement('div', { className: 'book-card__title' }, book.name);
  const meta = createElement('div', { className: 'book-card__meta' },
    `${formatSize(book.totalChars)} · ${totalChapters} 章`
  );

  const progressContainer = createElement('div', { className: 'book-card__progress' });
  const progressBar = createElement('div', {
    className: 'book-card__progress-bar',
    style: { width: `${progressPercent}%` },
  });
  progressContainer.appendChild(progressBar);

  const chapterTitle = book.chapters?.[progress.chapter]?.title;
  const progressText = chapterTitle
    ? createElement('div', { className: 'book-card__progress-text' }, chapterTitle)
    : null;

  card.appendChild(deleteBtn);
  card.appendChild(title);
  card.appendChild(meta);
  card.appendChild(progressContainer);
  if (progressText) card.appendChild(progressText);

  return card;
}

function formatSize(chars) {
  if (chars < 10000) return `${chars}字`;
  return `${(chars / 10000).toFixed(1)}万字`;
}
