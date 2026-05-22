# 项目审查问题修复方案

## 目标

这份文档针对当前整体审查发现的问题，给出一版可按步骤落地的修复方案。重点覆盖：

- 隐蔽模式阅读进度与正常模式不同步。
- 隐蔽模式进入窗口变形存在异步竞态。
- 桌面端 TXT 导入没有统一编码检测。
- 老板键没有真正使用系统全局快捷键。
- 隐蔽条样式和视觉行测量存在偏差。

建议按本文顺序处理。前两项直接影响核心阅读体验，优先级最高。

## 1. 隐蔽模式进度同步与跨章节翻页

### 问题

文件：`src/modules/modes/stealth-mode.js`

当前隐蔽模式内部直接调用 `pagination.nextPage()` 和 `pagination.prevPage()`。它只调用 `storage.saveProgress()`，没有同步 `store.currentPage`。退出隐蔽模式时，`reader.js` 会根据 store 中的旧 `currentPage` 重建 pagination，导致回到正常模式后跳回进入隐蔽模式前的页码。

另外，隐蔽模式翻到当前章节最后一页后不会进入下一章，和正常阅读模式行为不一致。

### 推荐修复

优先让隐蔽模式复用 `reader.js` 里已经存在的翻页能力：

- `goNextPage()`
- `goPrevPage()`
- `switchChapter()`

不过现有 `goNextPage()` 和 `goPrevPage()` 以“页”为单位，而隐蔽模式需要“视觉行”为单位。所以建议新增两个较底层的 reader 状态同步函数，而不是让 stealth 直接改 store 和 storage：

文件：`src/modules/reader/reader.js`

新增：

```js
export function syncCurrentProgress() {
  if (!pagination) return;

  const page = pagination.getCurrentPage();
  const state = store.getState();

  store.setState({ currentPage: page });
  storage.saveProgress(state.currentBook.id, state.currentChapter, page);
}

export function goNextChapterFirstPage() {
  const state = store.getState();
  const totalChapters = parser.getChapterCount();

  if (state.currentChapter >= totalChapters - 1) return false;

  switchChapter(state.currentChapter + 1);
  return true;
}

export function goPrevChapterLastPage() {
  const state = store.getState();
  if (state.currentChapter <= 0) return false;

  const prevChapter = state.currentChapter - 1;
  const pages = parser.getChapterContent(prevChapter);
  pagination.pages = pages;
  pagination.setPage(pagination.getTotalPages() - 1);

  const page = pagination.getCurrentPage();
  store.setState({
    currentChapter: prevChapter,
    currentPage: page,
  });
  storage.saveProgress(state.currentBook.id, prevChapter, page);
  eventBus.emit('pageChanged', page);

  return true;
}
```

然后在 `stealth-mode.js` 中：

- 当前页内翻视觉行时只改 `lineOffset`。
- 翻到视觉行末尾后，如果 `pagination.nextPage()` 成功，调用 `syncCurrentProgress()`。
- 如果 `pagination.nextPage()` 失败，调用 `goNextChapterFirstPage()`，再重建视觉行。
- 上一页同理，失败时调用 `goPrevChapterLastPage()`。

### 伪代码

```js
function goNextLine() {
  if (lineOffset < visualLines.length - 1) {
    lineOffset++;
    return;
  }

  if (pagination.nextPage()) {
    syncCurrentProgress();
    rebuildLines(0);
    return;
  }

  if (goNextChapterFirstPage()) {
    rebuildLines(0);
  }
}

function goPrevLine() {
  if (lineOffset > 0) {
    lineOffset--;
    return;
  }

  if (pagination.prevPage()) {
    syncCurrentProgress();
    rebuildLines('last');
    return;
  }

  if (goPrevChapterLastPage()) {
    rebuildLines('last');
  }
}
```

### 验收

- 隐蔽模式滚轮读到下一页后，双击回正常模式，正常模式停在同一页。
- 隐蔽模式读到当前章节末尾后继续滚轮，可以进入下一章。
- 隐蔽模式从章节第一页第一行向上滚轮，可以回到上一章最后一页最后一行。
- 书架进度条和再次打开书籍的进度与隐蔽模式阅读结果一致。

## 2. 隐蔽窗口异步竞态与视觉行宽度

### 问题

文件：

- `src/modules/modes/stealth-mode.js`
- `src/modules/modes/stealth-window.js`

`renderStealthMode()` 中调用 `enterStealthWindow()` 后立即构建视觉行。窗口尺寸变更是异步的，`window.innerWidth` 可能仍是旧宽度。快速切换模式时，也可能出现 enter 和 exit 顺序交错，把窗口留在错误尺寸。

### 推荐修复

把隐蔽模式渲染拆成两个阶段：

