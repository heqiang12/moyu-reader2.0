// 本地原生 IPC 通信封装：直接调用 Tauri 内置 Rust 内核，零网络端口暴露，极速直连
import { invoke as tauriInvoke } from "@tauri-apps/api/core";
import { listen as tauriListen, type EventCallback } from "@tauri-apps/api/event";
import type { Book, BookChapter, BookSource, ExploreKind, SearchBatch, SearchBook } from "./types";
import { KEYS, loadLastReading, progressKey, storage } from "../lib/storage";

export const isTauri = (): boolean => {
  return typeof window !== "undefined" && Boolean((window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__);
};

// 安全封装 invoke：若在普通浏览器打开时给出清晰中文指引，防止控制台抛 undefined 崩溃
const safeInvoke = async <T>(cmd: string, args?: Record<string, unknown>): Promise<T> => {
  if (!isTauri()) {
    throw new Error(
      "【环境提示】您当前是在外部 Web 浏览器 (Chrome/Edge) 中直接打开了网页。摸鱼阅读 2.0 采用纯原生 Rust 内核（无需本地 HTTP 端口与庞大 JVM），请在已启动的【桌面客户端窗口】中进行操作，或双击运行【启动本地开发调试.bat】/【摸鱼阅读2.0.exe】。"
    );
  }
  return await tauriInvoke<T>(cmd, args);
};

export const health = async (): Promise<boolean> => {
  return true;
};

// 页面卸载可能早于原生监听注册返回，迟到的监听也必须清理。
export const listenForPage = <T>(event: string, handler: EventCallback<T>): (() => void) => {
  let active = true;
  let unlisten: (() => void) | null = null;
  tauriListen<T>(event, (payload) => { if (active) handler(payload); })
    .then((stop) => {
      if (active) unlisten = stop;
      else return stop();
    })
    .catch((e) => { if (active) console.error("监听事件失败:", event, e); });
  return () => {
    active = false;
    unlisten?.();
    unlisten = null;
  };
};

// ---- 书架管理 ----
export const getBookshelf = async (): Promise<Book[]> => {
  try {
    return await safeInvoke<Book[]>("get_bookshelf");
  } catch (e) {
    console.error("获取书架失败:", e);
    return [];
  }
};

export const saveBook = async (book: SearchBook, _sources?: SearchBook[]): Promise<Book> => {
  return await safeInvoke<Book>("save_book", { book });
};

export const deleteBook = async (book: Book | SearchBook): Promise<string> => {
  await safeInvoke<void>("delete_book", { bookUrl: book.bookUrl });
  storage.remove(progressKey(book.bookUrl));
  if (loadLastReading()?.bookUrl === book.bookUrl) storage.remove(KEYS.lastReading);
  return "success";
};

export const getBookInfo = async (bookUrl: string): Promise<Book> => {
  const book = await safeInvoke<Book | null>("get_book_info", { url: bookUrl });
  if (!book) throw new Error("书籍不存在");
  return book;
};

// ---- 章节与正文 ----
export const getChapterList = async (
  bookUrl: string,
  bookSourceUrl?: string
): Promise<BookChapter[]> => {
  return await safeInvoke<BookChapter[]>("get_chapter_list", {
    bookUrl,
    bookSourceUrl: bookSourceUrl || null,
  });
};

export const getBookContent = async (params: {
  bookUrl: string;
  chapterUrl: string;
  index: number;
  cache?: number;
  refresh?: number;
  bookSourceUrl?: string;
}): Promise<string> => {
  return await safeInvoke<string>("get_book_content", {
    bookUrl: params.bookUrl,
    chapterUrl: params.chapterUrl,
    index: params.index,
    bookSourceUrl: params.bookSourceUrl || null,
  });
};

export const saveBookProgress = async (params: {
  bookUrl: string;
  index: number;
  title?: string;
}): Promise<void> => {
  await safeInvoke<void>("save_book_progress", {
    url: params.bookUrl,
    index: params.index,
    title: params.title || null,
  });
};

// ---- 书源管理 ----
export const getBookSources = async (): Promise<BookSource[]> => {
  try {
    return await safeInvoke<BookSource[]>("get_book_sources");
  } catch (e) {
    console.error("获取书源失败:", e);
    return [];
  }
};

export const saveBookSources = async (sources: unknown[]): Promise<void> => {
  await safeInvoke<void>("save_book_sources", { sources });
};

export const saveBookSource = async (source: BookSource): Promise<void> => {
  await safeInvoke<void>("save_book_source", { source });
};

export const deleteBookSource = async (bookSourceUrl: string): Promise<void> => {
  await safeInvoke<void>("delete_book_source", { bookSourceUrl });
};

export const deleteBookSources = async (sources: BookSource[]): Promise<void> => {
  for (const s of sources) {
    await safeInvoke<void>("delete_book_source", { bookSourceUrl: s.bookSourceUrl });
  }
};

export const deleteAllBookSources = async (): Promise<void> => {
  await safeInvoke<void>("delete_all_book_sources");
};

export const readRemoteSourceFile = async (url: string): Promise<string> => {
  const count = await safeInvoke<number>("import_remote_sources", { url });
  return `成功导入 ${count} 个书源`;
};

// ---- 换源 ----
export const getAvailableBookSource = async (
  bookUrl: string,
  _refresh = 0
): Promise<SearchBook[]> => {
  try {
    const book = await safeInvoke<Book | null>("get_book_info", { url: bookUrl });
    return book?.sources || [];
  } catch {
    return [];
  }
};

export const changeBookSource = async (
  bookUrl: string,
  newBookUrl: string,
  newOrigin: string,
  newOriginName: string
): Promise<Book> => {
  const updated = await safeInvoke<Book | null>("change_book_source", {
    bookUrl,
    newBookUrl,
    newOrigin,
    newOriginName,
  });
  if (!updated) throw new Error("换源更新失败");
  return updated;
};

// ---- 书源分类发现浏览 ----
export const getSourceExploreKinds = async (
  sourceUrl: string
): Promise<ExploreKind[]> => {
  return await safeInvoke<ExploreKind[]>("get_source_explore_kinds", {
    sourceUrl,
  });
};

export const exploreSourceKind = async (
  sourceUrl: string,
  kindUrl: string,
  page = 1
): Promise<SearchBook[]> => {
  return await safeInvoke<SearchBook[]>("explore_source_kind", {
    sourceUrl,
    kindUrl,
    page,
  });
};

// ---- 流式并发搜索 ----
export const searchBookSSE = (
  key: string,
  onData: (data: SearchBook[]) => void,
  onEnd: () => void,
  onError: (msg: string) => void
): (() => void) => {
  const requestId = crypto.randomUUID();
  let unlistenItem: (() => void) | null = null;
  let unlistenEnd: (() => void) | null = null;
  let cancelled = false;

  const close = () => {
    cancelled = true;
    unlistenItem?.();
    unlistenEnd?.();
    unlistenItem = null;
    unlistenEnd = null;
  };

  const init = async () => {
    try {
      if (!isTauri()) throw new Error("请在桌面客户端中搜索书籍");
      unlistenItem = await tauriListen<SearchBatch>("search:item", (event) => {
        if (!cancelled && event.payload.requestId === requestId) onData(event.payload.books);
      });
      if (cancelled) { close(); return; }
      unlistenEnd = await tauriListen<string>("search:end", (event) => {
        if (!cancelled && event.payload === requestId) {
          close();
          onEnd();
        }
      });
      if (cancelled) { close(); return; }
      await safeInvoke("start_search", { keyword: key, requestId });
    } catch (e) {
      if (cancelled) return;
      close();
      onError(e instanceof Error ? e.message : String(e));
    }
  };

  init();
  return close;
};
