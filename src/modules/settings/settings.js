import { createElement } from '../../utils/dom-utils.js';
import { storage } from '../../core/storage.js';
import { store } from '../../core/store.js';
import { bossKey } from '../boss-key/boss-key.js';
import { validateStealthSingleKey } from './key-utils.js';

/**
 * 设置页面模块
 */
export function renderSettings() {
  const container = createElement('div', { className: 'settings' });

  // 头部
  const header = createElement('div', { className: 'settings__header' });
  const backBtn = createElement('button', {
    className: 'settings__back',
    onClick: () => store.setState({ page: 'bookshelf' }),
  }, '←');
  const title = createElement('h1', { className: 'settings__title' }, '设置');
  header.appendChild(backBtn);
  header.appendChild(title);
  container.appendChild(header);

  // 隐蔽模式设置
  const stealthSection = createSection('隐蔽模式');
  stealthSection.appendChild(createColorAlphaSetting(
    '背景色',
    'stealth_bgColor',
    'rgba(0, 0, 0, 0.7)',
    '隐蔽模式的背景颜色（支持透明度）'
  ));
  stealthSection.appendChild(createColorSetting(
    '字体颜色',
    'stealth_fontColor',
    '#e6e6e6',
    '隐蔽模式的文字颜色'
  ));
  stealthSection.appendChild(createRangeSetting(
    '字体大小',
    'stealth_fontSize',
    13,
    10,
    20,
    'px',
    '隐蔽模式的文字大小'
  ));
  stealthSection.appendChild(createRangeSetting(
    '透明度',
    'stealth_opacity',
    1,
    0.1,
    1,
    '',
    '隐蔽模式的整体透明度'
  ));
  stealthSection.appendChild(createKeySetting(
    '下一页键',
    'stealth_keyNext',
    'j',
    '隐蔽模式下按键翻下页'
  ));
  stealthSection.appendChild(createKeySetting(
    '上一页键',
    'stealth_keyPrev',
    'k',
    '隐蔽模式下按键翻上页'
  ));
  container.appendChild(stealthSection);

  // 快捷键设置
  const keySection = createSection('快捷键');
  keySection.appendChild(createKeyComboSetting(
    '老板键',
    'bossKey_shortcut',
    'CommandOrControl+`',
    '瞬间隐藏到系统托盘',
    () => bossKey.reinit()
  ));
  container.appendChild(keySection);

  return container;
}

function createSection(title) {
  const section = createElement('div', { className: 'settings__section' });
  const sectionTitle = createElement('div', { className: 'settings__section-title' }, title);
  section.appendChild(sectionTitle);
  return section;
}

function createColorSetting(label, key, defaultValue, desc) {
  const item = createElement('div', { className: 'settings__item' });
  const info = createElement('div', {});
  info.appendChild(createElement('div', { className: 'settings__item-label' }, label));
  info.appendChild(createElement('div', { className: 'settings__item-desc' }, desc));

  const control = createElement('div', { className: 'settings__item-control' });
  const input = createElement('input', {
    className: 'settings__color-input',
    type: 'color',
    value: storage.getConfig(key, defaultValue),
  });

  input.addEventListener('input', (e) => {
    storage.setConfig(key, e.target.value);
  });

  control.appendChild(input);
  item.appendChild(info);
  item.appendChild(control);
  return item;
}

function createColorAlphaSetting(label, key, defaultValue, desc) {
  const { hex, alpha } = parseRgba(storage.getConfig(key, defaultValue));

  const item = createElement('div', { className: 'settings__item' });
  const info = createElement('div', {});
  info.appendChild(createElement('div', { className: 'settings__item-label' }, label));
  info.appendChild(createElement('div', { className: 'settings__item-desc' }, desc));

  const control = createElement('div', {
    className: 'settings__item-control',
    style: { display: 'flex', alignItems: 'center', gap: '8px' },
  });

  const colorInput = createElement('input', {
    className: 'settings__color-input',
    type: 'color',
    value: hex,
  });

  const alphaLabel = createElement('span', {
    style: { fontSize: '11px', color: 'var(--color-text-secondary)' },
  }, `${Math.round(alpha * 100)}%`);

  const alphaInput = createElement('input', {
    className: 'settings__range',
    type: 'range',
    min: '0',
    max: '1',
    step: '0.05',
    value: String(alpha),
  });

  function updateValue() {
    const a = parseFloat(alphaInput.value);
    const h = colorInput.value;
    alphaLabel.textContent = `${Math.round(a * 100)}%`;
    const rgba = hexToRgba(h, a);
    storage.setConfig(key, rgba);
  }

  colorInput.addEventListener('input', updateValue);
  alphaInput.addEventListener('input', updateValue);

  control.appendChild(colorInput);
  control.appendChild(alphaLabel);
  control.appendChild(alphaInput);
  item.appendChild(info);
  item.appendChild(control);
  return item;
}

