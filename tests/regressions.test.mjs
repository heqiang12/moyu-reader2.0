import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { beforeEach, test } from "node:test";
import ts from "typescript";

async function sourceModule(path, imports = {}) {
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  let { outputText } = ts.transpileModule(source, {
    fileName: path,
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  });
  for (const [name, url] of Object.entries(imports)) {
    outputText = outputText.replaceAll(JSON.stringify(name), JSON.stringify(url));
  }
  return `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`;
}

const storageURL = await sourceModule("../src/lib/storage.ts");
const { KEYS, storage, progressKey, loadProgress, saveLastReading, loadLastReading } = await import(storageURL);
const clientURL = await sourceModule("../src/api/client.ts", {
  "../lib/storage": storageURL,
  "@tauri-apps/api/core": import.meta.resolve("@tauri-apps/api/core"),
  "@tauri-apps/api/event": import.meta.resolve("@tauri-apps/api/event"),
});
const { searchBookSSE, deleteBook } = await import(clientURL);
const { progressFromOffset, offsetFromProgress } = await import(await sourceModule("../src/lib/segment.ts"));

function nativeStub(listenGate, invokeHook) {
  let id = 0;
  const callbacks = new Map();
  const listeners = new Map();
  const requests = [];
  globalThis.window = {
    __TAURI_INTERNALS__: {
      transformCallback(callback) { callbacks.set(++id, callback); return id; },
      async invoke(command, args) {
        const result = await invokeHook?.(command, args);
        if (result !== undefined) return result;
        if (command === "plugin:event|listen") {
          const eventId = ++id;
          listeners.set(eventId, { event: args.event, callback: callbacks.get(args.handler) });
          await listenGate?.();
          return eventId;
        }
        if (command === "start_search") requests.push(args);
      },
    },
    __TAURI_EVENT_PLUGIN_INTERNALS__: {
      unregisterListener(_event, eventId) { listeners.delete(eventId); },
    },
  };
  return {
    requests, listeners,
    emit(event, payload) {
      for (const listener of [...listeners.values()]) {
        if (listener.event === event) listener.callback({ event, payload });
      }
    },
  };
}

const settle = () => new Promise((resolve) => setImmediate(resolve));

// 仅控制组件的 hook 状态及异步时序；真实 DOM/原生行为仍由 qa-real 验证。
function pageHooks() {
  const slots = [];
  const effects = [];
  let index = 0;
  globalThis.__pageHooks = {
    useState(initial) {
      const slot = index++;
      if (!(slot in slots)) slots[slot] = typeof initial === "function" ? initial() : initial;
      return [slots[slot], (next) => { slots[slot] = typeof next === "function" ? next(slots[slot]) : next; }];
    },
    useRef(initial) {
      const slot = index++;
      return slots[slot] ??= { current: initial };
    },
    useEffect(effect) {
      const slot = index++;
      if (!(slot in slots)) { slots[slot] = true; effects.push(effect); }
    },
  };
  return { effects, render(component) { index = 0; return component(); } };
}
const hooksURL = `data:text/javascript,${encodeURIComponent(`
  export const useState = (...args) => globalThis.__pageHooks.useState(...args);
  export const useRef = (...args) => globalThis.__pageHooks.useRef(...args);
  export const useEffect = (...args) => globalThis.__pageHooks.useEffect(...args);
`)}`;
const pageImports = {
  react: hooksURL,
  "react/jsx-runtime": import.meta.resolve("react/jsx-runtime"),
  "../api/client": clientURL,
  "../lib/storage": storageURL,
  "../lib/segment": await sourceModule("../src/lib/segment.ts"),
  "@tauri-apps/api/core": import.meta.resolve("@tauri-apps/api/core"),
  "@tauri-apps/api/event": import.meta.resolve("@tauri-apps/api/event"),
};
function findElement(tree, match) {
  if (!tree || typeof tree !== "object") return null;
  if (Array.isArray(tree)) return tree.map((item) => findElement(item, match)).find(Boolean) ?? null;
  return match(tree) ? tree : findElement(tree.props?.children, match);
}
const byClass = (tree, className) => findElement(tree, (node) => node.props?.className === className);

beforeEach(() => {
  const values = new Map();
  globalThis.localStorage = {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, value); },
    removeItem(key) { values.delete(key); },
  };
  nativeStub();
});

test("阅读位置同时保存章节与章内进度，不带入其它章节", () => {
  const cursor = { bookUrl: "https://book.test/1", chapterIndex: 2, progress: 0.4 };
  saveLastReading(cursor);
  assert.deepEqual(loadLastReading(), cursor);
  assert.equal(loadProgress(cursor.bookUrl, 2), 0.4);
  assert.equal(loadProgress(cursor.bookUrl, 3), null);
});

test("旧数字进度仅恢复到数据库确认的旧章节", () => {
  storage.set(progressKey("book"), 0.42);
  assert.equal(loadProgress("book", 2, 2), 0.42);
  assert.equal(loadProgress("book", 3, 2), null);
});

