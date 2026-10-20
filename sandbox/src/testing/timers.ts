/**
 * 假计时器：替换 setTimeout / setInterval / clearTimeout / clearInterval / Date。
 * 语义参照 Vitest（@sinonjs/fake-timers）的常用部分；不替换 queueMicrotask 与 Promise。
 */
interface FakeTimer {
  id: number;
  at: number;
  interval?: number;
  callback: (...args: unknown[]) => void;
  args: unknown[];
}

type G = typeof globalThis & Record<string, unknown>;

const g = globalThis as G;
const real = {
  setTimeout: globalThis.setTimeout,
  clearTimeout: globalThis.clearTimeout,
  setInterval: globalThis.setInterval,
  clearInterval: globalThis.clearInterval,
  Date: globalThis.Date,
};

let installed = false;
/** 安装假计时器前的全局函数（可能已被运行时的计时器跟踪包装过），恢复时还原它们。 */
let saved: typeof real = real;
let now = 0;
let nextId = 1;
let timers = new Map<number, FakeTimer>();

/** 运行时自身（超时控制等）需要真实计时器。 */
export const realTimers = {
  setTimeout: real.setTimeout.bind(globalThis),
  clearTimeout: real.clearTimeout.bind(globalThis),
};

function add(callback: unknown, delay: unknown, args: unknown[], interval: boolean): number {
  if (typeof callback !== 'function') throw new TypeError('callback 必须是函数');
  const ms = Math.max(0, Number(delay) || 0);
  const id = nextId++;
  timers.set(id, {
    id,
    at: now + ms,
    interval: interval ? Math.max(1, ms) : undefined,
    callback: callback as (...a: unknown[]) => void,
    args,
  });
  return id;
}

function nextTimer(limit: number): FakeTimer | undefined {
  let best: FakeTimer | undefined;
  for (const t of timers.values()) {
    if (t.at <= limit && (!best || t.at < best.at || (t.at === best.at && t.id < best.id))) best = t;
  }
  return best;
}

function fire(t: FakeTimer) {
  now = t.at;
  if (t.interval !== undefined) t.at += t.interval;
  else timers.delete(t.id);
  t.callback(...t.args);
}

export function useFakeTimers() {
  if (installed) return;
  installed = true;
  saved = {
    setTimeout: g.setTimeout,
    clearTimeout: g.clearTimeout,
    setInterval: g.setInterval,
    clearInterval: g.clearInterval,
    Date: g.Date,
  };
  now = real.Date.now();
  timers = new Map();
  g.setTimeout = ((cb: unknown, ms?: unknown, ...args: unknown[]) => add(cb, ms, args, false)) as never;
  g.setInterval = ((cb: unknown, ms?: unknown, ...args: unknown[]) => add(cb, ms, args, true)) as never;
  g.clearTimeout = ((id?: number) => {
    if (id !== undefined) timers.delete(id);
  }) as never;
  g.clearInterval = g.clearTimeout;
  const RealDate = real.Date;
  class FakeDate extends RealDate {
    constructor(...args: unknown[]) {
      if (args.length === 0) super(now);
      else super(...(args as [string | number]));
    }
    static override now() {
      return now;
    }
  }
  g.Date = FakeDate as DateConstructor;
}

export function useRealTimers() {
  if (!installed) return;
  installed = false;
  Object.assign(g, saved);
  timers.clear();
}

function assertInstalled(name: string) {
  if (!installed) throw new Error(`调用 vi.${name}() 之前需要先调用 vi.useFakeTimers()`);
}

export function advanceTimersByTime(ms: number) {
  assertInstalled('advanceTimersByTime');
  const target = now + ms;
  let guard = 0;
  for (let t = nextTimer(target); t; t = nextTimer(target)) {
    if (++guard > 100_000) throw new Error('计时器触发次数过多，可能存在无限循环');
    fire(t);
  }
  now = target;
}

const flush = () => new Promise<void>((resolve) => realTimers.setTimeout(resolve, 0));

export async function advanceTimersByTimeAsync(ms: number) {
  assertInstalled('advanceTimersByTimeAsync');
  const target = now + ms;
  await flush();
  let guard = 0;
  for (let t = nextTimer(target); t; t = nextTimer(target)) {
    if (++guard > 100_000) throw new Error('计时器触发次数过多，可能存在无限循环');
    fire(t);
    await flush();
  }
  now = target;
}

export function runAllTimers() {
  assertInstalled('runAllTimers');
  let guard = 0;
  for (let t = nextTimer(Infinity); t; t = nextTimer(Infinity)) {
    if (++guard > 10_000) throw new Error('runAllTimers：超过 10000 个计时器，可能存在无限循环的 setInterval');
    fire(t);
  }
}

export async function runAllTimersAsync() {
  assertInstalled('runAllTimersAsync');
  await flush();
  let guard = 0;
  for (let t = nextTimer(Infinity); t; t = nextTimer(Infinity)) {
    if (++guard > 10_000) throw new Error('runAllTimersAsync：超过 10000 个计时器，可能存在无限循环的 setInterval');
    fire(t);
    await flush();
  }
}

export function getTimerCount() {
  return installed ? timers.size : 0;
}