function parseRgba(str) {
  const m = str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (m) {
    const r = parseInt(m[1]).toString(16).padStart(2, '0');
    const g = parseInt(m[2]).toString(16).padStart(2, '0');
    const b = parseInt(m[3]).toString(16).padStart(2, '0');
    return { hex: `#${r}${g}${b}`, alpha: m[4] !== undefined ? parseFloat(m[4]) : 1 };
  }
  return { hex: str.startsWith('#') ? str : '#000000', alpha: 0.7 };
}

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function createRangeSetting(label, key, defaultValue, min, max, unit, desc) {
  const item = createElement('div', { className: 'settings__item' });
  const info = createElement('div', {});
  info.appendChild(createElement('div', { className: 'settings__item-label' }, label));
  info.appendChild(createElement('div', { className: 'settings__item-desc' }, desc));

  const control = createElement('div', { className: 'settings__item-control' });
  const value = storage.getConfig(key, defaultValue);
  const valueLabel = createElement('span', {
    style: { fontSize: '12px', color: 'var(--color-text-secondary)', marginRight: '8px' },
  }, `${value}${unit}`);

  const input = createElement('input', {
    className: 'settings__range',
    type: 'range',
    min: String(min),
    max: String(max),
    step: String(max <= 1 ? 0.1 : 1),
    value: String(value),
  });

  input.addEventListener('input', (e) => {
    const v = parseFloat(e.target.value);
    storage.setConfig(key, v);
    valueLabel.textContent = `${v}${unit}`;
  });

  control.appendChild(valueLabel);
  control.appendChild(input);
  item.appendChild(info);
  item.appendChild(control);
  return item;
}

function createInfoSetting(label, value, desc) {
  const item = createElement('div', { className: 'settings__item' });
  const info = createElement('div', {});
  info.appendChild(createElement('div', { className: 'settings__item-label' }, label));
  info.appendChild(createElement('div', { className: 'settings__item-desc' }, desc));
  const control = createElement('div', {
    className: 'settings__item-control',
    style: { fontSize: '13px', color: 'var(--color-accent)' },
  }, value);
  item.appendChild(info);
  item.appendChild(control);
  return item;
}

/**
 * 单键捕获设置（用于隐蔽模式翻页键）
 */
function createKeySetting(label, key, defaultValue, desc) {
  const currentVal = storage.getConfig(key, defaultValue);
  const item = createElement('div', { className: 'settings__item' });
  const info = createElement('div', {});
  info.appendChild(createElement('div', { className: 'settings__item-label' }, label));
  info.appendChild(createElement('div', { className: 'settings__item-desc' }, desc));

  const control = createElement('div', { className: 'settings__item-control' });
  const btn = createElement('button', {
    className: 'settings__key-btn',
    style: {
      padding: '4px 12px',
      borderRadius: 'var(--radius-sm)',
      background: 'var(--color-bg-secondary)',
      border: '1px solid var(--color-border)',
      color: 'var(--color-text)',
      fontSize: '13px',
      minWidth: '60px',
    },
  }, currentVal);

  let isCapturing = false;

  function capture() {
    if (isCapturing) return;
    isCapturing = true;
    const previousText = btn.textContent;

    btn.textContent = '请按键...';
    btn.style.borderColor = 'var(--color-accent)';
    btn.style.color = 'var(--color-accent)';

    function finish(text) {
      btn.textContent = text !== undefined ? text : previousText;
      btn.style.borderColor = 'var(--color-border)';
      btn.style.color = 'var(--color-text)';
      document.removeEventListener('keydown', onKey, true);
      isCapturing = false;
    }

    function onKey(e) {
      e.preventDefault();
      e.stopPropagation();

      // Escape 取消捕获
      if (e.key === 'Escape') {
        finish();
        return;
      }

      // 校验：读取另一项配置做交叉校验
      const otherKeyName = key === 'stealth_keyNext' ? 'stealth_keyPrev' : 'stealth_keyNext';
      const otherDefault = key === 'stealth_keyNext' ? 'k' : 'j';
      const otherValue = storage.getConfig(otherKeyName, otherDefault);

      const nextValue = key === 'stealth_keyNext' ? e.key : otherValue;
      const prevValue = key === 'stealth_keyPrev' ? e.key : otherValue;
      const result = validateStealthSingleKey(nextValue, prevValue);

      if (!result.valid) {
        finish(result.message);
        setTimeout(() => { finish(previousText); }, 1200);
        return;
      }

      storage.setConfig(key, e.key);
      finish(e.key);
    }

    document.addEventListener('keydown', onKey, true);
  }

  btn.addEventListener('click', capture);
  control.appendChild(btn);
  item.appendChild(info);
  item.appendChild(control);
  return item;
}

