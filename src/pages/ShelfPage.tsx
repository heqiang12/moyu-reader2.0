import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { deleteBook, getBookshelf } from "../api/client";
import type { Book, ReadingCursor } from "../api/types";
import BookCard from "../components/BookCard";
import ConfirmModal from "../components/ConfirmModal";
import { loadLastReading } from "../lib/storage";

export default function ShelfPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toDelete, setToDelete] = useState<Book | null>(null);
  const [lastReading, setLastReading] = useState<ReadingCursor | null>(null);
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const list = await getBookshelf();
      setBooks(list);
      const cursor = loadLastReading();
      setLastReading(cursor && list.some((b) => b.bookUrl === cursor.bookUrl) ? cursor : null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "书架加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleBookClick = (book: Book) => {
    const encoded = encodeURIComponent(book.bookUrl);
    if (book.durChapterIndex > 0) {
      navigate(`/read/${encoded}`, { state: { chapterIndex: book.durChapterIndex } });
    } else {
      navigate(`/book/${encoded}`);
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    try {
      await deleteBook(toDelete);
      setBooks((prev) => prev.filter((b) => b.bookUrl !== toDelete.bookUrl));
      setLastReading(loadLastReading());
    } catch (e) {
      alert(e instanceof Error ? e.message : "删除失败");
    } finally {
      setToDelete(null);
    }
  };

  return (
    <div className="page shelf-page">
      <header className="topbar">
        <div className="brand">摸鱼阅读</div>
        <div className="topbar-actions">
          <Link to="/discover" className="btn secondary small">
            发现
          </Link>
          <Link to="/sources" className="btn secondary small">
            书源
          </Link>
          <Link to="/settings" className="btn secondary small">
            设置
          </Link>
        </div>
      </header>
      <main className="page-content">
        {loading && books.length === 0 ? (
          <div className="empty-state">
            <div className="loader" />
            <p>书架加载中…</p>
          </div>
        ) : error ? (
          <div className="empty-state">
            <div className="empty-icon">⚠️</div>
            <h3>加载出错</h3>
            <p>{error}</p>
            <button className="btn primary" onClick={load}>
              再试一次
            </button>
          </div>
        ) : books.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📚</div>
            <h3>书架空空如也</h3>
            <p>去搜几本想看的小说，加入书架后再来吧。</p>
            <Link to="/discover" className="btn primary">
              去发现
            </Link>
          </div>
        ) : (
          <>
            {lastReading && (
              <div
                className="continue-card"
                onClick={() =>
                  navigate(`/read/${encodeURIComponent(lastReading.bookUrl)}`, {
                    state: { chapterIndex: lastReading.chapterIndex },
                  })
                }
              >
                <div className="continue-meta">
                  <span className="continue-label">继续上次阅读</span>
                  <span className="continue-arrow">→</span>
                </div>
                <div className="continue-title">
                  {books.find((b) => b.bookUrl === lastReading.bookUrl)?.name ||
                    (lastReading.bookUrl.length > 40
                      ? `${lastReading.bookUrl.slice(0, 40)}…`
                      : lastReading.bookUrl)}
                </div>
                <div className="continue-chapter">第 {lastReading.chapterIndex + 1} 章</div>
              </div>
            )}
            <div className="book-grid">
              {books.map((book) => (
                <BookCard
                  key={book.bookUrl}
                  book={book}
                  onClick={() => handleBookClick(book)}
                  onDelete={() => setToDelete(book)}
                />
              ))}
            </div>
          </>
        )}
      </main>
      {toDelete && (
        <ConfirmModal
          title="删除书籍"
          message={`确定要删除《${toDelete.name}》吗？进度会一起没掉。`}
          onConfirm={confirmDelete}
          onCancel={() => setToDelete(null)}
        />
      )}
    </div>
  );
}
