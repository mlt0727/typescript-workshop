/**
 * DOM / React 模式的页面管理：把学生的 index.html 装进沙箱文档，
 * 并跟踪 window/document 上的监听器与计时器，以便在每个测试前恢复干净的初始页面。
 */

export interface AppliedPage {
  /** index.html 中 <script type="module" src> 指向的入口（相对路径） */
  entryFromHtml?: string;
  warnings: string[];
  reset(): void;
}

import { resetHistoryGuard } from './history-guard.ts';

const nativeAddEventListener = EventTarget.prototype.addEventListener;

/** 平台自己的监听器：不参与跟踪，每个测试前不会被移除。 */
export function listenUntracked<K extends keyof DocumentEventMap>(target: Document, type: K, listener: (event: DocumentEventMap[K]) => void) {
  nativeAddEventListener.call(target, type, listener as EventListener);
}

const DEFAULT_REACT_HTML = '<!doctype html><html lang="zh-CN"><head><title>预览</title></head><body><div id="root"></div></body></html>';

interface TrackedListener {
  target: EventTarget;
  type: string;
  listener: EventListenerOrEventListenerObject;
  options?: boolean | EventListenerOptions;
}

const trackedListeners: TrackedListener[] = [];
const trackedTimeouts = new Set<number>();
const trackedIntervals = new Set<number>();
const trackedFrames = new Set<number>();
let trackingInstalled = false;
let trackingPaused = 0;

/**
 * fn 执行期间注册到 window/document 上的监听器不被跟踪。
 * 测试库（user-event、React）第一次使用时会在 document 上注册监听器并记下“已经准备过”，
 * 这些监听器必须在测试之间保留；每个测试前清除的只是学生代码的监听器。
 */
export function untracked<T>(fn: () => T): T {
  trackingPaused++;
  try {
    return fn();
  } finally {
    trackingPaused--;
  }
}
(globalThis as { __tsw_untracked__?: typeof untracked }).__tsw_untracked__ = untracked;

/** 必须在任何学生代码运行之前调用。 */
export function installTracking() {
  if (trackingInstalled) return;
  trackingInstalled = true;
  const add = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function (
    this: EventTarget,
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions,
  ) {
    if (listener && trackingPaused === 0 && (this === window || this === document)) {
      trackedListeners.push({ target: this, type, listener, options: typeof options === 'object' ? { capture: options.capture } : options });
    }
    return add.call(this, type, listener, options);
  };
  const st = window.setTimeout.bind(window);
  const si = window.setInterval.bind(window);
  const raf = window.requestAnimationFrame.bind(window);
  window.setTimeout = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
    const id = st(handler, timeout, ...args);
    trackedTimeouts.add(id);
    return id;
  }) as typeof window.setTimeout;
  window.setInterval = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
    const id = si(handler, timeout, ...args);
    trackedIntervals.add(id);
    return id;
  }) as typeof window.setInterval;
  window.requestAnimationFrame = (cb: FrameRequestCallback) => {
    const id = raf(cb);
    trackedFrames.add(id);
    return id;
  };
}

function clearTracked() {
  for (const l of trackedListeners.splice(0)) l.target.removeEventListener(l.type, l.listener, l.options);
  for (const id of trackedTimeouts) clearTimeout(id);
  for (const id of trackedIntervals) clearInterval(id);
  for (const id of trackedFrames) cancelAnimationFrame(id);
  trackedTimeouts.clear();
  trackedIntervals.clear();
  trackedFrames.clear();
}