/**
 * 组合键捕获设置（用于老板键等需要修饰键的快捷键）
 * 捕获结果为 Tauri 格式，如 'CommandOrControl+Shift+A'
 */
function createKeyComboSetting(label, key, defaultValue, desc, onSaved) {
  const currentVal = storage.getConfig(key, defaultValue);
  const item = createElement('div', { className: 'settings__item' });
  const info = createElement('div', {});
  info.appendChild(createElement('div', { className: 'settings__item-label' }, label));
  info.appendChild(createElement('div', { className: 'settings__item-desc' }, desc));

  const control = createElement('div', { className: 'settings__item-control' });
  const btn = createElement('button', {
    className: 'settings__key-btn',
    style: {
      padding: '4px 12px',
      borderRadius: 'var(--radius-sm)',
      background: 'var(--color-bg-secondary)',
      border: '1px solid var(--color-border)',
      color: 'var(--color-text)',
      fontSize: '13px',
      minWidth: '120px',
    },
  }, formatShortcut(currentVal));

  let isCapturing = false;

  function capture() {
    if (isCapturing) return;
    isCapturing = true;
    const previousText = btn.textContent;

    btn.textContent = '请按组合键...';
    btn.style.borderColor = 'var(--color-accent)';
    btn.style.color = 'var(--color-accent)';

    function finish(text) {
      btn.textContent = text !== undefined ? text : previousText;
      btn.style.borderColor = 'var(--color-border)';
      btn.style.color = 'var(--color-text)';
      document.removeEventListener('keydown', onKey, true);
      isCapturing = false;
    }

    function onKey(e) {
      e.preventDefault();
      e.stopPropagation();

      // Escape 取消捕获
      if (e.key === 'Escape') {
        finish();
        return;
      }

      // 至少需要一个修饰键
      if (!e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
        finish('需要修饰键(Ctrl/Alt/Shift)');
        setTimeout(() => { finish(previousText); }, 1200);
        return;
      }

      // 忽略单独的修饰键
      const modKeys = ['Control', 'Shift', 'Alt', 'Meta'];
      if (modKeys.includes(e.key)) return;

      // 构建 Tauri 格式快捷键字符串
      const parts = [];
      if (e.ctrlKey || e.metaKey) parts.push('CommandOrControl');
      if (e.altKey) parts.push('Alt');
      if (e.shiftKey) parts.push('Shift');
      parts.push(e.key);

      const combo = parts.join('+');
      storage.setConfig(key, combo);
      finish(formatShortcut(combo));

      if (onSaved) onSaved();
    }

    document.addEventListener('keydown', onKey, true);
  }

  btn.addEventListener('click', capture);
  control.appendChild(btn);
  item.appendChild(info);
  item.appendChild(control);
  return item;
}

/**
 * 将 Tauri 格式快捷键转为显示文本
 * 'CommandOrControl+`' → 'Ctrl+`'
 * 'CommandOrControl+Shift+A' → 'Ctrl+Shift+A'
 */
function formatShortcut(combo) {
  return combo
    .replace(/CommandOrControl/g, 'Ctrl')
    .replace(/\+/g, '+');
}
