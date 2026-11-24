// localStorage 封装：阅读进度、外观设置。key 统一 moyu: 前缀
import type { ReadingCursor } from "../api/types";

const PREFIX = "moyu:";

export const KEYS = {
  theme: `${PREFIX}theme`,
  fontSize: `${PREFIX}fontSize`,
  stealthSettings: `${PREFIX}stealthSettings`,
  lastReading: `${PREFIX}lastReading`,
} as const;

export const storage = {
  get<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return fallback;
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  },
  set(key: string, value: unknown): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* ignore */
    }
  },
  remove(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};

/** 章内进度持久化（旧版只存主进程内存导致重启丢失，新版必须落盘） */
export const progressKey = (bookUrl: string) => `${PREFIX}progress:${bookUrl}`;

export const loadProgress = (
  bookUrl: string,
  chapterIndex: number,
  legacyChapterIndex?: number
): number | null => {
  const saved = storage.get<number | Pick<ReadingCursor, "chapterIndex" | "progress"> | null>(progressKey(bookUrl), null);
  const progress = typeof saved === "number"
    ? (chapterIndex === legacyChapterIndex ? saved : null)
    : (saved?.chapterIndex === chapterIndex ? saved.progress : null);
  return typeof progress === "number" && Number.isFinite(progress)
    ? Math.min(1, Math.max(0, progress))
    : null;
};

export const saveProgress = (bookUrl: string, chapterIndex: number, progress: number): void => {
  storage.set(progressKey(bookUrl), { chapterIndex, progress });
};

export const saveLastReading = (cursor: ReadingCursor): void => {
  saveProgress(cursor.bookUrl, cursor.chapterIndex, cursor.progress);
  storage.set(KEYS.lastReading, cursor);
};

export const loadLastReading = (): ReadingCursor | null =>
  storage.get<ReadingCursor | null>(KEYS.lastReading, null);
