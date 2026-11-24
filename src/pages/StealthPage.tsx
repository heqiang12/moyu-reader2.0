import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { emit } from "@tauri-apps/api/event";
import {
  getBookContent,
  getBookInfo,
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
import { KEYS, loadLastReading, loadProgress, saveLastReading, storage } from "../lib/storage";

type StealthWindowState = {
  visible: boolean;
  passthrough: boolean;
};

type StealthSettings = { alpha?: number };

const DEFAULT_ALPHA = 0.55;
const MIN_ALPHA = 0.15;
const MAX_ALPHA = 0.95;
const ALPHA_STEP = 0.1;

const loadAlpha = (): number => {
  const settings = storage.get<StealthSettings>(KEYS.stealthSettings, { alpha: DEFAULT_ALPHA });
  const alpha = typeof settings?.alpha === "number" && Number.isFinite(settings.alpha) ? settings.alpha : DEFAULT_ALPHA;
  return Math.min(MAX_ALPHA, Math.max(MIN_ALPHA, alpha));
};

const saveAlpha = (alpha: number) => {
  const current = storage.get<StealthSettings>(KEYS.stealthSettings, {});
  storage.set(KEYS.stealthSettings, { ...current, alpha });
};

export default function StealthPage() {
  const [cursor, setCursor] = useState<ReadingCursor | null>(null);
  const [book, setBook] = useState<Book | null>(null);
  const [chapters, setChapters] = useState<BookChapter[]>([]);
  const [content, setContent] = useState("");
  const [segments, setSegments] = useState<Segment[]>([]);
  const [segmentIndex, setSegmentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [state, setState] = useState<StealthWindowState>({ visible: true, passthrough: false });
  const [alpha, setAlpha] = useState(loadAlpha);

  const cursorRef = useRef(cursor);
  const bookRef = useRef(book);
  const chaptersRef = useRef(chapters);
  const segmentsRef = useRef(segments);
  const contentRef = useRef(content);
  const segmentIndexRef = useRef(segmentIndex);
  const loadRequestRef = useRef(0);
  const canNavigateRef = useRef(false);

  cursorRef.current = cursor;
  bookRef.current = book;
  chaptersRef.current = chapters;
  segmentsRef.current = segments;
  contentRef.current = content;
  segmentIndexRef.current = segmentIndex;

  // 首次加载和每次重新显示都读取当前游标，复用窗口不能复用旧书状态。
  useEffect(() => {
    let active = true;
    const init = async () => {
      const request = ++loadRequestRef.current;
      canNavigateRef.current = false;
      setLoading(true);
      setError("");
      const saved = loadLastReading();
      setCursor(saved);
      if (!saved) {
        setBook(null);
        setChapters([]);
        setContent("");
        setSegments([]);
        setSegmentIndex(0);
        setLoading(false);
        return;
      }
      try {
        const info = await getBookInfo(saved.bookUrl);
        if (!active || request !== loadRequestRef.current) return;
        const list = await getChapterList(saved.bookUrl, info.origin);
        if (!active || request !== loadRequestRef.current) return;
        const progress = loadProgress(saved.bookUrl, saved.chapterIndex, info.durChapterIndex) ?? 0;
        const nextCursor = { ...saved, progress };
        cursorRef.current = nextCursor;
        bookRef.current = info;
        chaptersRef.current = list;
        setCursor(nextCursor);
        setBook(info);
        setChapters(list);
        await loadChapter(saved.bookUrl, saved.chapterIndex, info.origin, list, progress, request);
      } catch (e) {
        if (!active || request !== loadRequestRef.current) return;
        setError(e instanceof Error ? e.message : "加载失败");
        setLoading(false);
      }
    };
    const stop = listenForPage<void>("stealth:show", () => { init(); });
    init();
    return () => {
      active = false;
      loadRequestRef.current++;
      canNavigateRef.current = false;
      stop();
    };
  }, []);

  // 监听导航事件
  useEffect(() => {
    return listenForPage<string>("stealth:nav", (event) => {
      if (event.payload === "next") goNextRef.current();
      else if (event.payload === "prev") goPrevRef.current();
    });
  }, []);

  // 轮询窗口状态
  useEffect(() => {
    const poll = async () => {
      try {
        const s = await invoke<StealthWindowState>("get_stealth_state");
        setState(s);
      } catch {
        /* ignore */
      }
    };
    poll();
    const id = window.setInterval(poll, 1000);
    return () => window.clearInterval(id);
  }, []);

  // 监听透明度调节快捷键
  useEffect(() => {
    return listenForPage<number>("stealth:opacity", (event) => {
      const delta = event.payload === 1 ? -ALPHA_STEP : ALPHA_STEP;
      setAlpha((prev) => Math.min(MAX_ALPHA, Math.max(MIN_ALPHA, prev + delta)));
    });
  }, []);

  useEffect(() => { saveAlpha(alpha); }, [alpha]);

  const loadChapter = async (
    bookUrl: string,
    chapterIndex: number,
    origin: string,
    list: BookChapter[],
    progress: number,
    request = ++loadRequestRef.current
  ) => {
    if (request !== loadRequestRef.current) return false;
    canNavigateRef.current = false;
    const chapter = list.find((c) => c.index === chapterIndex);
    if (!chapter) {
      setError("章节不存在");
      setLoading(false);
      return false;
    }
    setLoading(true);
    setError("");
    try {
      const text = await getBookContent({
        bookUrl,
        chapterUrl: chapter.url,
        index: chapter.index,
        bookSourceUrl: origin,
      });
      if (request !== loadRequestRef.current) return false;
      const segs = segmentText(text, 96);
      const offset = offsetFromProgress(progress, text.length);
      const idx = segmentIndexAtOffset(segs, offset);
      contentRef.current = text;
      segmentsRef.current = segs;
      segmentIndexRef.current = idx;
      setContent(text);
      setSegments(segs);
      setSegmentIndex(idx);
      canNavigateRef.current = true;
      saveBookProgress({ bookUrl, index: chapter.index, title: chapter.title }).catch(() => {});
      return true;
    } catch (e) {
      if (request === loadRequestRef.current) setError(e instanceof Error ? e.message : "正文加载失败");
      return false;
    } finally {
      if (request === loadRequestRef.current) setLoading(false);
    }
  };

  const persist = (nextCursor: ReadingCursor) => {
    cursorRef.current = nextCursor;
    setCursor(nextCursor);
    saveLastReading(nextCursor);
    emit("stealth-cursor", nextCursor).catch(() => {});
  };

  const goNextRef = useRef<() => Promise<void>>(async () => {});
  const goPrevRef = useRef<() => Promise<void>>(async () => {});

  goNextRef.current = async () => {
    const cur = cursorRef.current;
    const bk = bookRef.current;
    const segs = segmentsRef.current;
    const txt = contentRef.current;
    const list = chaptersRef.current;
    const idx = segmentIndexRef.current;
    if (!canNavigateRef.current || !cur || !bk || segs.length === 0) return;

    if (idx < segs.length - 1) {
      const nextIdx = idx + 1;
      segmentIndexRef.current = nextIdx;
      setSegmentIndex(nextIdx);
      const progress = progressFromOffset(segs[nextIdx].start, txt.length);
      persist({ ...cur, progress });
      return;
    }

    const chapterIdx = list.findIndex((c) => c.index === cur.chapterIndex);
    if (chapterIdx >= 0 && chapterIdx < list.length - 1) {
      const nextChapter = list[chapterIdx + 1];
      const nextCursor = { bookUrl: cur.bookUrl, chapterIndex: nextChapter.index, progress: 0 };
      if (await loadChapter(cur.bookUrl, nextChapter.index, bk.origin, list, 0)) persist(nextCursor);
    }
  };

  goPrevRef.current = async () => {
    const cur = cursorRef.current;
    const bk = bookRef.current;
    const segs = segmentsRef.current;
    const txt = contentRef.current;
    const list = chaptersRef.current;
    const idx = segmentIndexRef.current;
    if (!canNavigateRef.current || !cur || !bk || segs.length === 0) return;

    if (idx > 0) {
      const nextIdx = idx - 1;
      segmentIndexRef.current = nextIdx;
      setSegmentIndex(nextIdx);
      const progress = progressFromOffset(segs[nextIdx].start, txt.length);
      persist({ ...cur, progress });
      return;
    }

    const chapterIdx = list.findIndex((c) => c.index === cur.chapterIndex);
    if (chapterIdx > 0) {
      const prevChapter = list[chapterIdx - 1];
      const nextCursor = { bookUrl: cur.bookUrl, chapterIndex: prevChapter.index, progress: 0.9999 };
      if (await loadChapter(cur.bookUrl, prevChapter.index, bk.origin, list, 0.9999)) persist(nextCursor);
    }
  };

  const handleMouseNext = (e: React.MouseEvent) => {
    e.preventDefault();
    goNextRef.current();
  };

  const handleMousePrev = (e: React.MouseEvent) => {
    e.preventDefault();
    goPrevRef.current();
  };

  const hideStealth = () => {
    invoke("hide_stealth_window").catch(() => {});
  };

  const currentChapter = chapters.find((c) => c.index === cursor?.chapterIndex);
  const prevSeg = segments[segmentIndex - 1];
  const nextSeg = segments[segmentIndex + 1];
  const textAlpha = Math.min(1, 0.85 + (MAX_ALPHA - alpha) * 0.3);

  if (!cursor && !loading) {
    return (
      <div className="stealth-page">
        <div className="stealth-empty" style={{ background: `rgba(15, 23, 42, ${alpha})` }}>
          <p style={{ color: `rgba(226, 232, 240, ${textAlpha})` }}>先去主窗口打开一本书</p>
          <button className="stealth-close" onClick={hideStealth}>
            关闭
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="stealth-page">
      <div className="stealth-drag-bar" data-tauri-drag-region />
      <button className="stealth-close-btn" onClick={hideStealth} title="隐藏">
        ×
      </button>

      <div
        className="stealth-content"
        style={{ background: `rgba(15, 23, 42, ${alpha})` }}
        onClick={handleMouseNext}
        onContextMenu={handleMousePrev}
      >
        {loading ? (
          <div className="stealth-loading" style={{ color: `rgba(203, 213, 225, ${textAlpha})` }}>
            加载中…
          </div>
        ) : error ? (
          <div className="stealth-error" style={{ color: `rgba(252, 165, 165, ${textAlpha})` }}>
            {error}
          </div>
        ) : (
          <>
            {prevSeg && (
              <div
                className="stealth-line dim"
                style={{ color: `rgba(203, 213, 225, ${textAlpha * 0.45})` }}
              >
                {prevSeg.text}
              </div>
            )}
            <div
              className="stealth-line current"
              style={{ color: `rgba(241, 245, 249, ${textAlpha})` }}
            >
              {segments[segmentIndex]?.text || ""}
            </div>
            {nextSeg && (
              <div
                className="stealth-line dim"
                style={{ color: `rgba(203, 213, 225, ${textAlpha * 0.45})` }}
              >
                {nextSeg.text}
              </div>
            )}
          </>
        )}
      </div>

      <div className="stealth-status">
        <span className="stealth-chapter-title" title={currentChapter?.title}>
          {currentChapter?.title || "未知名称"}
        </span>
        <span className="stealth-progress">
          {segmentIndex + 1}/{segments.length}
        </span>
        <span className="stealth-opacity">透明 {Math.round((1 - alpha) * 100)}%</span>
        {state.passthrough && <span className="stealth-passthrough">穿透中</span>}
      </div>
    </div>
  );
}
