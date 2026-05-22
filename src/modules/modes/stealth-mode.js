import { createElement } from '../../utils/dom-utils.js';
import { storage } from '../../core/storage.js';
import { store } from '../../core/store.js';
import { eventBus } from '../../core/event-bus.js';
import { enterStealthWindow, exitStealthWindow, startStealthDrag } from './stealth-window.js';
import { syncCurrentProgress, getChapterData, goNextChapterFirstPage, goPrevChapterLastPage, switchChapter, getParser } from '../reader/reader.js';
import { getStealthKeyAction } from '../settings/key-utils.js';

/**
 * 隐蔽模式渲染器
 * 原生窗口变形为单行条，按视觉行逐行阅读
 */
export function renderStealthMode(parser, chapterData) {
  const config = getStealthConfig();
  const state = store.getState();

  // 隐藏 body/app 背景
  document.body.classList.add('app-stealth');

  // 背景、字体等视觉配置放在容器上
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

  const textEl = createElement('div', { className: 'stealth-mode__text' });
  container.appendChild(textEl);

  let lineOffset = 0;
  let visualLines = []; // { text: string, offset: number }[]
  let disposed = false;

  // 异步初始化：等窗口变形完成后再构建视觉行
  async function initStealth() {
    await enterStealthWindow();
    if (disposed) return;
    await nextFrame();
    if (disposed) return;
    const data = getChapterData();
    visualLines = buildVisualLines(data.text, data.paragraphs, textEl, config);
    // 恢复到保存的偏移量
    lineOffset = findLineByOffset(visualLines, state.currentCharOffset);
    updateText();
  }

  initStealth();

  // 左键：短按翻下页，长按(≥300ms)拖动窗口，双击(间隔<400ms)翻下一章
  let pressTimer = null;
  let pressTime = 0;
  let dragging = false;
  let lastLeftClick = 0;

  container.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    pressTime = Date.now();
    dragging = false;
    pressTimer = setTimeout(() => {
      dragging = true;
      startStealthDrag();
    }, 300);
  });

  container.addEventListener('mouseup', (e) => {
    if (e.button !== 0) return;
    clearTimeout(pressTimer);

    if (!dragging && Date.now() - pressTime < 300) {
      const now = Date.now();
      if (now - lastLeftClick < 400) {
        // 双击 → 下一章
        if (goNextChapterFirstPage()) {
          rebuildLines('start');
          updateText();
        }
        lastLeftClick = 0;
      } else {
        lastLeftClick = now;
        // 延迟执行单击，等待双击判断
        setTimeout(() => {
          if (lastLeftClick === now) {
            goNextLine();
            updateText();
          }
        }, 400);
      }
    }
    dragging = false;
  });

  // 右键：单击翻上页，双击翻上一章
  let lastRightClick = 0;
  container.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const now = Date.now();
    if (now - lastRightClick < 400) {
      // 右键双击 → 上一章
      if (goPrevChapterLastPage()) {
        rebuildLines('last');
        updateText();
      }
      lastRightClick = 0;
    } else {
      lastRightClick = now;
      // 延迟执行单击，等双击判断
      setTimeout(() => {
        if (lastRightClick === now) {
          goPrevLine();
          updateText();
        }
      }, 400);
    }
  });

  // 滚轮翻视觉行
  container.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (e.deltaY > 0) {
      goNextLine();
    } else {
      goPrevLine();
    }
    updateText();
  });

  // 键盘事件（统一防抖 120ms，防止 key repeat 导致跳多行）
  // 每次按键时读取配置，支持设置页面热更新
  let lastKeyAction = 0;

  function handleKeydown(e) {
    const keyNext = storage.getConfig('stealth_keyNext', 'j');
    const keyPrev = storage.getConfig('stealth_keyPrev', 'k');
    const action = getStealthKeyAction(e, keyNext, keyPrev);
    if (!action) return;

    e.preventDefault();
    e.stopPropagation();

    if (action === 'exit') {
      store.setState({ readingMode: 'normal' });
      return;
    }

    const now = Date.now();
    if (now - lastKeyAction < 120) return;
    lastKeyAction = now;

    switch (action) {
      case 'nextLine': goNextLine(); updateText(); break;
      case 'prevLine': goPrevLine(); updateText(); break;
      case 'nextPage': goNextLine(); updateText(); break;
      case 'prevPage': goPrevLine(); updateText(); break;
    }
  }

  document.addEventListener('keydown', handleKeydown);

  // 监听章节切换事件（从章节目录触发时）
  const unsubChapter = eventBus.on('chapterChanged', ({ charOffset }) => {
    const data = getChapterData();
    visualLines = buildVisualLines(data.text, data.paragraphs, textEl, config);
    lineOffset = findLineByOffset(visualLines, charOffset);
    updateText();
  });

  /**
   * 重建视觉行
   * @param {'start'|'last'|number} target - 目标位置
   */
  function rebuildLines(target) {
    const data = getChapterData();
    visualLines = buildVisualLines(data.text, data.paragraphs, textEl, config);
    if (typeof target === 'number') {
      lineOffset = findLineByOffset(visualLines, target);
    } else if (target === 'last') {
      lineOffset = Math.max(0, visualLines.length - 1);
    } else {
      lineOffset = 0;
    }
  }

  function goNextLine() {
    if (lineOffset < visualLines.length - 1) {
      lineOffset++;
      syncCurrentProgress(visualLines[lineOffset].offset);
      return;
    }

    // 当前章结束，跳下一章
    if (goNextChapterFirstPage()) {
      rebuildLines('start');
      syncCurrentProgress(visualLines[0]?.offset || 0);
    }
  }

  function goPrevLine() {
    if (lineOffset > 0) {
      lineOffset--;
      syncCurrentProgress(visualLines[lineOffset].offset);
      return;
    }

    // 当前章开头，跳上一章末尾
    if (goPrevChapterLastPage()) {
      rebuildLines('last');
      syncCurrentProgress(visualLines[lineOffset]?.offset || 0);
    }
  }

  function updateText() {
    textEl.textContent = visualLines[lineOffset]?.text || '';
  }

  // 老板键显示时重新应用隐蔽窗口尺寸
  const unsubBoss = eventBus.on('bossKeyShown', async () => {
    if (disposed) return;
    await enterStealthWindow();
  });

  // 清理
  function cleanup() {
    disposed = true;
    document.removeEventListener('keydown', handleKeydown);
    document.body.classList.remove('app-stealth');
    exitStealthWindow();
    unsubChapter();
    unsubBoss();
  }

  eventBus.once('routeWillChange', cleanup);

  return container;
}