1. 先渲染容器和一个空文本元素。
2. 等窗口进入隐蔽尺寸完成后，在下一帧测量并构建视觉行。

文件：`src/modules/modes/stealth-mode.js`

建议 `renderStealthMode` 保持同步返回 DOM，但内部启动异步初始化：

```js
let disposed = false;

async function initStealth() {
  await enterStealthWindow();
  await nextFrame();
  if (disposed) return;

  rebuildLines(0);
  updateText();
}

initStealth();
```

新增工具：

```js
function nextFrame() {
  return new Promise(resolve => requestAnimationFrame(() => resolve()));
}
```

cleanup 中：

```js
disposed = true;
exitStealthWindow();
```

文件：`src/modules/modes/stealth-window.js`

增加一个操作序号，避免 enter/exit 乱序：

```js
let transitionId = 0;

export async function enterStealthWindow() {
  const id = ++transitionId;
  // await window operations...
  if (id !== transitionId) return;
}

export async function exitStealthWindow() {
  const id = ++transitionId;
  // await restore operations...
  if (id !== transitionId) return;
}
```

更简单的第一版也可以只在 `stealth-mode.js` 中使用 `disposed` 防止已销毁后继续更新 DOM。窗口状态竞态后续再强化。

### 验收

- 从不同宽度的正常窗口进入隐蔽模式，第一行切分都符合 `800px` 隐蔽条宽度。
- 快速双击进入/退出或连续按 Esc，不会把窗口卡在 `800 x 32`。
- 浏览器开发模式下没有 Tauri API 时，页面仍不崩溃。

## 3. 桌面端 TXT 导入统一编码检测

### 问题

文件：`src/modules/bookshelf/bookshelf.js`

浏览器 fallback 路径使用 `file.arrayBuffer()` + `decodeText(buffer)`，能处理 UTF-8 / UTF-16 / GBK。但 Tauri 桌面路径使用 `readTextFile(filePath)`，绕过了 `decodeText()`。GBK TXT 在真实桌面应用中可能乱码或读取失败。

### 推荐修复

把 Tauri 路径改成读取二进制 bytes，再统一走 `decodeText()`。

Tauri v2 fs 插件可优先尝试 `readFile`：

```js
const { readFile } = await import('@tauri-apps/plugin-fs');
const bytes = await readFile(filePath);
const content = decodeText(bytes.buffer);
await importBook(filePath, content);
```

如果 `readFile` 返回的是 `Uint8Array`，`bytes.buffer` 可以工作，但要注意 offset。更稳妥：

```js
const buffer = bytes.buffer.slice(
  bytes.byteOffset,
  bytes.byteOffset + bytes.byteLength
);
const content = decodeText(buffer);
```

同时调整权限：

文件：`src-tauri/capabilities/default.json`

当前有：

- `fs:allow-read-text-file`

建议增加或替换为：

- `fs:allow-read-file`

保留 `readTextFile` 权限也可以，但修复后主要使用 `readFile`。

### 验收

- UTF-8 无 BOM TXT 导入正常。
- UTF-8 BOM TXT 导入正常。
- GBK 中文 TXT 导入不乱码。
- 浏览器 fallback 导入仍正常。

## 4. 老板键接入真正的全局快捷键

### 问题

文件：`src/modules/boss-key/boss-key.js`

当前老板键只监听 `document.keydown`。窗口失焦、最小化或隐藏后不会响应，和“全局老板键”的产品目标不一致。

`package.json` 已有 `@tauri-apps/plugin-global-shortcut`，但 Rust 侧没有对应依赖和 plugin 初始化。

### 推荐修复

### Rust 侧

文件：`src-tauri/Cargo.toml`

增加：

```toml
tauri-plugin-global-shortcut = "2"
```

文件：`src-tauri/src/lib.rs`

在 builder 中初始化：

```rust
.plugin(tauri_plugin_global_shortcut::Builder::new().build())
```

### 权限

文件：`src-tauri/capabilities/default.json`

增加 global shortcut 插件需要的权限。具体权限名以本项目生成 schema 为准，通常类似：

```json
"global-shortcut:default"
```

如果 Tauri 报权限错误，根据错误提示补充更细的 allow 权限。

### 前端

文件：`src/modules/boss-key/boss-key.js`

优先注册全局快捷键，失败时保留 DOM keydown fallback：

