const DB_NAME = 'moyu-reader';
const DB_VERSION = 1;

/**
 * 持久化存储层
 * - localStorage: 轻量配置数据
 * - IndexedDB: 大文本内容（书籍全文）
 */
class Storage {
  constructor() {
    this.db = null;
    this._initPromise = this._initDB();
  }

  async _initDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('books')) {
          db.createObjectStore('books', { keyPath: 'id' });
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve(this.db);
      };

      request.onerror = (event) => {
        console.error('IndexedDB 初始化失败:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  async _getDB() {
    if (!this.db) {
      await this._initPromise;
    }
    return this.db;
  }

  // localStorage 操作
  getConfig(key, defaultValue = null) {
    try {
      const value = localStorage.getItem(`config_${key}`);
      return value ? JSON.parse(value) : defaultValue;
    } catch {
      return defaultValue;
    }
  }

  setConfig(key, value) {
    try {
      localStorage.setItem(`config_${key}`, JSON.stringify(value));
    } catch (e) {
      console.error('保存配置失败:', e);
    }
  }

  // IndexedDB 操作 - 书籍全文
  async saveBookContent(id, content) {
    const db = await this._getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('books', 'readwrite');
      const store = tx.objectStore('books');
      const request = store.put({ id, content, updatedAt: Date.now() });
      request.onsuccess = () => resolve();
      request.onerror = (e) => reject(e.target.error);
    });
  }

  async getBookContent(id) {
    const db = await this._getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('books', 'readonly');
      const store = tx.objectStore('books');
      const request = store.get(id);
      request.onsuccess = (e) => resolve(e.target.result?.content || null);
      request.onerror = (e) => reject(e.target.error);
    });
  }

  async deleteBookContent(id) {
    const db = await this._getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('books', 'readwrite');
      const store = tx.objectStore('books');
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = (e) => reject(e.target.error);
    });
  }

  // 书籍元数据（localStorage）
  getBooks() {
    return this.getConfig('books', []);
  }

  saveBooks(books) {
    this.setConfig('books', books);
  }

  // 阅读进度（基于字符偏移量，精确到段落位置）
  getProgress(bookId) {
    const raw = this.getConfig(`progress_${bookId}`, { chapter: 0, charOffset: 0 });
    // 兼容旧格式
    if ('page' in raw && !('charOffset' in raw)) {
      return { chapter: raw.chapter || 0, charOffset: 0 };
    }
    return { chapter: raw.chapter || 0, charOffset: raw.charOffset || 0 };
  }

  saveProgress(bookId, chapter, charOffset) {
    this.setConfig(`progress_${bookId}`, { chapter, charOffset });
  }
}

export const storage = new Storage();
