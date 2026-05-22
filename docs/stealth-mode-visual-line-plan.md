# 隐蔽模式视觉行实现方案

## 目标

点击正常阅读页的隐蔽按钮后，应用应进入真正的单行悬浮阅读状态：

- 整个 Tauri 窗口缩成一条约 `800 x 32` 的无边框文本条。
- 页面内只显示一行小说内容，不显示标题栏、目录、页脚、按钮等阅读器 UI。
- 这“一行”按当前窗口宽度、字号、字体计算，是用户实际看到的一行，而不是小说原文的自然换行。
- 鼠标按住文本条可拖动整个桌面窗口到任意位置。
- 鼠标滚轮向下/向上切换下一条/上一条视觉行。
- 双击文本条或按 `Escape` 恢复正常阅读模式，并尽量还原进入前的窗口尺寸和位置。

## 当前问题

当前 `src/modules/modes/stealth-mode.js` 主要是在页面内部创建一个 fixed 文本条：

- 窗口本身仍是正常模式尺寸，例如 `800 x 600`。
- 拖动的是 DOM 元素，不是 Tauri 原生窗口。
- 初始文本把整页内容用空格拼成一长行，并不是真正的一行。
- `router.forceRender()` 渲染后才触发 `routeChange`，会导致新注册的 stealth cleanup 立刻执行，监听和透明 class 可能被误清理。

因此隐蔽模式需要从“页面内伪装”改成“原生窗口变形 + 单行内容渲染”。

## 推荐实现结构

建议拆成三个职责：

1. `stealth-mode.js`
   负责渲染单行文本、滚轮翻视觉行、双击/Escape 退出。

2. 新增 `src/modules/modes/stealth-window.js`
   负责进入/退出隐蔽模式时操作 Tauri 窗口：保存窗口状态、缩小尺寸、置顶、恢复尺寸和位置。

3. 新增或内置 `visual-line-builder`
   负责把当前分页内容按容器宽度、字体、字号切成视觉行。

## Tauri 权限

文件：`src-tauri/capabilities/default.json`

当前已有：

- `core:window:allow-set-size`
- `core:window:allow-set-position`
- `core:window:allow-set-always-on-top`
- `core:window:allow-set-decorations`

建议补充：

- `core:window:allow-start-dragging`
- 可能需要：`core:window:allow-outer-size`
- 可能需要：`core:window:allow-outer-position`

如果后续要读取显示器尺寸、默认放到底部，也可能需要 monitor 相关权限；第一版可以先不做默认贴底，只保持当前位置或用固定位置。

## 窗口变形方案

新增文件：`src/modules/modes/stealth-window.js`

建议 API：

```js
export async function enterStealthWindow() {}
export async function exitStealthWindow() {}
export async function startStealthDrag() {}
```

进入隐蔽模式时：

1. `getCurrentWindow()`。
2. 保存当前窗口位置和尺寸到模块级变量，或保存到 store/localStorage。
3. 设置窗口尺寸为 `800 x 32`。
4. 设置 `alwaysOnTop: true`。
5. 设置 `resizable: false`。
6. 可选：设置阴影/装饰/任务栏行为，第一版可不碰。

退出隐蔽模式时：

1. 恢复进入前的尺寸和位置。
2. 恢复 `alwaysOnTop: false`。
3. 恢复 `resizable: true`。

容错原则：

- 这些 Tauri API 在浏览器开发模式下可能不存在，必须 `try/catch`。
- 如果读取窗口尺寸失败，退出时退回默认 `800 x 600`。
- 不要因为窗口 API 失败阻断前端渲染。

## 拖动方案

隐蔽模式不要再通过 `mousemove` 改 DOM 的 `left/top`。

在 `.stealth-mode` 的 `mousedown` 中：

```js
container.addEventListener('mousedown', async (event) => {
  if (event.button !== 0) return;
  await startStealthDrag();
});
```

`startStealthDrag()` 内部调用 Tauri 的 `window.startDragging()`。这样拖动的是系统窗口，行为最自然，也符合“随意拖动”的预期。

注意：

- 不要给 `.stealth-mode` 使用 `-webkit-app-region: drag`，否则可能吞掉 wheel/dblclick 等事件。
- 用 Tauri API 主动开始拖动更可控。

## 视觉行切分方案

这是本方案的核心。

目标不是按 `\n` 切，而是按“当前隐蔽条可显示宽度”切。比如窗口宽 800、左右 padding 共 24、字号 13，则有效文本宽度约 776。每条视觉行都应尽量填满这段宽度，但不能溢出。

建议实现：

1. 从 `pagination.getCurrentContent()` 获取当前页文本。
2. 先按自然段落清洗：
   - 去掉空行。
   - 多个空白压成一个空格。
3. 创建一个隐藏测量元素：
   - `position: fixed`
   - `visibility: hidden`
   - `white-space: nowrap`
   - 字体、字号、字重、letter-spacing 与 `.stealth-mode__text` 一致。
4. 遍历每个段落，将文字逐步追加到当前行。
5. 每次追加后用 `measureEl.getBoundingClientRect().width` 判断是否超过可用宽度。
6. 超过时把上一个可容纳的文本提交为一条视觉行，然后从当前字符继续。
7. 英文/数字连续词可以按词切；中文可以按字符切。第一版可统一按字符切，简单稳定。

推荐函数形态：

```js
function buildVisualLines(text, options) {
  const {
    maxWidth,
    fontFamily,
    fontSize,
    letterSpacing = '0px',
  } = options;

  return lines;
}
```