```js
async init() {
  try {
    const { register } = await import('@tauri-apps/plugin-global-shortcut');
    await register('CommandOrControl+`', () => this.toggle());
    this.usingGlobalShortcut = true;
  } catch (e) {
    document.addEventListener('keydown', this.handleKeydown);
  }
}
```

注意事项：

- Windows/Linux 使用 `Ctrl+``，macOS 如果未来支持，可用 `CommandOrControl+``。
- 退出应用时最好 unregister。当前应用生命周期简单，可以先不做，后续补 `destroy()`。
- `toggle()` 目前依赖 `this.isVisible`，如果用户通过窗口关闭按钮隐藏窗口，这个状态可能不同步。可以在隐藏/显示路径统一 emit 或改成调用 `window.isVisible()` 判断真实状态。

### 验收

- 应用窗口聚焦时，老板键可隐藏/显示。
- 应用窗口失焦时，老板键仍可隐藏。
- 窗口隐藏后，老板键仍可显示回来。
- 浏览器开发模式下仍可用 DOM keydown fallback。

## 5. 隐蔽条背景与视觉行测量偏差

### 问题

文件：

- `src/modules/modes/stealth-mode.js`
- `src/style/modes/stealth-mode.css`

当前背景和透明度设置在 `.stealth-mode__text` 上，只覆盖文字 flex 区域，不一定覆盖整条窗口。视觉行测量使用 `window.innerWidth - 24`，但 `.stealth-mode__text` 还有左右 padding `4px + 4px`，实际可用宽度少 8px，可能末尾轻微裁切。

### 推荐修复

把背景、透明度、字体等视觉配置放到 `.stealth-mode` 容器上，文本元素只负责承载文字。

文件：`src/modules/modes/stealth-mode.js`

```js
const container = createElement('div', {
  className: 'stealth-mode',
  style: {
    background: config.bgColor,
    color: config.fontColor,
    fontSize: `${config.fontSize}px`,
    fontFamily: config.fontFamily,
    opacity: config.opacity,
  },
});
```

`textEl` 不再设置 `background` 和 `opacity`。

视觉行测量不要硬编码 `window.innerWidth - 24`。在容器已经挂载后，读取真实文本元素宽度：

```js
function getTextMaxWidth(textEl) {
  return textEl.getBoundingClientRect().width;
}
```

如果需要测量时文本为空，也可以临时用：

```js
const maxWidth = Math.max(0, textEl.clientWidth);
```

CSS 中建议移除 `.stealth-mode__text` 的左右 padding，统一由容器控制内边距：

```css
.stealth-mode {
  padding: 0 12px;
}

.stealth-mode__text {
  padding: 0;
}
```

### 验收

- 隐蔽窗口整条都有背景色和透明度，不是只有文字区域有背景。
- 长行末尾不会被裁掉最后一个字。
- 改字号、字体颜色、背景透明度后隐蔽模式显示一致。

## 6. 测试补强建议

当前测试能通过，但部分测试没有直接覆盖真实模块。建议补以下测试。

### 隐蔽模式状态同步测试

新增或更新：`tests/modes.test.js`

目标：

- 模拟 pagination 翻页后，确认调用了 `store.setState({ currentPage })` 或等效同步函数。
- 模拟章节末尾，确认会调用跨章节逻辑。

如果直接测试 DOM + Tauri import 太重，可以先把纯逻辑抽出来，例如：

```js
export function moveVisualLine(direction, context) {}
```

然后单测这个纯函数。

### 视觉行切分测试

建议把 `buildVisualLines` 导出，或移动到：

`src/modules/modes/visual-lines.js`

测试：

- 中文长段落能被切成多行。
- 每行宽度不超过 mock maxWidth。
- 空文本返回空数组或 `['']`，行为固定。

### 编码导入测试

补 `decodeText` 的 GBK fixture。当前环境如果 TextDecoder 支持 `gbk`，可构造一段 GBK bytes 验证。

### 老板键测试

测试重点不要只测硬编码快捷键字符串，而要 mock：

- `@tauri-apps/plugin-global-shortcut.register`
- `@tauri-apps/api/window.getCurrentWindow`

确认 `init()` 优先注册 global shortcut，失败时才 fallback 到 document keydown。

## 7. 推荐落地顺序

1. 修复隐蔽模式进度同步和跨章节翻页。
2. 修复隐蔽窗口异步初始化与视觉行重建时机。
3. 修复隐蔽条背景、透明度、测量宽度。
4. 修复 Tauri 导入编码路径。
5. 接入 global shortcut 老板键。
6. 补测试。
7. 跑验证：

```bash
npm test
npm run build
npm run tauri dev
```

如果本机 Rust 环境可用，再跑：

```bash
cd src-tauri
cargo check
```

## 8. 最小验收清单

完成后至少手动验证这些流程：

- 导入 UTF-8 TXT，进入正常阅读，切换隐蔽模式。
- 隐蔽模式滚轮读过多页，双击回正常模式，页码不回退。
- 隐蔽模式跨章节继续阅读。
- 隐蔽窗口可拖动整个窗口。
- 快速进入/退出隐蔽模式，窗口不会卡成单行。
- 导入 GBK TXT 不乱码。
- 应用失焦后老板键仍可隐藏窗口。
- 窗口隐藏后老板键可恢复显示。