function nextFrame() {
  return new Promise(resolve => requestAnimationFrame(() => resolve()));
}

/**
 * 将按行分割的 paragraphs 合并为自然段落（连续非空行拼接，空行分段）
 * @param {{ text: string, offset: number }[]} paragraphs - 原始段落（每行一个）
 * @returns {{ text: string, offset: number }[]} - 合并后的段落
 */
function mergeParagraphs(paragraphs) {
  if (!paragraphs || paragraphs.length === 0) return [];

  const merged = [];
  let currentText = '';
  let currentOffset = -1;

  for (const para of paragraphs) {
    if (currentOffset === -1) {
      // 第一个段落
      currentText = para.text;
      currentOffset = para.offset;
    } else {
      // 连续的行拼在一起（不额外加空格，中文之间不需要）
      currentText += para.text;
    }
  }

  // 推入最后一个合并段落
  if (currentOffset !== -1) {
    merged.push({ text: currentText, offset: currentOffset });
  }

  return merged;
}

/**
 * 按文本元素实际宽度构建视觉行（带字符偏移量）
 * @param {string} text - 章节全文
 * @param {{ text: string, offset: number }[]} paragraphs - 段落元数据
 * @param {HTMLElement} textEl - 用于测量宽度的元素
 * @param {object} config - 字体配置
 * @returns {{ text: string, offset: number }[]}
 */
function buildVisualLines(text, paragraphs, textEl, config) {
  if (!text || !paragraphs || paragraphs.length === 0) return [];

  // 将按行分割的段落合并为自然段落，避免短句独占一行
  const mergedParas = mergeParagraphs(paragraphs);

  const ruler = document.createElement('span');
  ruler.style.position = 'fixed';
  ruler.style.visibility = 'hidden';
  ruler.style.whiteSpace = 'nowrap';
  ruler.style.fontFamily = config.fontFamily;
  ruler.style.fontSize = `${config.fontSize}px`;
  ruler.style.letterSpacing = '0.5px';
  document.body.appendChild(ruler);

  const cs = getComputedStyle(textEl);
  const maxWidth = Math.max(0, textEl.clientWidth - parseFloat(cs.paddingRight) || 0);

  const lines = [];
  for (const para of mergedParas) {
    let remaining = para.text;
    let charOffset = para.offset;
    while (remaining.length > 0) {
      const line = fitLine(remaining, ruler, maxWidth);
      lines.push({ text: line.text, offset: charOffset });
      let advance = line.end;
      // 跳过尾部换行符，避免产生空视觉行
      if (advance < remaining.length && remaining[advance] === '\n') {
        advance++;
      }
      charOffset += advance;
      remaining = remaining.slice(advance);
    }
  }

  document.body.removeChild(ruler);
  return lines;
}

function fitLine(text, ruler, maxWidth) {
  if (text.length === 0) return { text: '', end: 0 };

  ruler.textContent = text;
  if (ruler.getBoundingClientRect().width <= maxWidth) {
    return { text, end: text.length };
  }

  let lo = 1;
  let hi = text.length;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    ruler.textContent = text.slice(0, mid);
    if (ruler.getBoundingClientRect().width <= maxWidth) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }

  return { text: text.slice(0, lo), end: lo };
}

/**
 * 在视觉行中查找最接近指定偏移量的行
 */
function findLineByOffset(lines, targetOffset) {
  if (!lines || lines.length === 0) return 0;
  if (targetOffset <= 0) return 0;

  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < lines.length; i++) {
    const dist = Math.abs(lines[i].offset - targetOffset);
    if (dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  }
  return best;
}

function getStealthConfig() {
  return {
    bgColor: storage.getConfig('stealth_bgColor', 'rgba(0, 0, 0, 0.7)'),
    fontColor: storage.getConfig('stealth_fontColor', '#e6e6e6'),
    fontSize: storage.getConfig('stealth_fontSize', 13),
    opacity: storage.getConfig('stealth_opacity', 1),
    fontFamily: storage.getConfig('stealth_fontFamily', 'system-ui, sans-serif'),
  };
}