为了性能，隐蔽模式每次进入当前页时构建一次视觉行即可。滚轮只移动 `lineOffset`，不需要每次重新测量。只有以下场景需要重建：

- 翻到下一页/上一页。
- 字号/字体设置变化。
- 窗口宽度变化。第一版隐蔽窗口固定宽度，可以先不监听 resize。

## 翻行与进度

隐蔽模式内部维护：

```js
let lineOffset = 0;
let visualLines = buildCurrentPageVisualLines();
```

滚轮向下：

1. 如果 `lineOffset < visualLines.length - 1`，`lineOffset++`。
2. 否则调用 `pagination.nextPage()`。
3. 下一页成功后重建视觉行，`lineOffset = 0`。
4. 保存阅读进度。

滚轮向上：

1. 如果 `lineOffset > 0`，`lineOffset--`。
2. 否则调用 `pagination.prevPage()`。
3. 上一页成功后重建视觉行，`lineOffset = visualLines.length - 1`。
4. 保存阅读进度。

文本显示：

```js
textEl.textContent = visualLines[lineOffset] || '';
```

建议先不把 `lineOffset` 存入持久化进度，只保存页码。以后如果希望恢复到具体视觉行，可以新增 `stealthLineOffset`。

## Router 清理时机

当前 `src/core/router.js` 的 `_render()` 是先清空并渲染新 view，然后 emit `routeChange`。这会让新 view 注册的 `routeChange` cleanup 也被触发。

建议调整为：

```js
async _render(page) {
  const renderFn = this.routes.get(page);
  if (!renderFn) return;

  eventBus.emit('routeWillChange', page);

  const app = document.getElementById('app');
  if (!app) return;

  app.innerHTML = '';
  const view = await renderFn();
  // append view...
  this.currentView = page;
  eventBus.emit('routeChange', page);
}
```

然后把各模式里的 cleanup 监听从 `routeChange` 改成 `routeWillChange`。

如果不想引入新事件，也可以在 `_render()` 最开头先 emit 旧的 `routeChange`，再清空和渲染。但 `routeWillChange` 语义更清晰。

## CSS 调整

文件：`src/style/modes/stealth-mode.css`

隐蔽模式窗口已经是 `800 x 32`，所以页面里的 `.stealth-mode` 应铺满整个窗口：

```css
.stealth-mode {
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: center;
  padding: 0 12px;
  overflow: hidden;
  cursor: grab;
}
```

建议移除：

- `position: fixed`
- `left/right/top/bottom`
- DOM 拖动相关样式依赖

`.stealth-mode__text`：

```css
.stealth-mode__text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: clip;
  user-select: none;
}
```

视觉行本身已经切好了，`text-overflow: ellipsis` 不是必须。第一版可以用 `clip`，避免给用户一种后面还有被截断内容的错觉。

## 进入/退出流程

正常模式点击隐蔽按钮：

1. `store.setState({ readingMode: 'stealth' })`
2. `modeManager` 触发 `router.forceRender()`
3. `reader.js` 根据 `readingMode` 调用 `renderStealthMode`
4. `renderStealthMode` 调用 `enterStealthWindow()`
5. 渲染 `.stealth-mode` 和第一条视觉行

隐蔽模式退出：

1. 双击或 `Escape`
2. 调用 `store.setState({ readingMode: 'normal' })`
3. cleanup 中调用 `exitStealthWindow()`
4. `router.forceRender()` 回到正常阅读 UI

注意：退出恢复窗口最好放在 stealth cleanup 中，这样无论是双击、Esc、切页、返回书架，都能尝试恢复。

## 建议修改文件清单

- `src/modules/modes/stealth-mode.js`
  重写为视觉行渲染、滚轮翻行、调用窗口拖动。

- `src/modules/modes/stealth-window.js`
  新增，封装 Tauri 窗口变形、恢复、拖动。

- `src/style/modes/stealth-mode.css`
  改成铺满 32px 窗口的单行布局。

- `src/core/router.js`
  调整 cleanup 触发时机，新增 `routeWillChange`。

- `src/modules/modes/normal-mode.js`
  cleanup 监听改成 `routeWillChange`。

- `src-tauri/capabilities/default.json`
  增加原生拖动、读取窗口状态相关权限。

## 验收标准

功能验收：

- 点击隐蔽按钮后，窗口真实缩成单行条。
- 隐蔽模式只显示一行文本，无标题栏、页脚、目录、按钮。
- 文本行按当前宽度切分，滚轮每次切到下一条视觉行。
- 长中文段落不会只显示开头后大片省略，而是能逐行读完。
- 拖动文本条会移动整个桌面窗口。
- 双击和 `Escape` 能恢复正常模式。
- 恢复后窗口尺寸和位置接近进入前状态。

技术验收：

- 浏览器开发模式下不会因为缺少 Tauri API 崩溃。
- 切换模式多次后，不出现重复 keydown/wheel/mouse 监听。
- `npm test` 通过。
- `npm run build` 通过。

## 后续增强

第一版稳定后，可以继续做：

- 保存隐蔽窗口位置，下次进入时恢复。
- 设置项增加隐蔽条宽度、高度、默认位置。
- 保存视觉行 offset，实现恢复到上次隐蔽阅读的具体行。
- 支持鼠标移入时轻微加深背景，移出时更透明。
- 支持老板键直接进入/退出隐蔽模式或隐藏窗口。
