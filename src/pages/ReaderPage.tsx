import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Link, useLocation, useParams } from "react-router-dom";
import {
  getBookContent,
  getBookInfo,
  getBookshelf,
  getChapterList,
  listenForPage,
  saveBookProgress,
} from "../api/client";
import type { Book, BookChapter, ReadingCursor, Segment } from "../api/types";
import {
  offsetFromProgress,
  progressFromOffset,
  segmentIndexAtOffset,
  segmentText,
} from "../lib/segment";
import { KEYS, loadProgress, saveLastReading, storage } from "../lib/storage";

type Theme = "light" | "dark";

export default function ReaderPage() {
  const { bookUrl } = useParams<{ bookUrl: string }>();
  const location = useLocation();
  const rawUrl = decodeURIComponent(bookUrl || "");
  const initialIndex =
    (location.state as { chapterIndex?: number } | null)?.chapterIndex ?? null;

  const [book, setBook] = useState<Book | null>(null);
  const [chapters, setChapters] = useState<BookChapter[]>([]);
  const [chapterIndex, setChapterIndex] = useState<number | null>(initialIndex);
  const [content, setContent] = useState("");
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryKey, setRetryKey] = useState(0);
  const [showToc, setShowToc] = useState(false);
  const [fontSize, setFontSize] = useState(() => storage.get(KEYS.fontSize, 18));
  const [theme, setTheme] = useState<Theme>(() => storage.get(KEYS.theme, "light"));

  const bodyRef = useRef<HTMLDivElement>(null);
  const paragraphRefs = useRef<(HTMLParagraphElement | null)[]>([]);
  const isRestoring = useRef(false);
  const pendingProgressRef = useRef<number | null>(null);

  // 初始化书籍与目录
  useEffect(() => {
    if (!rawUrl) return;
    let alive = true;
    const load = async () => {
      try {
        const shelf = await getBookshelf().catch(() => [] as Book[]);
        const fromShelf = shelf.find((b) => b.bookUrl === rawUrl);
        const info = fromShelf || (await getBookInfo(rawUrl));
        const list = await getChapterList(rawUrl, info.origin);
        if (!alive) return;
        setBook(info);
        setChapters(list);
        setChapterIndex((prev) => {
          if (prev !== null) return prev;
          return info.durChapterIndex > 0 ? info.durChapterIndex : 0;
        });
      } catch (e) {
        if (!alive) return;
        setError(e instanceof Error ? e.message : "书籍加载失败");
        setLoading(false);
      }
    };
    load();
    return () => {
      alive = false;
    };
  }, [rawUrl]);

  // 加载章节正文
  useEffect(() => {
    if (!book || chapters.length === 0 || chapterIndex === null) return;
    const chapter = chapters.find((c) => c.index === chapterIndex);
    if (!chapter) return;

    let alive = true;
    const load = async () => {
      isRestoring.current = true;
      setLoading(true);
      setError("");
      const progress = pendingProgressRef.current ?? loadProgress(rawUrl, chapter.index, book.durChapterIndex) ?? 0;
      pendingProgressRef.current = null;
      try {
        const text = await getBookContent({
          bookUrl: rawUrl,
          chapterUrl: chapter.url,
          index: chapter.index,
          bookSourceUrl: book.origin,
        });
        if (!alive) return;
        pendingProgressRef.current = progress;
        setContent(text);
        setSegments(segmentText(text, 96));
        saveBookProgress({ bookUrl: rawUrl, index: chapter.index, title: chapter.title }).catch(() => {});
        saveLastReading({ bookUrl: rawUrl, chapterIndex: chapter.index, progress });
      } catch (e) {
        if (!alive) return;
        setError(e instanceof Error ? e.message : "正文加载失败");
      } finally {
        if (alive) setLoading(false);
      }
    };
    load();
    return () => {
      alive = false;
    };
  }, [book, chapters, chapterIndex, rawUrl, retryKey]);

  const scrollToProgress = useCallback((progress: number) => {
    const body = bodyRef.current;
    if (!body) return;
    const segIdx = segmentIndexAtOffset(segments, offsetFromProgress(progress, content.length));
    const el = paragraphRefs.current[segIdx];
    const top = progress > 0 && el
      ? body.scrollTop + el.getBoundingClientRect().top - body.getBoundingClientRect().top - 40
      : 0;
    isRestoring.current = true;
    body.scrollTo({ top: Math.max(0, top), behavior: "instant" });
    window.setTimeout(() => { isRestoring.current = false; }, 120);
  }, [segments, content.length]);

  // 恢复滚动位置
  useEffect(() => {
    if (loading || error || segments.length === 0 || chapterIndex === null) return;
    const saved = pendingProgressRef.current ?? loadProgress(rawUrl, chapterIndex) ?? 0;
    pendingProgressRef.current = null;
    scrollToProgress(saved);
  }, [loading, error, chapterIndex, rawUrl, scrollToProgress]);

  // 主题持久化
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    storage.set(KEYS.theme, theme);
  }, [theme]);

  // 字号持久化
  useEffect(() => {
    storage.set(KEYS.fontSize, fontSize);
  }, [fontSize]);

  const currentProgress = useCallback(() => {
    if (!bodyRef.current || segments.length === 0) return 0;
    const body = bodyRef.current;
    const threshold = body.getBoundingClientRect().top + 60;
    let currentIndex = 0;
    for (let i = 0; i < paragraphRefs.current.length; i++) {
      const el = paragraphRefs.current[i];
      if (el && el.getBoundingClientRect().top <= threshold) {
        currentIndex = i;
      } else if (el) {
        break;
      }
    }
    const seg = segments[currentIndex];
    return seg ? progressFromOffset(seg.start, content.length) : 0;
  }, [segments, content.length]);

  const handleScroll = useCallback(() => {
    if (loading || error || chapterIndex === null || isRestoring.current) return;
    saveLastReading({ bookUrl: rawUrl, chapterIndex, progress: currentProgress() });
  }, [loading, error, chapterIndex, rawUrl, currentProgress]);

  const currentChapter = chapters.find((c) => c.index === chapterIndex);
  const chapterOrder = currentChapter
    ? chapters.findIndex((c) => c.index === currentChapter.index) + 1
    : 0;

  const goChapter = (targetIndex: number) => {
    setChapterIndex(targetIndex);
    setShowToc(false);
  };

  const prevChapter = () => {
    const idx = chapters.findIndex((c) => c.index === chapterIndex);
    if (idx > 0) setChapterIndex(chapters[idx - 1].index);
  };

  const nextChapter = () => {
    const idx = chapters.findIndex((c) => c.index === chapterIndex);
    if (idx >= 0 && idx < chapters.length - 1) setChapterIndex(chapters[idx + 1].index);
  };

  const changeFontSize = (delta: number) => {
    setFontSize((s) => Math.min(32, Math.max(12, s + delta)));
  };

  const openStealth = async () => {
    if (!book || loading || error || chapterIndex === null) return;
    const cursor: ReadingCursor = { bookUrl: rawUrl, chapterIndex, progress: currentProgress() };
    saveLastReading(cursor);
    try {
      await invoke("open_stealth_window");
    } catch (e) {
      alert(e instanceof Error ? e.message : "打开隐蔽窗口失败");
    }
  };

  // 两个窗口都按正文字符进度定位，不能使用滚动高度比例。
  useEffect(() => {
    return listenForPage<ReadingCursor>("stealth-cursor", (event) => {
      const c = event.payload;
      if (c.bookUrl !== rawUrl) return;
      if (c.chapterIndex !== chapterIndex) {
        pendingProgressRef.current = c.progress;
        setChapterIndex(c.chapterIndex);
      } else {
        scrollToProgress(c.progress);
      }
    });
  }, [rawUrl, chapterIndex, scrollToProgress]);

  if (!book && !loading && error) {
    return (
      <div className="reader-page">
        <div className="empty-state">
          <div className="empty-icon">⚠️</div>
          <h3>出错了</h3>
          <p>{error}</p>
          <Link to="/shelf" className="btn primary">
            回书架
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="reader-page">
      <header className="reader-header">
        <div className="reader-header-left">
          <Link to="/shelf" className="btn secondary small">
            ← 书架
          </Link>
          <div className="reader-book-info">
            <h2>{book?.name || "加载中…"}</h2>
            <span>
              {currentChapter?.title || ""} ({chapterOrder}/{chapters.length})
            </span>
          </div>
        </div>
        <div className="reader-settings">
          <button className="btn secondary small" onClick={() => setShowToc(true)}>
            目录
          </button>
          <button className="btn secondary small stealth-btn" onClick={openStealth} disabled={loading || Boolean(error)}>
            隐蔽阅读
          </button>
          <div className="font-size-control">
            <button onClick={() => changeFontSize(-1)} disabled={fontSize <= 12}>
              A-
            </button>
            <span>{fontSize}px</span>
            <button onClick={() => changeFontSize(1)} disabled={fontSize >= 32}>
              A+
            </button>
          </div>
          <button
            className="btn secondary small"
            onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
          >
            {theme === "light" ? "暗色" : "浅色"}
          </button>
        </div>
      </header>

      <div className="reader-body" ref={bodyRef} onScroll={handleScroll}>
        {loading ? (
          <div className="reader-loading">
            <div className="loader" />
            <p>正文加载中…</p>
          </div>
        ) : error ? (
          <div className="reader-error">
            <p>{error}</p>
            <button className="btn primary" onClick={() => setRetryKey((k) => k + 1)}>
              重试
            </button>
          </div>
        ) : (
          <article className="reader-article" style={{ fontSize: `${fontSize}px` }}>
            <h1 className="chapter-title">{currentChapter?.title}</h1>
            {segments.map((seg, i) => (
              <p
                key={i}
                ref={(el) => { paragraphRefs.current[i] = el; }}
                className="reader-paragraph"
              >
                {seg.text}
              </p>
            ))}
          </article>
        )}
      </div>

      <footer className="reader-footer">
        <button className="btn secondary small" onClick={prevChapter} disabled={chapterOrder <= 1}>
          上一章
        </button>
        <span>
          {chapterOrder} / {chapters.length}
        </span>
        <button
          className="btn secondary small"
          onClick={nextChapter}
          disabled={chapterOrder >= chapters.length}
        >
          下一章
        </button>
      </footer>

      {showToc && (
        <>
          <div className="reader-overlay" onClick={() => setShowToc(false)} />
          <aside className="reader-sidebar">
            <div className="toc-panel">
              <div className="toc-header">
                <h3>目录</h3>
                <button className="btn secondary small" onClick={() => setShowToc(false)}>
                  关闭
                </button>
              </div>
              <div className="toc-list">
                {chapters.map((chapter) => (
                  <div
                    key={chapter.index}
                    className={`toc-item ${chapter.index === chapterIndex ? "active" : ""}`}
                    onClick={() => goChapter(chapter.index)}
                  >
                    <span className="toc-index">{chapter.index + 1}</span>
                    <span className="toc-title">{chapter.title}</span>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