function normalizePath(src: string): string {
  return src.replace(/^\.\//, '').replace(/^\//, '');
}

export function applyPage(page: { html?: string; css: Record<string, string> } | undefined): AppliedPage {
  const warnings: string[] = [];
  const html = page?.html ?? DEFAULT_REACT_HTML;
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  let entryFromHtml: string | undefined;

  for (const script of [...parsed.querySelectorAll('script')]) {
    const src = script.getAttribute('src');
    if (src && script.type === 'module' && !/^[a-z]+:/i.test(src)) {
      entryFromHtml ??= normalizePath(src);
    } else if (src) {
      warnings.push(`已忽略外部脚本 ${src}：沙箱不允许加载远程代码。`);
    } else if (script.textContent?.trim()) {
      warnings.push('已忽略 index.html 中的内联 <script>：请把代码写在 .ts 文件里。');
    }
    script.remove();
  }
  for (const link of [...parsed.querySelectorAll('link[rel~="stylesheet"]')]) {
    const href = normalizePath(link.getAttribute('href') ?? '');
    const css = page?.css[href];
    if (css !== undefined) {
      const style = parsed.createElement('style');
      style.dataset.tswCss = href;
      style.textContent = css;
      link.replaceWith(style);
    } else {
      warnings.push(`找不到样式表 ${href}（只能引用本练习中的 .css 文件）。`);
      link.remove();
    }
  }
  for (const el of [...parsed.querySelectorAll('meta[http-equiv], base')]) el.remove();

  const headTemplate = parsed.head.innerHTML;
  const bodyTemplate = parsed.body.cloneNode(true) as HTMLElement;
  const title = parsed.title;
  const htmlLang = parsed.documentElement.getAttribute('lang') ?? 'zh-CN';

  // 记下初始地址：学生代码可能用 history.pushState 改了地址，每个测试前恢复它
  const initialUrl = location.href;

  const reset = () => {
    clearTracked();
    if (location.href !== initialUrl) history.replaceState(null, '', initialUrl);
    resetHistoryGuard();
    for (const node of [...document.head.childNodes]) {
      if (!(node instanceof HTMLElement && node.dataset.tswKeep !== undefined)) node.remove();
    }
    document.head.insertAdjacentHTML('beforeend', headTemplate);
    document.title = title || '预览';
    document.documentElement.setAttribute('lang', htmlLang);
    // 保留 body 元素本身：Testing Library 的 screen 在加载时绑定到 document.body，替换元素会让查询落空
    const body = document.body;
    for (const attr of [...body.attributes]) body.removeAttribute(attr.name);
    for (const attr of bodyTemplate.attributes) body.setAttribute(attr.name, attr.value);
    body.replaceChildren(...[...bodyTemplate.childNodes].map((n) => document.importNode(n, true)));
  };
  reset();
  return { entryFromHtml, warnings, reset };
}

export class LoopLimitError extends Error {
  override name = 'LoopLimitError';
}

/**
 * 时间型循环保护：同一个宏任务里循环累计运行超过 limitMs 就抛错。
 * 在宏任务结束（MessageChannel 消息触发；不像 setTimeout 那样会在后台标签页被节流）时重置计时。
 * 一旦触发，本任务内的后续检查都会继续抛错，
 * 防止 catch 吞掉错误后又陷入循环。
 */
export function installLoopGuard(limitMs = 1500) {
  const now = () => performance.now();
  const channel = new MessageChannel();
  let taskStart = 0;
  let armed = false;
  let tripped = false;
  let counter = 0;
  channel.port1.onmessage = () => {
    armed = false;
    tripped = false;
  };
  (globalThis as Record<string, unknown>).__tsw_loop_guard__ = () => {
    if (tripped) throw new LoopLimitError('循环保护：本次任务已因疑似无限循环被中止。');
    if ((++counter & 15) !== 0) return;
    if (!armed) {
      armed = true;
      taskStart = now();
      channel.port2.postMessage(null);
      return;
    }
    if (now() - taskStart > limitMs) {
      tripped = true;
      throw new LoopLimitError(
        `检测到可能的无限循环：一段同步代码连续运行超过 ${limitMs / 1000} 秒，已被循环保护中止。请检查循环的结束条件。`,
      );
    }
  };
}