test("损坏或越界进度不会用于阅读定位", () => {
  for (const [progress, expected] of [[-1, 0], [2, 1], ["bad", null], [null, null]]) {
    storage.set(progressKey("book"), { chapterIndex: 2, progress });
    assert.equal(loadProgress("book", 2), expected);
  }
  localStorage.setItem(progressKey("book"), "1e1000");
  assert.equal(loadProgress("book", 2, 2), null);
});

test("删除书籍清理它的续读及进度，不影响其它书", async () => {
  saveLastReading({ bookUrl: "a", chapterIndex: 1, progress: 0.2 });
  storage.set(progressKey("b"), { chapterIndex: 2, progress: 0.7 });
  await deleteBook({ bookUrl: "b" });
  assert.equal(loadLastReading().bookUrl, "a");
  assert.equal(storage.get(progressKey("b"), null), null);
  await deleteBook({ bookUrl: "a" });
  assert.equal(storage.get(KEYS.lastReading, null), null);
  assert.equal(storage.get(progressKey("a"), null), null);
});

test("数据库删除失败时保留阅读位置", async () => {
  const cursor = { bookUrl: "a", chapterIndex: 1, progress: 0.2 };
  saveLastReading(cursor);
  nativeStub(undefined, (command) => {
    if (command === "delete_book") throw new Error("删除失败");
  });
  await assert.rejects(deleteBook({ bookUrl: "a" }), /删除失败/);
  assert.deepEqual(loadLastReading(), cursor);
  assert.equal(loadProgress("a", 1), 0.2);
});

test("搜索批次和结束事件按请求隔离，并在结束时卸载监听", async () => {
  const native = nativeStub();
  const received = [];
  let ended = 0;
  const closeOld = searchBookSSE("旧关键词", () => {}, () => {}, assert.fail);
  await settle();
  closeOld();
  const closeNew = searchBookSSE("新关键词", (batch) => received.push(...batch), () => ended++, assert.fail);
  await settle();
  assert.equal(native.requests.length, 2);
  const [oldRequest, newRequest] = native.requests;
  assert.equal(typeof newRequest.requestId, "string");
  assert.notEqual(oldRequest.requestId, newRequest.requestId);
  native.emit("search:item", { requestId: oldRequest.requestId, books: [{ name: "旧书" }] });
  native.emit("search:end", oldRequest.requestId);
  assert.deepEqual(received, []);
  assert.equal(ended, 0);
  native.emit("search:item", { requestId: newRequest.requestId, books: [{ name: "新书" }] });
  native.emit("search:end", newRequest.requestId);
  assert.deepEqual(received, [{ name: "新书" }]);
  assert.equal(ended, 1);
  assert.equal(native.listeners.size, 0);
  closeNew();
});

test("监听尚未注册完成就取消搜索，不泄漏监听或启动请求", async () => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const native = nativeStub(() => gate);
  const close = searchBookSSE("取消", assert.fail, assert.fail, assert.fail);
  close();
  release();
  await settle();
  assert.equal(native.requests.length, 0);
  assert.equal(native.listeners.size, 0);
});

test("监听或启动搜索失败会清理监听并显示错误，而非宣称搜索完成", async () => {
  for (const failedCommand of ["plugin:event|listen", "start_search"]) {
    const native = nativeStub(undefined, (command, args) => {
      if (command === failedCommand && (command === "start_search" || args.event === "search:end")) {
        throw new Error("测试搜索错误");
      }
    });
    const errors = [];
    searchBookSSE("失败", assert.fail, assert.fail, (message) => errors.push(message));
    await settle();
    assert.deepEqual(errors, ["测试搜索错误"]);
    assert.equal(native.listeners.size, 0);
  }
});

test("字符进度往返不因浮点误差退到上一段", () => {
  for (let offset = 0; offset <= 2118; offset++) {
    assert.equal(offsetFromProgress(progressFromOffset(offset, 2118), 2118), offset);
  }
});

test("前端、锁文件与桌面配置版本一致", async () => {
  const json = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), "utf8"));
  const [pkg, lock, config] = await Promise.all([
    json("../package.json"), json("../package-lock.json"), json("../src-tauri/tauri.conf.json"),
  ]);
  assert.equal(pkg.version, config.version);
  assert.equal(lock.version, config.version);
  assert.equal(lock.packages[""].version, config.version);
});

async function stealthFixture(contentHook) {
  const hooks = pageHooks();
  const native = nativeStub(undefined, (command, args) => {
    if (command === "get_book_info") return { bookUrl: args.url, name: args.url, origin: "source", durChapterIndex: 0 };
    if (command === "get_chapter_list") return [{ index: 0, url: "chapter", title: args.bookUrl, bookUrl: args.bookUrl }];
    if (command === "get_book_content") return contentHook?.(args.bookUrl) ?? (args.bookUrl === "a" ? "甲一。\n甲二。" : "乙一。\n乙二。");
    if (command === "get_stealth_state") return { visible: true, passthrough: false };
  });
  window.setInterval = () => 1;
  window.clearInterval = () => {};
  const { default: Page } = await import(await sourceModule("../src/pages/StealthPage.tsx", pageImports));
  hooks.render(Page);
  // StrictMode：setup → cleanup → setup，原生监听注册可以延迟返回。
  hooks.effects.map((effect) => effect()).forEach((cleanup) => cleanup?.());
  const cleanups = hooks.effects.map((effect) => effect());
  await settle();
  return { ...native, render: () => hooks.render(Page), close: () => cleanups.forEach((cleanup) => cleanup?.()) };
}

