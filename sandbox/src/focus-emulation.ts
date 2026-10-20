/**
 * 测试中的“模拟焦点”。
 *
 * WebKit（Safari，以及 iOS 上的所有浏览器）不允许跨源 iframe 用脚本移动焦点：本平台的沙箱是不透明来源，
 * 在其中调用 element.focus() 不会有任何效果。Testing Library 的输入、清空、Tab 等操作都依赖焦点，
 * 于是正确的代码也无法通过测试。
 *
 * 测试运行时如果检测到这种限制，就改用模拟的焦点：
 * - 记住“获得焦点”的元素，让 document.activeElement 返回它，并按浏览器的顺序派发 blur → focusout → focus → focusin；
 * - 元素被移出文档（包括移动位置）时失去焦点，和真实的浏览器一样；
 * - 页面样式中含有 :focus、:focus-visible、:focus-within 的规则，会复制一份改用 data-tsw-focus* 属性的规则，
 *   并给模拟获得焦点的元素（及其祖先）加上这些属性，于是计算样式与真实的焦点一致。
 *   :focus-visible 按浏览器的规则判断：最近一次操作是键盘、或者元素是文本输入框时成立。
 * 浏览器允许真正的焦点时，这里什么都不做。局限：element.matches(':focus') 这类选择器查询仍然得不到模拟的焦点。
 */

const nativeActiveElement = Object.getOwnPropertyDescriptor(Document.prototype, 'activeElement')?.get;
const nativeHasFocus = Document.prototype.hasFocus;
const nativeHtmlFocus = HTMLElement.prototype.focus;
const nativeHtmlBlur = HTMLElement.prototype.blur;
const nativeSvgFocus = SVGElement.prototype.focus;
const nativeSvgBlur = SVGElement.prototype.blur;
const nativeAdd = EventTarget.prototype.addEventListener;

type Focusable = HTMLElement | SVGElement;

const ATTR_FOCUS = 'data-tsw-focus';
const ATTR_VISIBLE = 'data-tsw-focus-visible';
const ATTR_WITHIN = 'data-tsw-focus-within';

let installed = false;
let emulating = false;
let focused: Focusable | null = null;
let usedSinceReset = false;
let lastModality: 'keyboard' | 'pointer' | 'none' = 'none';
const processedSheets = new WeakSet<CSSStyleSheet>();
const removals = new MutationObserver(() => {});

function realActive(): Element | null {
  return nativeActiveElement ? (nativeActiveElement.call(document) as Element | null) : null;
}

/** 浏览器是否阻止了沙箱中的脚本移动焦点。 */
export function focusIsBlocked(): boolean {
  const probe = document.createElement('input');
  probe.setAttribute('aria-hidden', 'true');
  probe.style.cssText = 'position:fixed;left:0;top:0;opacity:0';
  document.body.append(probe);
  nativeHtmlFocus.call(probe);
  const blocked = realActive() !== probe;
  nativeHtmlBlur.call(probe);
  probe.remove();
  return blocked;
}

function isFocusable(el: Element): el is Focusable {
  if (!(el instanceof HTMLElement || el instanceof SVGElement) || !el.isConnected) return false;
  if (el.closest('[inert]') !== null || el.getClientRects().length === 0) return false;
  if (el.matches(':disabled')) return false;
  if (el instanceof HTMLInputElement && el.type === 'hidden') return false;
  if (el.hasAttribute('tabindex')) return true;
  if (el instanceof HTMLAnchorElement || el instanceof HTMLAreaElement) return el.hasAttribute('href');
  if (
    el instanceof HTMLButtonElement ||
    el instanceof HTMLInputElement ||
    el instanceof HTMLSelectElement ||
    el instanceof HTMLTextAreaElement ||
    el instanceof HTMLIFrameElement
  ) {
    return true;
  }
  if (el instanceof HTMLMediaElement) return el.controls;
  if (el instanceof HTMLElement && (el.isContentEditable || el.tagName === 'SUMMARY')) return true;
  return false;
}

/** 文本输入框获得焦点时，无论用什么方式，:focus-visible 都成立。 */
function alwaysFocusVisible(el: Focusable): boolean {
  if (el instanceof HTMLTextAreaElement) return true;
  if (el instanceof HTMLElement && el.isContentEditable) return true;
  if (!(el instanceof HTMLInputElement)) return false;
  return !['button', 'checkbox', 'color', 'file', 'image', 'radio', 'range', 'reset', 'submit'].includes(el.type);
}

// —— 元素移出文档时失去焦点 ——

function applyRemovals() {
  if (focused === null) return;
  for (const record of removals.takeRecords()) {
    for (const node of record.removedNodes) {
      if (focused !== null && (node === focused || node.contains(focused))) clearMarks(focused);
    }
  }
}

function current(): Focusable | null {
  applyRemovals();
  if (focused !== null && (!focused.isConnected || focused.matches(':disabled'))) clearMarks(focused);
  return focused;
}

