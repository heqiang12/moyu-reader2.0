# 隐蔽模式自定义按键修复方案

## 目标

这份文档针对隐蔽模式下自定义按键和老板键 fallback 的代码审查结果，给出可落地的修复方案。重点解决：

- 隐蔽模式“上一页键 / 下一页键”可以配置成保留键或互相冲突。
- 隐蔽模式按键命中后没有阻止浏览器默认行为。
- 老板键 DOM fallback 的组合键匹配存在误判。
- 现有测试没有覆盖真实快捷键实现。

建议优先修复前两项，它们直接影响隐蔽模式可用性。

## 1. 隐蔽模式按键配置增加校验

### 问题

文件：

- `src/modules/settings/settings.js`
- `src/modules/modes/stealth-mode.js`

当前 `createKeySetting()` 会直接保存用户按下的 `e.key`：

```js
storage.setConfig(key, e.key);
```

因此用户可以把隐蔽模式翻页键设置成：

- `Escape`
- `ArrowUp`
- `ArrowDown`
- 与另一项相同的按键

但 `stealth-mode.js` 的处理顺序是固定的：

```js
if (e.key === 'ArrowDown') {
  goNextLine();
} else if (e.key === 'ArrowUp') {
  goPrevLine();
} else if (e.key === keyNext) {
  goNextPage();
} else if (e.key === keyPrev) {
  goPrevPage();
} else if (e.key === 'Escape') {
  store.setState({ readingMode: 'normal' });
}
```

这会导致配置看起来保存成功，但实际行为不符合用户预期。例如把“下一页键”设置为 `ArrowUp` 后，按键仍然只会上一视觉行。

### 推荐修复

新增一个校验函数，集中判断隐蔽模式单键是否合法。

建议位置：

- 简单版：放在 `settings.js` 文件内。
- 更好版：新增 `src/modules/settings/key-utils.js`，便于测试。

建议保留键：

```js
const RESERVED_STEALTH_KEYS = new Set([
  'Escape',
  'ArrowUp',
  'ArrowDown',
]);
```

建议校验：

```js
export function validateStealthSingleKey(nextKey, prevKey) {
  if (!nextKey || !prevKey) return { valid: false, message: '按键不能为空' };
  if (RESERVED_STEALTH_KEYS.has(nextKey)) return { valid: false, message: '下一页键不能使用保留键' };
  if (RESERVED_STEALTH_KEYS.has(prevKey)) return { valid: false, message: '上一页键不能使用保留键' };
  if (nextKey === prevKey) return { valid: false, message: '上一页键和下一页键不能相同' };
  return { valid: true, message: '' };
}
```

`createKeySetting()` 保存前读取另一项配置：

```js
const otherKeyName = key === 'stealth_keyNext' ? 'stealth_keyPrev' : 'stealth_keyNext';
const otherValue = storage.getConfig(otherKeyName, key === 'stealth_keyNext' ? 'k' : 'j');

const nextValue = key === 'stealth_keyNext' ? e.key : otherValue;
const prevValue = key === 'stealth_keyPrev' ? e.key : otherValue;
const result = validateStealthSingleKey(nextValue, prevValue);

if (!result.valid) {
  btn.textContent = result.message;
  setTimeout(() => { btn.textContent = currentDisplayValue; }, 1000);
  return;
}
```

### 验收

- 不能把下一页键设置成 `Escape`。
- 不能把上一页键设置成 `ArrowUp` / `ArrowDown`。
- 不能把上一页键和下一页键设置成同一个键。
- 非保留普通键，例如 `j` / `k`、`,` / `.`，可以正常保存并生效。

## 2. 隐蔽模式按键命中后阻止默认行为

### 问题

文件：`src/modules/modes/stealth-mode.js`

当前隐蔽模式 `handleKeydown()` 命中快捷键后只执行翻行、翻页或退出，没有调用：

```js
e.preventDefault();
e.stopPropagation();
```

如果用户将自定义键设置为空格、PageUp、PageDown 等具有浏览器默认行为的按键，可能触发页面滚动或其他全局监听。

### 推荐修复