test("StrictMode 的延迟监听注册不会令一次透明度事件执行两次", async () => {
  saveLastReading({ bookUrl: "a", chapterIndex: 0, progress: 0 });
  const page = await stealthFixture();
  try {
    page.emit("stealth:opacity", -1);
    const opacity = byClass(page.render(), "stealth-opacity");
    assert.equal(opacity.props.children.join(""), "透明 35%");
  } finally { page.close(); }
});

test("隐蔽窗重开读取当前书和位置，过期正文响应不能覆盖新书", async () => {
  let holdOld = false;
  let releaseOld;
  const oldContent = new Promise((resolve) => { releaseOld = resolve; });
  saveLastReading({ bookUrl: "a", chapterIndex: 0, progress: 0 });
  const page = await stealthFixture((bookUrl) => holdOld && bookUrl === "a" ? oldContent : undefined);
  const current = () => byClass(page.render(), "stealth-line current")?.props.children;
  try {
    assert.equal(current(), "甲一。");
    saveLastReading({ bookUrl: "b", chapterIndex: 0, progress: 0 });
    page.emit("stealth:show", null);
    await settle();
    assert.equal(current(), "乙一。");
    saveLastReading({ bookUrl: "b", chapterIndex: 0, progress: 4 / 7 });
    page.emit("stealth:show", null);
    await settle();
    assert.equal(current(), "乙二。");
    holdOld = true;
    saveLastReading({ bookUrl: "a", chapterIndex: 0, progress: 0 });
    page.emit("stealth:show", null);
    await settle();
    saveLastReading({ bookUrl: "b", chapterIndex: 0, progress: 0 });
    page.emit("stealth:show", null);
    await settle();
    releaseOld("甲一。\n甲二。");
    await settle();
    assert.equal(current(), "乙一。");
  } finally { page.close(); }
});

test("详情的旧挂载加载结果不能覆盖首次加书成功反馈", async () => {
  const hooks = pageHooks();
  const pending = [];
  let chapterRequests = 0;
  for (let i = 0; i < 2; i++) {
    let resolve;
    const promise = new Promise((done) => { resolve = done; });
    pending.push({ promise, resolve });
  }
  const candidate = { bookUrl: "b", name: "B", author: "author", origin: "source" };
  nativeStub(undefined, (command) => {
    if (command === "get_book_info") return null;
    if (command === "get_bookshelf") return [];
    if (command === "get_chapter_list") return pending[chapterRequests++].promise;
    if (command === "save_book") return candidate;
  });
  globalThis.__pageBook = candidate;
  const routerURL = `data:text/javascript,${encodeURIComponent(`
    export const Link = "a";
    export const useParams = () => ({ bookUrl: "b" });
    export const useLocation = () => ({ state: { searchBook: globalThis.__pageBook } });
    export const useNavigate = () => () => {};
  `)}`;
  const { default: Page } = await import(await sourceModule("../src/pages/BookDetailPage.tsx", {
    ...pageImports, "react-router-dom": routerURL,
  }));
  hooks.render(Page);
  const effect = hooks.effects[0];
  const cleanup = effect();
  await settle();
  cleanup?.();
  const finalCleanup = effect();
  try {
    await settle();
    assert.equal(chapterRequests, 2);
    pending[1].resolve([{ index: 0, url: "chapter", title: "chapter" }]);
    await settle();
    const add = () => findElement(hooks.render(Page), (node) => node.type === "button" && /书架/.test(node.props.children));
    await add().props.onClick();
    assert.equal(add().props.children, "已在书架");
    pending[0].resolve([{ index: 0, url: "chapter", title: "old response" }]);
    await settle();
    assert.equal(add().props.children, "已在书架");
    assert.equal(add().props.disabled, true);
  } finally { finalCleanup?.(); }
});

test("原生拖动权限仅授予隐蔽窗", async () => {
  const directory = new URL("../src-tauri/capabilities/", import.meta.url);
  const capabilities = await Promise.all((await readdir(directory)).filter((name) => name.endsWith(".json"))
    .map(async (name) => JSON.parse(await readFile(new URL(name, directory), "utf8"))));
  const drag = capabilities.filter((capability) => capability.permissions.includes("core:window:allow-start-dragging"));
  assert.ok(drag.length > 0, "缺少原生拖动权限");
  for (const capability of drag) assert.deepEqual(capability.windows, ["stealth"]);
});
