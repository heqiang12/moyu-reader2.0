import { describe, it, expect } from 'vitest';
import {
  matchShortcut,
  getStealthKeyAction,
  validateStealthSingleKey,
  normalizeKey,
} from '../src/modules/settings/key-utils.js';

describe('matchShortcut', () => {
  it('CommandOrControl+` 匹配 Ctrl + `', () => {
    expect(matchShortcut(
      { ctrlKey: true, metaKey: false, shiftKey: false, altKey: false, key: '`' },
      'CommandOrControl+`'
    )).toBe(true);
  });

  it('CommandOrControl+` 匹配 Meta + `', () => {
    expect(matchShortcut(
      { ctrlKey: false, metaKey: true, shiftKey: false, altKey: false, key: '`' },
      'CommandOrControl+`'
    )).toBe(true);
  });

  it('CommandOrControl+` 不匹配只按 `', () => {
    expect(matchShortcut(
      { ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, key: '`' },
      'CommandOrControl+`'
    )).toBe(false);
  });

  it('Alt+A 不会在 Ctrl+Alt+A 时误触发', () => {
    expect(matchShortcut(
      { ctrlKey: true, metaKey: false, shiftKey: false, altKey: true, key: 'a' },
      'Alt+A'
    )).toBe(false);
  });

  it('CommandOrControl+Shift+A 不会在缺少 Shift 时误触发', () => {
    expect(matchShortcut(
      { ctrlKey: true, metaKey: false, shiftKey: false, altKey: false, key: 'a' },
      'CommandOrControl+Shift+A'
    )).toBe(false);
  });

  it('CommandOrControl+Shift+A 在完整匹配时触发', () => {
    expect(matchShortcut(
      { ctrlKey: true, metaKey: false, shiftKey: true, altKey: false, key: 'a' },
      'CommandOrControl+Shift+A'
    )).toBe(true);
  });

  it('大小写不敏感匹配', () => {
    expect(matchShortcut(
      { ctrlKey: true, metaKey: false, shiftKey: false, altKey: false, key: 'A' },
      'CommandOrControl+a'
    )).toBe(true);
  });

  it('Shift+符号键通过 e.code 回退匹配', () => {
    // Ctrl+Shift+` 时 e.key='~'，但快捷键存储 '`'
    expect(matchShortcut(
      { ctrlKey: true, metaKey: false, shiftKey: true, altKey: false, key: '~', code: 'Backquote' },
      'CommandOrControl+Shift+`'
    )).toBe(true);
  });

  it('Shift+数字键通过 e.code 回退匹配', () => {
    // Ctrl+Shift+1 时 e.key='!'，但快捷键存储 '1'
    expect(matchShortcut(
      { ctrlKey: true, metaKey: false, shiftKey: true, altKey: false, key: '!', code: 'Digit1' },
      'CommandOrControl+Shift+1'
    )).toBe(true);
  });

  it('e.code 回退不误匹配不同的物理键', () => {
    expect(matchShortcut(
      { ctrlKey: true, metaKey: false, shiftKey: true, altKey: false, key: '!', code: 'Digit1' },
      'CommandOrControl+Shift+2'
    )).toBe(false);
  });

  it('无 e.code 时不影响正常 key 匹配', () => {
    expect(matchShortcut(
      { ctrlKey: true, metaKey: false, shiftKey: false, altKey: false, key: 'a', code: undefined },
      'CommandOrControl+a'
    )).toBe(true);
  });

  it('多修饰键场景：Ctrl+Shift+Alt+A', () => {
    expect(matchShortcut(
      { ctrlKey: true, metaKey: false, shiftKey: true, altKey: true, key: 'a' },
      'CommandOrControl+Shift+Alt+A'
    )).toBe(true);
  });

  it('多修饰键场景：缺少一个修饰键不匹配', () => {
    expect(matchShortcut(
      { ctrlKey: true, metaKey: false, shiftKey: false, altKey: true, key: 'a' },
      'CommandOrControl+Shift+Alt+A'
    )).toBe(false);
  });
});

describe('getStealthKeyAction', () => {
  const keyNext = 'j';
  const keyPrev = 'k';

  it('ArrowDown 返回 nextLine', () => {
    expect(getStealthKeyAction({ key: 'ArrowDown' }, keyNext, keyPrev)).toBe('nextLine');
  });

  it('ArrowUp 返回 prevLine', () => {
    expect(getStealthKeyAction({ key: 'ArrowUp' }, keyNext, keyPrev)).toBe('prevLine');
  });

  it('自定义下一页键返回 nextPage', () => {
    expect(getStealthKeyAction({ key: 'j' }, keyNext, keyPrev)).toBe('nextPage');
  });

  it('自定义上一页键返回 prevPage', () => {
    expect(getStealthKeyAction({ key: 'k' }, keyNext, keyPrev)).toBe('prevPage');
  });

  it('Escape 返回 exit', () => {
    expect(getStealthKeyAction({ key: 'Escape' }, keyNext, keyPrev)).toBe('exit');
  });

  it('未配置键返回 null', () => {
    expect(getStealthKeyAction({ key: 'x' }, keyNext, keyPrev)).toBeNull();
  });

  it('不同配置的键也能正确匹配', () => {
    expect(getStealthKeyAction({ key: ',' }, ',', '.')).toBe('nextPage');
    expect(getStealthKeyAction({ key: '.' }, ',', '.')).toBe('prevPage');
  });
});

describe('validateStealthSingleKey', () => {
  it('j / k 合法', () => {
    const result = validateStealthSingleKey('j', 'k');
    expect(result.valid).toBe(true);
  });

  it('Escape 作为下一页键不合法', () => {
    const result = validateStealthSingleKey('Escape', 'k');
    expect(result.valid).toBe(false);
    expect(result.message).toContain('保留键');
  });

  it('ArrowUp 作为上一页键不合法', () => {
    const result = validateStealthSingleKey('j', 'ArrowUp');
    expect(result.valid).toBe(false);
    expect(result.message).toContain('保留键');
  });

  it('ArrowDown 作为下一页键不合法', () => {
    const result = validateStealthSingleKey('ArrowDown', 'k');
    expect(result.valid).toBe(false);
  });

  it('上下页键相同不合法', () => {
    const result = validateStealthSingleKey('j', 'j');
    expect(result.valid).toBe(false);
    expect(result.message).toContain('不能相同');
  });

  it('空键不合法', () => {
    expect(validateStealthSingleKey('', 'k').valid).toBe(false);
    expect(validateStealthSingleKey('j', '').valid).toBe(false);
  });
});

describe('normalizeKey', () => {
  it('空格标准化为 space', () => {
    expect(normalizeKey(' ')).toBe('space');
  });

  it('esc 标准化为 escape', () => {
    expect(normalizeKey('esc')).toBe('escape');
    expect(normalizeKey('Escape')).toBe('escape');
  });

  it('普通字母小写化', () => {
    expect(normalizeKey('A')).toBe('a');
    expect(normalizeKey('j')).toBe('j');
  });
});