// —— :focus 系列的 CSS ——

function rewriteSelector(selector: string): string | null {
  if (!selector.includes(':focus')) return null;
  return selector
    .replaceAll(':focus-visible', `[${ATTR_VISIBLE}]`)
    .replaceAll(':focus-within', `[${ATTR_WITHIN}]`)
    .replace(/:focus(?![\w-])/g, `[${ATTR_FOCUS}]`);
}

function mirrorRules(rules: CSSRuleList, owner: CSSStyleSheet | CSSGroupingRule) {
  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i];
    if (rule instanceof CSSStyleRule) {
      const selector = rewriteSelector(rule.selectorText);
      if (selector === null) continue;
      try {
        owner.insertRule(`${selector} { ${rule.style.cssText} }`, i + 1);
        i++;
      } catch {
        // 无法改写的规则（例如浏览器不认识的选择器）跳过
      }
    } else if (rule instanceof CSSGroupingRule) {
      mirrorRules(rule.cssRules, rule);
    }
  }
}

function mirrorFocusStyles() {
  for (const sheet of document.styleSheets) {
    if (processedSheets.has(sheet)) continue;
    processedSheets.add(sheet);
    try {
      mirrorRules(sheet.cssRules, sheet);
    } catch {
      // 读取不到规则的样式表（跨源）跳过
    }
  }
}

function mark(el: Focusable) {
  mirrorFocusStyles();
  el.setAttribute(ATTR_FOCUS, '');
  if (lastModality !== 'pointer' || alwaysFocusVisible(el)) el.setAttribute(ATTR_VISIBLE, '');
  for (let node: Element | null = el; node !== null; node = node.parentElement) node.setAttribute(ATTR_WITHIN, '');
}

function clearMarks(el: Focusable) {
  if (focused === el) focused = null;
  for (const node of document.querySelectorAll(`[${ATTR_FOCUS}], [${ATTR_VISIBLE}], [${ATTR_WITHIN}]`)) {
    node.removeAttribute(ATTR_FOCUS);
    node.removeAttribute(ATTR_VISIBLE);
    node.removeAttribute(ATTR_WITHIN);
  }
}

function moveFocus(next: Focusable | null) {
  const previous = current();
  if (previous === next) return;
  if (previous !== null) {
    clearMarks(previous);
    previous.dispatchEvent(new FocusEvent('blur', { relatedTarget: next }));
    previous.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: next }));
  }
  if (next !== null) {
    focused = next;
    usedSinceReset = true;
    removals.takeRecords();
    mark(next);
    next.dispatchEvent(new FocusEvent('focus', { relatedTarget: previous }));
    next.dispatchEvent(new FocusEvent('focusin', { bubbles: true, relatedTarget: previous }));
  }
}

function focusWith(native: (this: Focusable, options?: FocusOptions) => void) {
  return function (this: Focusable, options?: FocusOptions) {
    native.call(this, options);
    if (!emulating) return;
    if (realActive() === this) {
      if (focused !== null) clearMarks(focused);
      return;
    }
    if (isFocusable(this)) moveFocus(this);
  };
}

function blurWith(native: (this: Focusable) => void) {
  return function (this: Focusable) {
    native.call(this);
    if (emulating && current() === this) moveFocus(null);
  };
}

/** 开始模拟焦点（只在测试中、并且浏览器阻止了真正的焦点时调用）。 */
export function enableFocusEmulation() {
  emulating = true;
  if (installed) return;
  installed = true;
  HTMLElement.prototype.focus = focusWith(nativeHtmlFocus);
  HTMLElement.prototype.blur = blurWith(nativeHtmlBlur);
  SVGElement.prototype.focus = focusWith(nativeSvgFocus);
  SVGElement.prototype.blur = blurWith(nativeSvgBlur);
  Object.defineProperty(Document.prototype, 'activeElement', {
    configurable: true,
    enumerable: true,
    get(this: Document) {
      if (emulating && this === document) {
        const el = current();
        if (el !== null) return el;
      }
      return nativeActiveElement ? nativeActiveElement.call(this) : null;
    },
  });
  Document.prototype.hasFocus = function (this: Document) {
    return emulating && this === document ? true : nativeHasFocus.call(this);
  };
  removals.observe(document, { childList: true, subtree: true });
  // 记录最近一次操作的方式，用于判断 :focus-visible
  nativeAdd.call(document, 'keydown', () => (lastModality = 'keyboard'), { capture: true });
  for (const type of ['pointerdown', 'mousedown']) nativeAdd.call(document, type, () => (lastModality = 'pointer'), { capture: true });
}

/** 每个测试开始前：没有元素获得焦点。 */
export function resetFocusEmulation() {
  if (focused !== null) clearMarks(focused);
  focused = null;
  usedSinceReset = false;
  lastModality = 'none';
  removals.takeRecords();
}

/** 上一次重置之后是否用过模拟的焦点。 */
export function focusEmulationUsed(): boolean {
  return usedSinceReset;
}
