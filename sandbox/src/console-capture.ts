import { LIMITS } from '../../src/shared/limits.ts';
import type { LogEntry } from '../../src/shared/sandbox-protocol.ts';
import { format, inspect } from './inspect.ts';

type Level = LogEntry['level'];

/**
 * 捕获 console 输出（格式与 Node.js 一致），按批次发送，并执行条数/字节上限。
 * 超出上限后只发送一条“输出已截断”的系统消息。
 */
export class LogSink {
  private buffer: LogEntry[] = [];
  private count = 0;
  private bytes = 0;
  private truncated = false;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private readonly start = performance.now();
  private readonly send: (entries: LogEntry[]) => void;
  private readonly realSetTimeout = globalThis.setTimeout.bind(globalThis);

  private readonly immediate: boolean;

  /** immediate：每条输出立刻发送（Worker 中使用：同步死循环被 terminate 前的输出也不会丢失） */
  constructor(send: (entries: LogEntry[]) => void, options: { immediate?: boolean } = {}) {
    this.send = send;
    this.immediate = options.immediate ?? false;
  }

  push(level: Level, text: string) {
    if (this.truncated) return;
    let t = text;
    if (t.length > LIMITS.maxLogEntryChars) t = `${t.slice(0, LIMITS.maxLogEntryChars)}…（本条输出过长，已截断）`;
    this.count++;
    this.bytes += t.length * 2;
    if (this.count > LIMITS.maxLogEntries || this.bytes > LIMITS.maxLogBytes) {
      this.truncated = true;
      this.buffer.push({
        level: 'system',
        text: `输出过多（超过 ${LIMITS.maxLogEntries} 条或 ${Math.round(LIMITS.maxLogBytes / 1024)} KB），之后的输出已省略。`,
        t: performance.now() - this.start,
      });
      this.flush();
      return;
    }
    this.buffer.push({ level, text: t, t: performance.now() - this.start });
    if (this.immediate || this.buffer.length >= 50) this.flush();
    else this.timer ??= this.realSetTimeout(() => this.flush(), 30);
  }

  flush() {
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
    if (this.buffer.length === 0) return;
    const entries = this.buffer;
    this.buffer = [];
    for (let i = 0; i < entries.length; i += 100) this.send(entries.slice(i, i + 100));
  }
}

function renderTable(data: unknown, columns?: readonly string[]): string | undefined {
  if (typeof data !== 'object' || data === null) return undefined;
  const rows: [string, unknown][] =
    data instanceof Map
      ? [...data.entries()].map(([k, v]) => [inspect(k), v])
      : Array.isArray(data)
        ? data.map((v, i) => [String(i), v])
        : Object.entries(data);
  const keys: string[] = [];
  let hasValues = false;
  for (const [, v] of rows) {
    if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      for (const k of Object.keys(v)) if (!keys.includes(k)) keys.push(k);
    } else if (Array.isArray(v)) {
      v.forEach((_, i) => {
        if (!keys.includes(String(i))) keys.push(String(i));
      });
    } else {
      hasValues = true;
    }
  }
  const cols = columns ? [...columns] : keys;
  const header = ['(index)', ...cols, ...(hasValues ? ['Values'] : [])];
  const body = rows.map(([index, v]) => {
    const cells = [index];
    for (const c of cols) {
      const has = typeof v === 'object' && v !== null && c in v;
      cells.push(has ? inspect((v as Record<string, unknown>)[c]) : '');
    }
    if (hasValues) cells.push(typeof v === 'object' && v !== null ? '' : inspect(v));
    return cells;
  });
  const widths = header.map((h, i) => Math.max(h.length, ...body.map((r) => (r[i] ?? '').length)) + 2);
  const line = (l: string, m: string, r: string) => l + widths.map((w) => '─'.repeat(w)).join(m) + r;
  const row = (cells: string[]) => `│${cells.map((c, i) => ` ${c.padEnd(widths[i]! - 1)}`).join('│')}│`;
  return [line('┌', '┬', '┐'), row(header), line('├', '┼', '┤'), ...body.map(row), line('└', '┴', '┘')].join('\n');
}

/** 用捕获版本替换 console 的方法；返回恢复函数。 */
export function captureConsole(sink: LogSink, target: Console = console): () => void {
  const original = { ...target };
  let indent = 0;
  const counts = new Map<string, number>();
  const timers = new Map<string, number>();
  const emit = (level: Level, text: string) => {
    const prefix = ' '.repeat(indent);
    sink.push(level, indent ? text.split('\n').map((l) => prefix + l).join('\n') : text);
  };
  const make =
    (level: Level) =>
    (...args: unknown[]) =>
      emit(level, format(...args));

  const replacements: Partial<Record<keyof Console, unknown>> = {
    log: make('log'),
    info: make('info'),
    debug: make('debug'),
    warn: make('warn'),
    error: make('error'),
    dir: (value: unknown) => emit('log', inspect(value)),
    trace: (...args: unknown[]) => emit('error', `Trace${args.length ? `: ${format(...args)}` : ''}`),
    table: (data: unknown, columns?: readonly string[]) => emit('log', renderTable(data, columns) ?? format(data)),
    group: (...args: unknown[]) => {
      if (args.length) emit('log', format(...args));
      indent += 2;
    },
    groupCollapsed: (...args: unknown[]) => {
      if (args.length) emit('log', format(...args));
      indent += 2;
    },
    groupEnd: () => {
      indent = Math.max(0, indent - 2);
    },
    count: (label = 'default') => {
      const n = (counts.get(label) ?? 0) + 1;
      counts.set(label, n);
      emit('info', `${label}: ${n}`);
    },
    countReset: (label = 'default') => {
      counts.set(label, 0);
    },
    time: (label = 'default') => {
      timers.set(label, performance.now());
    },
    timeLog: (label = 'default', ...args: unknown[]) => {
      const s = timers.get(label);
      if (s === undefined) return emit('warn', `Warning: No such label '${label}' for console.timeLog()`);
      emit('info', `${label}: ${(performance.now() - s).toFixed(3)}ms${args.length ? ` ${format(...args)}` : ''}`);
    },
    timeEnd: (label = 'default') => {
      const s = timers.get(label);
      if (s === undefined) return emit('warn', `Warning: No such label '${label}' for console.timeEnd()`);
      timers.delete(label);
      emit('info', `${label}: ${(performance.now() - s).toFixed(3)}ms`);
    },
    assert: (condition?: unknown, ...args: unknown[]) => {
      if (!condition) emit('error', `Assertion failed${args.length ? `: ${format(...args)}` : ''}`);
    },
    clear: () => {},
  };
  for (const [key, fn] of Object.entries(replacements)) {
    (target as unknown as Record<string, unknown>)[key] = fn;
  }
  return () => {
    Object.assign(target, original);
  };
}
