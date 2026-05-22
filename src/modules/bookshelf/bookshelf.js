import { createElement } from '../../utils/dom-utils.js';
import { decodeText, extractChapters } from '../../utils/text-utils.js';
import { storage } from '../../core/storage.js';
import { store } from '../../core/store.js';
import { eventBus } from '../../core/event-bus.js';
import { createBookCard } from './book-card.js';

/**
 * 书架页面模块
 */
export function renderBookshelf() {
  const container = createElement('div', { className: 'bookshelf' });

  // 头部
  const header = createElement('div', { className: 'bookshelf__header' });
  const title = createElement('h1', { className: 'bookshelf__title' }, '我的书架');
  const actions = createElement('div', { className: 'bookshelf__actions' });

  const importBtn = createElement('button', {
    className: 'btn btn--primary',
    id: 'import-btn',
  }, '导入 TXT');

  const refreshBtn = createElement('button', {
    className: 'btn btn--ghost',
    title: '刷新书架',
    onClick: () => {
      grid.innerHTML = '';
      loadBooks(grid);
    },
  }, '刷新');

  const settingsBtn = createElement('button', {
    className: 'btn btn--ghost',
    onClick: () => store.setState({ page: 'settings' }),
  }, '设置');

  actions.appendChild(importBtn);
  actions.appendChild(refreshBtn);
  actions.appendChild(settingsBtn);
  header.appendChild(title);
  header.appendChild(actions);
  container.appendChild(header);

  // 导入 loading 遮罩
  const overlay = createElement('div', {
    className: 'bookshelf__loading',
    style: { display: 'none' },
  });
  const spinner = createElement('div', { className: 'bookshelf__loading-spinner' });
  const loadingText = createElement('div', { className: 'bookshelf__loading-text' }, '正在导入...');
  overlay.appendChild(spinner);
  overlay.appendChild(loadingText);
  container.appendChild(overlay);

  // 书籍网格
  const grid = createElement('div', { className: 'bookshelf__grid' });
  container.appendChild(grid);

  // 绑定导入事件（需要访问 overlay 和 grid）
  importBtn.addEventListener('click', () => handleImport(overlay, grid));

  // 加载书籍列表
  loadBooks(grid);

  return container;
}

function loadBooks(grid) {
  const books = storage.getBooks();

  if (books.length === 0) {
    const empty = createElement('div', { className: 'bookshelf__empty' });
    const emptyIcon = createElement('div', { className: 'bookshelf__empty-icon' }, '📚');
    const emptyText = createElement('div', { className: 'bookshelf__empty-text' }, '点击"导入 TXT"开始阅读');
    empty.appendChild(emptyIcon);
    empty.appendChild(emptyText);
    grid.appendChild(empty);
    return;
  }

  books.forEach(book => {
    const card = createBookCard(book, {
      onClick: () => openBook(book),
      onDelete: () => deleteBook(book.id, grid),
    });
    grid.appendChild(card);
  });
}

async function handleImport(overlay, grid) {
  try {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const filePath = await open({
      multiple: false,
      filters: [{ name: '文本文件', extensions: ['txt'] }],
    });

    if (filePath) {
      showLoading(overlay);
      try {
        const { readFile } = await import('@tauri-apps/plugin-fs');
        const bytes = await readFile(filePath);
        const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
        const content = decodeText(buffer);
        await importBook(filePath, content, grid);
      } catch (e) {
        console.error('导入失败:', e);
        alert(`导入失败: ${e.message || e}`);
      } finally {
        hideLoading(overlay);
      }
    }
  } catch (e) {
    console.warn('Tauri 对话框不可用，回退到 HTML 文件输入:', e);
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.txt';
    input.onchange = async (event) => {
      const file = event.target.files[0];
      if (file) {
        showLoading(overlay);
        try {
          const buffer = await file.arrayBuffer();
          const content = decodeText(buffer);
          await importBook(file.name, content, grid);
        } catch (e) {
          console.error('导入失败:', e);
          alert(`导入失败: ${e.message || e}`);
        } finally {
          hideLoading(overlay);
        }
      }
    };
    input.click();
  }
}

async function importBook(fileName, content, grid) {
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const chapters = extractChapters(content);
  const name = fileName.replace(/\.txt$/i, '').replace(/^.*[\\/]/, '');

  const book = {
    id,
    name,
    chapters: chapters.map(ch => ({ title: ch.title, lineIndex: ch.lineIndex })),
    totalChars: content.length,
    importedAt: Date.now(),
  };

  // 保存元数据
  const books = storage.getBooks();
  books.push(book);
  storage.saveBooks(books);

  // 保存全文内容到 IndexedDB
  await storage.saveBookContent(id, content);

  // 刷新书架
  grid.innerHTML = '';
  loadBooks(grid);
  eventBus.emit('bookImported', book);
}

function showLoading(overlay) {
  overlay.style.display = 'flex';
}

function hideLoading(overlay) {
  overlay.style.display = 'none';
}

async function openBook(book) {
  const progress = storage.getProgress(book.id);
  store.setState({
    currentBook: book,
    currentChapter: progress.chapter || 0,
    currentCharOffset: progress.charOffset || 0,
    readingMode: 'normal',
    page: 'reader',
  });
}

async function deleteBook(bookId, grid) {
  if (!confirm('确定要删除这本书吗？')) return;

  const books = storage.getBooks().filter(b => b.id !== bookId);
  storage.saveBooks(books);
  await storage.deleteBookContent(bookId);

  grid.innerHTML = '';
  loadBooks(grid);
}
