/**
 * 快捷键工具函数
 */

// 隐蔽模式保留键
const RESERVED_STEALTH_KEYS = new Set([
  'Escape',
  'ArrowUp',
  'ArrowDown',
]);

/**
 * 校验隐蔽模式单键配置是否合法
 */
export function validateStealthSingleKey(nextKey, prevKey) {
  if (!nextKey || !prevKey) return { valid: false, message: '按键不能为空' };
  if (RESERVED_STEALTH_KEYS.has(nextKey)) return { valid: false, message: '下一页键不能使用保留键' };
  if (RESERVED_STEALTH_KEYS.has(prevKey)) return { valid: false, message: '上一页键不能使用保留键' };
  if (nextKey === prevKey) return { valid: false, message: '上一页键和下一页键不能相同' };
  return { valid: true, message: '' };
}

/**
 * 根据按键事件返回隐蔽模式动作名称
 */
export function getStealthKeyAction(e, keyNext, keyPrev) {
  if (e.key === 'ArrowDown') return 'nextLine';
  if (e.key === 'ArrowUp') return 'prevLine';
  if (e.key === keyNext) return 'nextPage';
  if (e.key === keyPrev) return 'prevPage';
  if (e.key === 'Escape') return 'exit';
  return null;
}

/**
 * 标准化按键名（大小写 + 常见别名）
 */
export function normalizeKey(key) {
  const normalized = String(key).toLowerCase();
  if (normalized === ' ') return 'space';
  if (normalized === 'esc') return 'escape';
  return normalized;
}

/**
 * e.code 到物理键未修饰字符的映射（美式键盘布局）
 * 用于 Shift+符号键的回退匹配
 */
const CODE_TO_UNSHIFTED_KEY = {
  'Backquote': '`', 'Minus': '-', 'Equal': '=',
  'BracketLeft': '[', 'BracketRight': ']', 'Backslash': '\\',
  'Semicolon': ';', 'Quote': "'",
  'Comma': ',', 'Period': '.', 'Slash': '/',
  'Digit0': '0', 'Digit1': '1', 'Digit2': '2', 'Digit3': '3', 'Digit4': '4',
  'Digit5': '5', 'Digit6': '6', 'Digit7': '7', 'Digit8': '8', 'Digit9': '9',
};

/**
 * 检查 keydown 事件是否匹配 Tauri 格式的快捷键字符串
 * 如 'CommandOrControl+`' → ctrlKey + key==='`'
 * 如 'Alt+A' → altKey + key==='a'
 * 如 'CommandOrControl+Shift+A' → ctrlKey + shiftKey + key==='a'
 */
export function matchShortcut(e, shortcut) {
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

  // 优先匹配 e.key
  if (normalizeKey(e.key) === normalizeKey(key)) return true;

  // 回退：使用 e.code 匹配 Shift+符号键场景
  // 例如 Ctrl+Shift+` 时 e.key='~' 但快捷键存储的是 '`'
  if (e.code && CODE_TO_UNSHIFTED_KEY[e.code] === normalizeKey(key)) return true;

  return false;
}
