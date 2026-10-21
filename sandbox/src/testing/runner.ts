import { LIMITS } from '../../../src/shared/limits.ts';
import type { TestResult } from '../../../src/shared/sandbox-protocol.ts';
import { format } from '../inspect.ts';
import { AssertionError, checkAssertionCount, expect, resetAssertionCounter, settleAsyncAssertions } from './expect.ts';
import { fn, restoreAllMocks, spyOn } from './mock.ts';
import * as timers from './timers.ts';
import { realTimers } from './timers.ts';

type Hook = () => unknown;

interface Suite {
  name: string;
  parent?: Suite;
  beforeEach: Hook[];
  afterEach: Hook[];
  beforeAll: Hook[];
  afterAll: Hook[];
}

interface TestCase {
  name: string;
  suite: Suite;
  fn: () => unknown;
  timeout?: number;
  skip: boolean;
}

export interface RunHooks {
  /** 平台在每个测试前执行（DOM 模式：重置页面并重新运行学生入口） */
  beforeEach?: () => Promise<void>;
  /** 平台在每个测试后执行（React 模式：cleanup） */
  afterEach?: () => Promise<void>;
  /** 把错误转成带位置的信息 */
  locate: (error: unknown) => { file: string; line: number; column: number } | undefined;
}

export class TestCollector {
  private readonly root: Suite = { name: '', beforeEach: [], afterEach: [], beforeAll: [], afterAll: [] };
  private current: Suite = this.root;
  private readonly tests: TestCase[] = [];
  private collecting = true;

  private register(name: string, body: () => unknown, timeout: number | undefined, skip: boolean) {
    if (!this.collecting) throw new Error('不能在测试运行过程中注册新的测试');
    if (typeof body !== 'function') throw new TypeError(`test("${name}") 的第二个参数必须是函数`);
    this.tests.push({ name, suite: this.current, fn: body, timeout, skip });
  }