把按键动作解析成明确结果，命中后统一阻止默认行为。

```js
function handleKeydown(e) {
  let handled = true;

  if (e.key === 'ArrowDown') {
    goNextLine();
  } else if (e.key === 'ArrowUp') {
    goPrevLine();
  } else if (e.key === keyNext) {
    goNextPage();
  } else if (e.key === keyPrev) {
    goPrevPage();
  } else if (e.key === 'Escape') {
    store.setState({ readingMode: 'normal' });
  } else {
    handled = false;
  }

  if (!handled) return;
  e.preventDefault();
  e.stopPropagation();
  updateText();
}
```

注意：`Escape` 退出后不一定需要 `updateText()`，可以把 `updateText()` 放到非退出动作里，或保持现状也不会造成明显问题。

### 验收

- 隐蔽模式中 `ArrowUp` / `ArrowDown` 只翻视觉行，不触发页面滚动。
- 自定义键为空格时，按空格只执行配置动作。
- `Escape` 仍能稳定退出隐蔽模式。

## 3. 修复老板键 DOM fallback 匹配逻辑

### 问题

文件：`src/modules/boss-key/boss-key.js`

当前 `matchShortcut()` 对 Ctrl / Meta 的判断为：

```js
if (hasCtrl !== e.ctrlKey && hasCtrl !== e.metaKey) return false;
```

这个表达式难以表达 `CommandOrControl` 的真实语义，也可能在“不需要 Ctrl/Meta 但用户按了 Ctrl”的场景里产生误判。

### 推荐修复

明确区分三类修饰键：

- `CommandOrControl`：需要 `ctrlKey || metaKey`。
- `Control`：只需要 `ctrlKey`。
- 无 Ctrl/Meta：要求 `ctrlKey` 和 `metaKey` 都为 false。

建议实现：

```js
function matchShortcut(e, shortcut) {
  const parts = shortcut.toLowerCase().split('+');
  const key = parts.pop();

  const wantsCommandOrControl = parts.includes('commandorcontrol');
  const wantsControl = parts.includes('control');
  const wantsMeta = parts.includes('command') || parts.includes('meta');
  const wantsShift = parts.includes('shift');
  const wantsAlt = parts.includes('alt');

  if (wantsCommandOrControl) {
    if (!e.ctrlKey && !e.metaKey) return false;
  } else {
    if (wantsControl !== e.ctrlKey) return false;
    if (wantsMeta !== e.metaKey) return false;
  }

  if (wantsShift !== e.shiftKey) return false;
  if (wantsAlt !== e.altKey) return false;

  return normalizeKey(e.key) === normalizeKey(key);
}
```

同时建议增加 `normalizeKey()`，至少处理大小写和常见别名：

```js
function normalizeKey(key) {
  const normalized = String(key).toLowerCase();
  if (normalized === ' ') return 'space';
  if (normalized === 'esc') return 'escape';
  return normalized;
}
```

### 验收

- `CommandOrControl+\`` 能匹配 Ctrl + `。
- `CommandOrControl+\`` 能匹配 Meta + `。
- `Alt+A` 不会在 Ctrl + Alt + A 时误触发。
- `CommandOrControl+Shift+A` 不会在缺少 Shift 时误触发。

## 4. 快捷键设置交互补强

### 问题

文件：`src/modules/settings/settings.js`

`createKeySetting()` 和 `createKeyComboSetting()` 都在捕获按键时添加 document 级监听，但没有以下能力：

- 取消捕获。
- 捕获状态下再次点击按钮时避免重复注册监听。
- 捕获失败后恢复原显示值。

### 推荐修复

第一版可以最小处理：

- 捕获时按 `Escape` 表示取消，不保存。
- 每个按钮维护 `isCapturing`，避免重复注册。
- 校验失败后恢复原按钮文本。

建议逻辑：

```js
let isCapturing = false;

