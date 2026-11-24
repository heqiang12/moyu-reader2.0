import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { changeBookSource, getBookInfo, getBookshelf, getChapterList, saveBook } from "../api/client";
import type { Book, BookChapter, SearchBook } from "../api/types";

export default function BookDetailPage() {
  const { bookUrl } = useParams<{ bookUrl: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const rawUrl = decodeURIComponent(bookUrl || "");

  const searchBookFromState = location.state?.searchBook as (SearchBook & { sources?: SearchBook[] }) | undefined;

  const [book, setBook] = useState<Book | null>(null);
  const [chapters, setChapters] = useState<BookChapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [inShelf, setInShelf] = useState(false);
  const [showSourceModal, setShowSourceModal] = useState(false);
  const [switchingSource, setSwitchingSource] = useState(false);
  const loadRequestRef = useRef(0);

  const loadData = async (targetUrl: string, candidateOrigin?: string) => {
    const request = ++loadRequestRef.current;
    setLoading(true);
    setError("");
    try {
      let bookInfo: Book | null = null;
      try {
        bookInfo = await getBookInfo(targetUrl);
      } catch {
        // 本地书架中没有此书
      }
      if (request !== loadRequestRef.current) return;

      if (!bookInfo && searchBookFromState) {
        bookInfo = {
          bookUrl: searchBookFromState.bookUrl,
          name: searchBookFromState.name,
          author: searchBookFromState.author,
          kind: searchBookFromState.kind,
          coverUrl: searchBookFromState.coverUrl,
          intro: searchBookFromState.intro,
          origin: searchBookFromState.origin,
          originName: searchBookFromState.originName || searchBookFromState.origin,
          durChapterIndex: 0,
          totalChapterNum: 0,
          latestChapterTitle: searchBookFromState.latestChapterTitle,
          wordCount: searchBookFromState.wordCount,
          sources: searchBookFromState.sources || [searchBookFromState],
        };
      }

      if (!bookInfo) {
        throw new Error("找不到该书籍信息");
      }

      const origin = candidateOrigin || bookInfo.origin;
      const [list, shelf] = await Promise.all([
        getChapterList(targetUrl, origin),
        getBookshelf().catch(() => [] as Book[]),
      ]);
      if (request !== loadRequestRef.current) return;

      setBook(bookInfo);
      setChapters(list);
      setInShelf(shelf.some((b) => b.bookUrl === bookInfo!.bookUrl));
    } catch (e) {
      if (request === loadRequestRef.current) setError(e instanceof Error ? e.message : "书籍详情加载失败");
    } finally {
      if (request === loadRequestRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    if (!rawUrl) return;
    loadData(rawUrl);
    return () => { loadRequestRef.current++; };
  }, [rawUrl]);

  const handleSave = async () => {
    if (!book || inShelf || saving) return;
    setSaving(true);
    try {
      const payload: SearchBook = {
        bookUrl: book.bookUrl,
        name: book.name,
        author: book.author,
        origin: book.origin,
        originName: book.originName,
        coverUrl: book.coverUrl,
        intro: book.intro,
        wordCount: book.wordCount,
        kind: book.kind,
        latestChapterTitle: book.latestChapterTitle,
        sources: book.sources,
      };
      await saveBook(payload);
      setInShelf(true);
    } catch (e) {
      alert(e instanceof Error ? e.message : "加入书架失败");
    } finally {
      setSaving(false);
    }
  };

  const startRead = async (index: number) => {
    if (!book) return;
    // 如果尚未入库，自动加书架以便记录阅读进度
    if (!inShelf) {
      try {
        await saveBook({
          bookUrl: book.bookUrl,
          name: book.name,
          author: book.author,
          origin: book.origin,
          originName: book.originName,
          coverUrl: book.coverUrl,
          intro: book.intro,
          wordCount: book.wordCount,
          kind: book.kind,
          sources: book.sources,
        });
        setInShelf(true);
      } catch {
        // 忽略静默入库异常
      }
    }
    navigate(`/read/${encodeURIComponent(book.bookUrl)}`, {
      state: { chapterIndex: index },
    });
  };

  const handleSelectSource = async (targetSource: SearchBook) => {
    if (!book || targetSource.bookUrl === book.bookUrl) {
      setShowSourceModal(false);
      return;
    }
    setSwitchingSource(true);
    try {
      if (inShelf) {
        const updated = await changeBookSource(
          book.bookUrl,
          targetSource.bookUrl,
          targetSource.origin,
          targetSource.originName || targetSource.origin
        );
        setBook(updated);
        await loadData(updated.bookUrl, updated.origin);
      } else {
        const nextBook: Book = {
          ...book,
          bookUrl: targetSource.bookUrl,
          origin: targetSource.origin,
          originName: targetSource.originName || targetSource.origin,
          coverUrl: targetSource.coverUrl || book.coverUrl,
          latestChapterTitle: targetSource.latestChapterTitle || book.latestChapterTitle,
        };
        setBook(nextBook);
        await loadData(targetSource.bookUrl, targetSource.origin);
      }
      setShowSourceModal(false);
    } catch (e) {
      alert(e instanceof Error ? e.message : "换源失败");
    } finally {
      setSwitchingSource(false);
    }
  };

  if (loading) {
    return (
      <div className="page detail-page">
        <div className="detail-loading">
          <div className="loader" />
          <p>加载中…</p>
        </div>
      </div>
    );
  }

  if (error || !book) {
    return (
      <div className="page detail-page">
        <div className="empty-state">
          <div className="empty-icon">⚠️</div>
          <h3>出错了</h3>
          <p>{error || "找不到这本书"}</p>
          <Link to="/shelf" className="btn secondary">
            回书架
          </Link>
        </div>
      </div>
    );
  }

  const cover = book.coverUrl || book.customCoverUrl;
  const intro = book.customIntro || book.intro || "暂无简介";
  const startIndex = book.durChapterIndex > 0 ? book.durChapterIndex : 0;
  const availableSources = book.sources || [];

  return (
    <div className="page detail-page">
      <header className="detail-header">
        <button onClick={() => navigate(-1)} className="btn secondary small">
          ← 返回
        </button>
        <h2>书籍详情</h2>
        <div className="detail-header-spacer" />
      </header>
      <div className="detail-content">
        <div className="detail-hero">
          <div className="book-cover large">
            {cover ? (
              <img src={cover} alt={book.name} />
            ) : (
              <div className="cover-placeholder">{(book.name || "?").slice(0, 1)}</div>
            )}
          </div>
          <div className="detail-info">
            <h1 className="detail-title">{book.name}</h1>
            <div className="detail-meta-row">
              <span>{book.author}</span>
              <span className="meta-sep">·</span>
              <span className="source-tag">{book.originName}</span>
              {availableSources.length > 1 && (
                <button
                  className="btn secondary small source-switch-btn"
                  onClick={() => setShowSourceModal(true)}
                >
                  换源 ({availableSources.length} 个可用)
                </button>
              )}
            </div>
            <div className="detail-stats">
              <span>{chapters.length} 章</span>
              {book.wordCount && (
                <>
                  <span className="meta-sep">·</span>
                  <span>{book.wordCount}</span>
                </>
              )}
            </div>
            <p className="detail-intro">{intro}</p>
            <div className="detail-actions">
              <button
                className="btn primary"
                onClick={handleSave}
                disabled={inShelf || saving}
              >
                {inShelf ? "已在书架" : saving ? "加入中…" : "加入书架"}
              </button>
              <button className="btn secondary" onClick={() => startRead(startIndex)}>
                {inShelf && book.durChapterIndex > 0 ? `继续阅读 (第 ${book.durChapterIndex + 1} 章)` : "开始阅读"}
              </button>
            </div>
          </div>
        </div>
        <div className="detail-toc">
          <h3 className="toc-title">
            目录 <span className="chapter-count">共 {chapters.length} 章</span>
          </h3>
          <div className="toc-grid">
            {chapters.map((chapter) => (
              <div
                key={chapter.index}
                className="toc-grid-item"
                onClick={() => startRead(chapter.index)}
                title={chapter.title}
              >
                {chapter.title}
              </div>
            ))}
          </div>
        </div>
      </div>

      {showSourceModal && (
        <div className="modal-backdrop" onClick={() => !switchingSource && setShowSourceModal(false)}>
          <div className="modal-card source-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>切换书源</h3>
              <button
                className="btn-icon"
                onClick={() => setShowSourceModal(false)}
                disabled={switchingSource}
              >
                ✕
              </button>
            </div>
            <div className="modal-body source-list">
              {availableSources.map((s) => {
                const isCurrent = s.bookUrl === book.bookUrl;
                return (
                  <div
                    key={s.bookUrl}
                    className={`source-option-item ${isCurrent ? "active" : ""}`}
                    onClick={() => !switchingSource && handleSelectSource(s)}
                  >
                    <div className="source-option-main">
                      <div className="source-option-name">
                        {s.originName || s.origin}
                        {isCurrent && <span className="current-badge">当前</span>}
                      </div>
                      <div className="source-option-latest">
                        最新: {s.latestChapterTitle || "未知"}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