  /** 暴露给测试文件的 API（import { test, expect } from 'vitest'） */
  api(): Record<string, unknown> {
    const test = Object.assign(
      (name: string, body: () => unknown, timeout?: number) => this.register(name, body, timeout, false),
      {
        skip: (name: string, body: () => unknown, timeout?: number) => this.register(name, body, timeout, true),
        each:
          (cases: readonly unknown[]) =>
          (name: string, body: (...args: unknown[]) => unknown, timeout?: number) => {
            cases.forEach((c, i) => {
              const args = Array.isArray(c) ? c : [c];
              // 与 Vitest 相同：只替换占位符，不把多余的参数追加到标题末尾
              const template = name.replace(/%#/g, String(i));
              const placeholders = (template.match(/%[sdifjoO]/g) ?? []).length;
              const title = placeholders > 0 ? format(template, ...args.slice(0, placeholders)) : `${template} (${i})`;
              this.register(title, () => body(...args), timeout, false);
            });
          },
      },
    );
    const describe = (name: string, body: () => void) => {
      const suite: Suite = { name, parent: this.current, beforeEach: [], afterEach: [], beforeAll: [], afterAll: [] };
      const prev = this.current;
      this.current = suite;
      try {
        body();
      } finally {
        this.current = prev;
      }
    };
    return {
      test,
      it: test,
      describe,
      beforeEach: (h: Hook) => this.current.beforeEach.push(h),
      afterEach: (h: Hook) => this.current.afterEach.push(h),
      beforeAll: (h: Hook) => this.current.beforeAll.push(h),
      afterAll: (h: Hook) => this.current.afterAll.push(h),
      expect,
      expectTypeOf: expectTypeOfRuntime,
      assertType: () => {},
      vi: {
        fn,
        spyOn,
        restoreAllMocks,
        useFakeTimers: timers.useFakeTimers,
        useRealTimers: timers.useRealTimers,
        advanceTimersByTime: timers.advanceTimersByTime,
        advanceTimersByTimeAsync: timers.advanceTimersByTimeAsync,
        runAllTimers: timers.runAllTimers,
        runAllTimersAsync: timers.runAllTimersAsync,
        getTimerCount: timers.getTimerCount,
      },
    };
  }

  get size() {
    return this.tests.length;
  }

  async run(hooks: RunHooks, perTestTimeoutMs: number, onResult?: (r: TestResult) => void): Promise<TestResult[]> {
    this.collecting = false;
    const results: TestResult[] = [];
    const startedSuites = new Set<Suite>();
    const chain = (s: Suite) => {
      const out: Suite[] = [];
      for (let cur: Suite | undefined = s; cur; cur = cur.parent) out.unshift(cur);
      return out;
    };
    const fullName = (t: TestCase) =>
      [...chain(t.suite).map((s) => s.name).filter(Boolean), t.name].join(' › ');

    for (let i = 0; i < this.tests.length; i++) {
      const t = this.tests[i]!;
      const name = fullName(t);
      if (t.skip) {
        const r: TestResult = { name, status: 'skip', durationMs: 0 };
        results.push(r);
        onResult?.(r);
        continue;
      }
      const suites = chain(t.suite);
      const started = performance.now();
      let failure: unknown;
      try {
        for (const s of suites) {
          if (!startedSuites.has(s)) {
            startedSuites.add(s);
            for (const h of s.beforeAll) await withTimeout(h, perTestTimeoutMs, 'beforeAll');
          }
        }
        resetAssertionCounter();
        await hooks.beforeEach?.();
        for (const s of suites) for (const h of s.beforeEach) await withTimeout(h, perTestTimeoutMs, 'beforeEach');
        await withTimeout(t.fn, t.timeout ?? perTestTimeoutMs, 'test');
        await withTimeout(settleAsyncAssertions, perTestTimeoutMs, 'test');
        checkAssertionCount();
      } catch (err) {
        failure = err;
      }
      try {
        for (const s of [...suites].reverse()) for (const h of s.afterEach) await withTimeout(h, perTestTimeoutMs, 'afterEach');
      } catch (err) {
        failure ??= err;
      }
      timers.useRealTimers();
      restoreAllMocks();
      try {
        await hooks.afterEach?.();
      } catch (err) {
        failure ??= err;
      }

      // 结束本测试所在、且后面不再有测试的 suite
      const next = this.tests[i + 1];
      const nextChain = next ? chain(next.suite) : [];
      for (const s of [...suites].reverse()) {
        if (!nextChain.includes(s) && startedSuites.has(s)) {
          try {
            for (const h of s.afterAll) await withTimeout(h, perTestTimeoutMs, 'afterAll');
          } catch (err) {
            failure ??= err;
          }
        }
      }

      const r: TestResult = { name: clip(name, 1000), status: failure === undefined ? 'pass' : 'fail', durationMs: performance.now() - started };
      if (failure !== undefined) r.error = describeFailure(failure, hooks.locate);
      results.push(r);
      onResult?.(r);
    }
    return results;
  }
}

/**
 * 结果要通过协议的长度检查，否则主页面会把整条消息当作不合法的数据丢弃，测试就“一直没有完成”。
 * waitFor 超时时会把整个页面的 DOM 附在错误消息后面，很容易超过上限。
 */
function clip(text: string, max: number = LIMITS.maxLogEntryChars): string {
  return text.length <= max ? text : `${text.slice(0, max - 20)}\n…（内容过长，已截断）`;
}

function describeFailure(err: unknown, locate: RunHooks['locate']): NonNullable<TestResult['error']> {
  if (err instanceof AssertionError) {
    return {
      message: clip(err.message),
      expected: err.expected === undefined ? undefined : clip(err.expected),
      actual: err.actual === undefined ? undefined : clip(err.actual),
      location: locate(err),
    };
  }
  if (err instanceof Error) {
    return { message: clip(`${err.name}: ${err.message}`), location: locate(err) };
  }
  return { message: clip(`抛出了非 Error 值：${format(err)}`) };
}

class TimeoutError extends Error {
  override name = 'TimeoutError';
}

async function withTimeout(body: () => unknown, ms: number, label: string): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      Promise.resolve().then(body),
      new Promise((_, reject) => {
        timer = realTimers.setTimeout(
          () =>
            reject(
              new TimeoutError(
                `${label === 'test' ? '测试' : label} 超过 ${ms} ms 仍未完成：可能有 Promise 永远不会 resolve，或忘记 await。`,
              ),
            ),
          ms,
        );
      }),
    ]);
  } finally {
    if (timer !== undefined) realTimers.clearTimeout(timer);
  }
}

/** expectTypeOf 在运行时什么也不检查（类型层面由编译器检查），只需返回可无限链式调用的对象。 */
function expectTypeOfRuntime(): unknown {
  const handler: ProxyHandler<() => unknown> = {
    get: () => proxy,
    apply: () => proxy,
  };
  const proxy: unknown = new Proxy(() => proxy, handler);
  return proxy;
}