function capture() {
  if (isCapturing) return;
  isCapturing = true;
  const previousText = btn.textContent;

  function finish(text = previousText) {
    btn.textContent = text;
    btn.style.borderColor = 'var(--color-border)';
    btn.style.color = 'var(--color-text)';
    document.removeEventListener('keydown', onKey, true);
    isCapturing = false;
  }

  function onKey(e) {
    e.preventDefault();
    e.stopPropagation();

    if (e.key === 'Escape') {
      finish();
      return;
    }

    // validate and save...
  }

  document.addEventListener('keydown', onKey, true);
}
```

### 验收

- 点击设置按钮后，按 `Escape` 可以取消捕获。
- 连续点击同一个设置按钮不会注册多个监听。
- 非法按键提示后能恢复原值。

## 5. 测试补强

### 问题

文件：

- `tests/boss-key.test.js`
- `tests/modes.test.js`

当前测试主要验证手写局部变量，不验证真实模块。即使 `matchShortcut()` 出错，测试也仍然会通过。

### 推荐修复

#### 老板键测试

把 `matchShortcut()` 导出：

```js
export function matchShortcut(e, shortcut) {
  // ...
}
```

新增测试用例：

```js
expect(matchShortcut({ ctrlKey: true, metaKey: false, shiftKey: false, altKey: false, key: '`' }, 'CommandOrControl+`')).toBe(true);
expect(matchShortcut({ ctrlKey: false, metaKey: true, shiftKey: false, altKey: false, key: '`' }, 'CommandOrControl+`')).toBe(true);
expect(matchShortcut({ ctrlKey: true, metaKey: false, shiftKey: false, altKey: true, key: 'a' }, 'Alt+A')).toBe(false);
expect(matchShortcut({ ctrlKey: true, metaKey: false, shiftKey: false, altKey: false, key: 'a' }, 'CommandOrControl+Shift+A')).toBe(false);
```

#### 隐蔽模式按键测试

建议抽出纯函数：

```js
export function getStealthKeyAction(e, keyNext, keyPrev) {
  if (e.key === 'ArrowDown') return 'nextLine';
  if (e.key === 'ArrowUp') return 'prevLine';
  if (e.key === keyNext) return 'nextPage';
  if (e.key === keyPrev) return 'prevPage';
  if (e.key === 'Escape') return 'exit';
  return null;
}
```

测试：

- `j` 返回 `nextPage`。
- `k` 返回 `prevPage`。
- `ArrowDown` 返回 `nextLine`。
- `Escape` 返回 `exit`。
- 非配置键返回 `null`。

#### 设置校验测试

测试 `validateStealthSingleKey()`：

- `j` / `k` 合法。
- `Escape` / `k` 非法。
- `ArrowDown` / `k` 非法。
- `j` / `j` 非法。

### 验收

- `npm test` 能覆盖真实快捷键函数。
- 修改 `boss-key.js` 的匹配逻辑时，测试能失败并提示具体行为。
- 修改隐蔽模式保留键列表时，测试能同步约束。

## 6. 推荐落地顺序

1. 新增快捷键纯函数模块，例如 `src/modules/settings/key-utils.js` 或 `src/modules/shortcuts/shortcut-utils.js`。
2. 修复 `matchShortcut()`，并导出给测试使用。
3. 在 `settings.js` 中接入隐蔽模式单键校验。
4. 在 `stealth-mode.js` 中为已处理按键调用 `preventDefault()` 和 `stopPropagation()`。
5. 补真实单测，替换当前只测局部变量的测试。
6. 跑验证：

```bash
npm test
npm run build
```

如需验证全局老板键，再运行：

```bash
npm run tauri dev
```

## 7. 最小验收清单

- 设置隐蔽模式下一页键为 `j`，上一页键为 `k`，进入隐蔽模式后行为正确。
- 尝试把下一页键设置为 `Escape`，应拒绝保存。
- 尝试把上一页键设置为 `ArrowUp`，应拒绝保存。
- 尝试把下一页键和上一页键设置成同一个键，应拒绝保存。
- 隐蔽模式内方向键只翻视觉行，不触发页面默认滚动。
- 老板键设置为 `CommandOrControl+\`` 后，Ctrl + ` 可以隐藏 / 显示窗口。
- 浏览器开发模式下，全局快捷键不可用时 DOM fallback 仍能工作。
- `npm test` 和 `npm run build` 通过。
