import { computeAccessibleName } from 'dom-accessibility-api';
import { inspect } from '../inspect.ts';
import { equals, matchesObject } from './equality.ts';
import { isMock, type MockFn } from './mock.ts';

/** 断言失败。expected/actual 是已格式化的文本，界面分别显示。 */
export class AssertionError extends Error {
  override name = 'AssertionError';
  expected?: string;
  actual?: string;
  constructor(message: string, expected?: string, actual?: string) {
    super(message);
    this.expected = expected;
    this.actual = actual;
  }
}

let assertionCount = 0;
let expectedAssertions: number | undefined;

/**
 * 本测试中的 resolves/rejects 断言。与 Vitest 5 一致：测试函数结束时还没有被 await（或 then）的，
 * 先等它完成，再让测试失败——即使断言本身成立，因为不 await 时它不一定在测试结束前完成。
 */
interface AsyncAssertion {
  promise: Promise<void>;
  awaited: boolean;
  /** 在调用断言的位置创建，错误位置指向测试中的那一行 */
  notAwaited: AssertionError;
}
let asyncAssertions: AsyncAssertion[] = [];

export function resetAssertionCounter() {
  assertionCount = 0;
  expectedAssertions = undefined;
  asyncAssertions = [];
}

/** 测试函数结束后调用：等待没有被 await 的 resolves/rejects 断言，断言失败或没有被 await 时抛出 */
export async function settleAsyncAssertions(): Promise<void> {
  const pending = asyncAssertions.filter((a) => !a.awaited);
  asyncAssertions = [];
  for (const a of pending) await a.promise;
  const first = pending[0];
  if (first) throw first.notAwaited;
}

export function checkAssertionCount() {
  if (expectedAssertions !== undefined && assertionCount !== expectedAssertions) {
    throw new AssertionError(
      `expect.assertions(${expectedAssertions})：期望执行 ${expectedAssertions} 次断言，实际执行了 ${assertionCount} 次`,
      String(expectedAssertions),
      String(assertionCount),
    );
  }
}

const show = (v: unknown) => inspect(v);

interface MatcherResult {
  pass: boolean;
  /** 断言成立/不成立时的说明 */
  message: string;
  expected?: string;
  actual?: string;
}

type Matcher = (actual: unknown, ...args: unknown[]) => MatcherResult;

function isElement(v: unknown): v is Element {
  return typeof Element !== 'undefined' && v instanceof Element;
}

function requireElement(v: unknown, matcher: string): Element {
  if (!isElement(v)) {
    throw new AssertionError(`${matcher}() 需要一个 DOM 元素，实际收到：${show(v)}`);
  }
  return v;
}

function requireMock(v: unknown, matcher: string): MockFn {
  if (!isMock(v)) throw new AssertionError(`${matcher}() 需要 vi.fn() 或 vi.spyOn() 创建的模拟函数，实际收到：${show(v)}`);
  return v;
}

function getPath(obj: unknown, path: string | readonly (string | number)[]): { found: boolean; value: unknown } {
  const parts = typeof path === 'string' ? path.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean) : path;
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur === null || cur === undefined) return { found: false, value: undefined };
    const box = Object(cur) as Record<string | number, unknown>;
    if (!(p in box)) return { found: false, value: undefined };
    cur = box[p];
  }
  return { found: true, value: cur };
}

function normalizeWs(s: string) {
  return s.replace(/\s+/g, ' ').trim();
}

function elementValue(el: Element): unknown {
  if (el instanceof HTMLSelectElement) {
    const selected = [...el.options].filter((o) => o.selected).map((o) => o.value);
    return el.multiple ? selected : (selected[0] ?? null);
  }
  if (el instanceof HTMLInputElement) {
    if (el.type === 'number' || el.type === 'range') return el.value === '' ? null : Number(el.value);
    if (el.type === 'checkbox' || el.type === 'radio') {
      throw new AssertionError('toHaveValue() 不适用于 checkbox/radio，请使用 toBeChecked()');
    }
    return el.value;
  }
  if (el instanceof HTMLTextAreaElement) return el.value;
  return el.getAttribute('value');
}

function isVisible(el: Element): boolean {
  if (!el.isConnected) return false;
  for (let cur: Element | null = el; cur; cur = cur.parentElement) {
    const style = getComputedStyle(cur);
    if (style.display === 'none') return false;
    if (style.visibility === 'hidden' || style.visibility === 'collapse') return false;
    if (style.opacity === '0') return false;
    if (cur.hasAttribute('hidden')) return false;
  }
  return true;
}

const matchers: Record<string, Matcher> = {
  toBe: (a, e) => ({
    pass: Object.is(a, e),
    message:
      typeof a === 'object' && a !== null && equals(a, e, true)
        ? 'toBe 使用 Object.is 比较：两个对象结构相同但不是同一个引用。比较内容请用 toEqual。'
        : 'toBe 使用 Object.is 比较',
    expected: show(e),
    actual: show(a),
  }),
  toEqual: (a, e) => ({ pass: equals(a, e, false), message: 'toEqual 递归比较内容', expected: show(e), actual: show(a) }),
  toStrictEqual: (a, e) => ({
    pass: equals(a, e, true),
    message: 'toStrictEqual 递归比较内容，并检查 undefined 属性与对象类型',
    expected: show(e),
    actual: show(a),
  }),
  toBeTruthy: (a) => ({ pass: Boolean(a), message: '期望值为 truthy', actual: show(a) }),
  toBeFalsy: (a) => ({ pass: !a, message: '期望值为 falsy', actual: show(a) }),
  toBeNull: (a) => ({ pass: a === null, message: '期望值为 null', expected: 'null', actual: show(a) }),
  toBeUndefined: (a) => ({ pass: a === undefined, message: '期望值为 undefined', expected: 'undefined', actual: show(a) }),
  toBeDefined: (a) => ({ pass: a !== undefined, message: '期望值不是 undefined', actual: show(a) }),
  toBeNaN: (a) => ({ pass: Number.isNaN(a), message: '期望值为 NaN', expected: 'NaN', actual: show(a) }),
  toBeTypeOf: (a, t) => ({ pass: typeof a === t, message: `期望 typeof 为 ${String(t)}`, expected: String(t), actual: typeof a }),
  toBeInstanceOf: (a, cls) => ({
    pass: typeof cls === 'function' && a instanceof (cls as new () => unknown),
    message: `期望是 ${(cls as { name?: string }).name ?? '?'} 的实例`,
    expected: (cls as { name?: string }).name ?? '?',
    actual: show(a),
  }),
  toContain: (a, item) => {
    let pass = false;
    if (typeof a === 'string') pass = typeof item === 'string' && a.includes(item);
    else if (typeof a === 'object' && a !== null && Symbol.iterator in a) {
      pass = [...(a as Iterable<unknown>)].some((x) => x === item);
    } else if (typeof DOMTokenList !== 'undefined' && a instanceof DOMTokenList) {
      pass = a.contains(String(item));
    }
    return { pass, message: '期望包含该项（使用 === 比较；比较对象内容请用 toContainEqual）', expected: show(item), actual: show(a) };
  },
  toContainEqual: (a, item) => ({
    pass: Array.isArray(a) && a.some((x) => equals(x, item, false)),
    message: '期望数组中有一项与之相等（toEqual 语义）',
    expected: show(item),
    actual: show(a),
  }),
  toHaveLength: (a, n) => {
    const len = (a as { length?: unknown } | null)?.length;
    return { pass: len === n, message: '期望 length 为指定值', expected: show(n), actual: show(len) };
  },
  toHaveProperty: (a, path, ...rest) => {
    const { found, value } = getPath(a, path as string);
    const checkValue = rest.length > 0;
    const pass = found && (!checkValue || equals(value, rest[0], false));
    return {
      pass,
      message: checkValue ? `期望属性 ${show(path)} 存在且等于给定值` : `期望属性 ${show(path)} 存在`,
      expected: checkValue ? show(rest[0]) : undefined,
      actual: found ? show(value) : '（属性不存在）',
    };
  },
  toMatchObject: (a, e) => ({ pass: matchesObject(a, e), message: '期望包含给定对象的所有属性（递归）', expected: show(e), actual: show(a) }),
  toBeGreaterThan: (a, n) => ({ pass: (a as number) > (n as number), message: `期望 > ${show(n)}`, actual: show(a) }),
  toBeGreaterThanOrEqual: (a, n) => ({ pass: (a as number) >= (n as number), message: `期望 >= ${show(n)}`, actual: show(a) }),
  toBeLessThan: (a, n) => ({ pass: (a as number) < (n as number), message: `期望 < ${show(n)}`, actual: show(a) }),
  toBeLessThanOrEqual: (a, n) => ({ pass: (a as number) <= (n as number), message: `期望 <= ${show(n)}`, actual: show(a) }),
  toBeCloseTo: (a, e, digits = 2) => {
    const pass =
      typeof a === 'number' &&
      typeof e === 'number' &&
      (a === e || Math.abs(a - e) < 10 ** -(digits as number) / 2);
    return { pass, message: `期望在 ${String(digits)} 位小数精度内相等`, expected: show(e), actual: show(a) };
  },
  toMatch: (a, e) => ({
    pass: typeof a === 'string' && (typeof e === 'string' ? a.includes(e) : (e as RegExp).test(a)),
    message: '期望字符串匹配',
    expected: show(e),
    actual: show(a),
  }),
  toThrow: (a, e) => {
    if (typeof a !== 'function') throw new AssertionError(`toThrow() 需要传入一个函数，实际收到：${show(a)}`);
    let threw = false;
    let error: unknown;
    try {
      (a as () => unknown)();
    } catch (err) {
      threw = true;
      error = err;
    }
    if (!threw) return { pass: false, message: '期望函数抛出错误，但它正常返回了', actual: '（没有抛出）' };
    const msg = error instanceof Error ? error.message : String(error);
    let pass = true;
    let expected: string | undefined;
    if (typeof e === 'string') {
      pass = msg.includes(e);
      expected = `消息包含 ${show(e)}`;
    } else if (e instanceof RegExp) {
      pass = e.test(msg);
      expected = `消息匹配 ${String(e)}`;
    } else if (typeof e === 'function') {
      pass = error instanceof (e as new () => unknown);
      expected = `${(e as { name?: string }).name} 的实例`;
    } else if (e instanceof Error) {
      pass = msg === e.message;
      expected = `消息为 ${show(e.message)}`;
    }
    return { pass, message: '期望抛出符合条件的错误', expected, actual: show(error) };
  },
  toHaveBeenCalled: (a) => {
    const m = requireMock(a, 'toHaveBeenCalled');
    return { pass: m.mock.calls.length > 0, message: '期望模拟函数被调用过', actual: `调用了 ${m.mock.calls.length} 次` };
  },
  toHaveBeenCalledTimes: (a, n) => {
    const m = requireMock(a, 'toHaveBeenCalledTimes');
    return { pass: m.mock.calls.length === n, message: '期望调用次数', expected: show(n), actual: show(m.mock.calls.length) };
  },
  toHaveBeenCalledWith: (a, ...args) => {
    const m = requireMock(a, 'toHaveBeenCalledWith');
    return {
      pass: m.mock.calls.some((c) => equals(c, args, false)),
      message: '期望至少有一次调用使用了这些参数',
      expected: show(args),
      actual: show(m.mock.calls),
    };
  },
  toHaveBeenLastCalledWith: (a, ...args) => {
    const m = requireMock(a, 'toHaveBeenLastCalledWith');
    return { pass: equals(m.mock.lastCall, args, false), message: '期望最后一次调用使用了这些参数', expected: show(args), actual: show(m.mock.lastCall) };
  },
  toHaveReturnedWith: (a, v) => {
    const m = requireMock(a, 'toHaveReturnedWith');
    return {
      pass: m.mock.results.some((r) => r.type === 'return' && equals(r.value, v, false)),
      message: '期望至少有一次返回该值',
      expected: show(v),
      actual: show(m.mock.results.map((r) => r.value)),
    };
  },

  // —— DOM ——
  toBeInTheDocument: (a) => {
    if (a === null) return { pass: false, message: '期望元素在文档中', actual: 'null' };
    const el = requireElement(a, 'toBeInTheDocument');
    return { pass: el.ownerDocument.contains(el), message: '期望元素在文档中', actual: el.isConnected ? '在文档中' : '不在文档中' };
  },
  toHaveTextContent: (a, text, opts) => {
    const el = requireElement(a, 'toHaveTextContent');
    const normalize = (opts as { normalizeWhitespace?: boolean } | undefined)?.normalizeWhitespace ?? true;
    const content = normalize ? normalizeWs(el.textContent ?? '') : (el.textContent ?? '');
    // 与 jest-dom 一致：用空字符串检查时，只有内容确实为空才通过（否则“包含空字符串”永远成立）
    if (text === '') {
      return {
        pass: content === '',
        message: '用空字符串检查时，期望文本内容为空（检查元素是否为空，更推荐 toBeEmptyDOMElement()）',
        expected: show(''),
        actual: show(content),
      };
    }
    const pass = typeof text === 'string' ? content.includes(normalize ? normalizeWs(text) : text) : (text as RegExp).test(content);
    return { pass, message: '期望文本内容包含/匹配', expected: show(text), actual: show(content) };
  },
  toHaveValue: (a, ...rest) => {
    const el = requireElement(a, 'toHaveValue');
    const value = elementValue(el);
    const pass = rest.length === 0 ? value !== '' && value !== null && !(Array.isArray(value) && value.length === 0) : equals(value, rest[0], false);
    return { pass, message: rest.length ? '期望表单值相等' : '期望表单控件有值', expected: rest.length ? show(rest[0]) : undefined, actual: show(value) };
  },
  toBeDisabled: (a) => {
    const el = requireElement(a, 'toBeDisabled');
    return { pass: el.matches(':disabled'), message: '期望元素被禁用', actual: el.matches(':disabled') ? 'disabled' : 'enabled' };
  },
  toBeEnabled: (a) => {
    const el = requireElement(a, 'toBeEnabled');
    return { pass: !el.matches(':disabled'), message: '期望元素可用（未禁用）', actual: el.matches(':disabled') ? 'disabled' : 'enabled' };
  },
  toBeRequired: (a) => {
    const el = requireElement(a, 'toBeRequired');
    const pass = el.matches(':required') || el.getAttribute('aria-required') === 'true';
    return { pass, message: '期望元素是必填的', actual: pass ? 'required' : 'not required' };
  },
  toBeChecked: (a) => {
    const el = requireElement(a, 'toBeChecked');
    const pass =
      el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio')
        ? el.checked
        : el.getAttribute('aria-checked') === 'true';
    return { pass, message: '期望元素处于选中状态', actual: pass ? 'checked' : 'unchecked' };
  },
  toBeVisible: (a) => {
    const el = requireElement(a, 'toBeVisible');
    const pass = isVisible(el);
    return { pass, message: '期望元素可见（在文档中，且自身与祖先没有 display:none / visibility:hidden / opacity:0 / hidden 属性）', actual: pass ? '可见' : '不可见' };
  },
  toBeEmptyDOMElement: (a) => {
    const el = requireElement(a, 'toBeEmptyDOMElement');
    const pass = [...el.childNodes].every((n) => n.nodeType === Node.COMMENT_NODE);
    return { pass, message: '期望元素没有子节点', actual: show(el.innerHTML) };
  },
  toHaveFocus: (a) => {
    const el = requireElement(a, 'toHaveFocus');
    const active = el.ownerDocument.activeElement;
    return { pass: active === el, message: '期望元素获得焦点', actual: active ? show(active) : 'null' };
  },
  toHaveAttribute: (a, name, ...rest) => {
    const el = requireElement(a, 'toHaveAttribute');
    const has = el.hasAttribute(String(name));
    const value = el.getAttribute(String(name));
    const pass = has && (rest.length === 0 || value === rest[0]);
    return { pass, message: `期望有属性 ${String(name)}${rest.length ? ` 且值为 ${show(rest[0])}` : ''}`, expected: rest.length ? show(rest[0]) : undefined, actual: has ? show(value) : '（没有该属性）' };
  },
  toHaveClass: (a, ...names) => {
    const el = requireElement(a, 'toHaveClass');
    const list = names.flatMap((n) => String(n).split(/\s+/)).filter(Boolean);
    const pass = list.length === 0 ? el.classList.length > 0 : list.every((n) => el.classList.contains(n));
    return { pass, message: '期望包含这些 class', expected: show(list), actual: show(el.className) };
  },
  toContainElement: (a, other) => {
    const el = requireElement(a, 'toContainElement');
    const child = other === null ? null : requireElement(other, 'toContainElement');
    return { pass: child !== null && el.contains(child), message: '期望包含这个元素', actual: child === null ? 'null' : child.isConnected ? '不在其中' : '不在文档中' };
  },
  toHaveStyle: (a, css) => {
    const el = requireElement(a, 'toHaveStyle');
    const expected: [string, string][] =
      typeof css === 'string'
        ? css
            .split(';')
            .map((d) => d.trim())
            .filter((d) => d.includes(':'))
            .map((d) => [d.slice(0, d.indexOf(':')).trim(), d.slice(d.indexOf(':') + 1).trim()])
        : Object.entries(css as Record<string, string>).map(([k, v]) => [k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`), String(v)]);
    const computed = getComputedStyle(el);
    // 用一个临时元素把期望值也规范化成计算值（例如 red → rgb(255, 0, 0)）
    const probe = el.ownerDocument.createElement(el.tagName);
    probe.style.cssText = expected.map(([k, v]) => `${k}: ${v}`).join('; ');
    el.parentElement?.append(probe);
    const probeStyle = getComputedStyle(probe);
    const mismatches = expected
      .map(([k, v]) => ({ k, want: probe.isConnected ? probeStyle.getPropertyValue(k) || v : v, got: computed.getPropertyValue(k) }))
      .filter((m) => m.want !== m.got);
    probe.remove();
    return {
      pass: mismatches.length === 0,
      message: '期望计算后的样式',
      expected: expected.map(([k, v]) => `${k}: ${v}`).join('; '),
      actual: mismatches.map((m) => `${m.k}: ${m.got}`).join('; ') || '一致',
    };
  },
  toHaveAccessibleName: (a, ...rest) => {
    const el = requireElement(a, 'toHaveAccessibleName');
    const name = computeAccessibleName(el);
    const e = rest[0];
    const pass = rest.length === 0 || e === undefined ? name !== '' : typeof e === 'string' ? name === e : (e as RegExp).test(name);
    return { pass, message: '期望可访问名称（accessible name）', expected: e === undefined ? undefined : show(e), actual: show(name) };
  },
  toBeInvalid: (a) => {
    const el = requireElement(a, 'toBeInvalid');
    const invalid =
      el.getAttribute('aria-invalid') === 'true' ||
      ('checkValidity' in el && typeof el.checkValidity === 'function' && !(el as HTMLInputElement).checkValidity());
    return { pass: invalid, message: '期望元素处于无效状态（aria-invalid="true" 或未通过约束验证）', actual: invalid ? 'invalid' : 'valid' };
  },
  toBeValid: (a) => {
    const el = requireElement(a, 'toBeValid');
    const invalid =
      el.getAttribute('aria-invalid') === 'true' ||
      ('checkValidity' in el && typeof el.checkValidity === 'function' && !(el as HTMLInputElement).checkValidity());
    return { pass: !invalid, message: '期望元素处于有效状态', actual: invalid ? 'invalid' : 'valid' };
  },
};
matchers.toThrowError = matchers.toThrow!;

type AsyncMode = 'resolves' | 'rejects' | undefined;

function buildAssertion(actual: unknown, negate: boolean, asyncMode: AsyncMode, customMessage?: string): object {
  const target: Record<string, unknown> = {};
  for (const [name, matcher] of Object.entries(matchers)) {
    target[name] = (...args: unknown[]) => {
      assertionCount++;
      const evaluate = (value: unknown) => {
        const r = matcher(value, ...args);
        if (r.pass === negate) {
          const head = `expect(…)${negate ? '.not' : ''}.${name}(${args.map((x) => show(x)).join(', ')})`;
          const why = negate ? `断言取反失败：${r.message}——但条件成立了` : r.message;
          throw new AssertionError(
            `${customMessage ? `${customMessage}\n` : ''}${head}\n${why}`,
            negate ? (r.expected ? `不是 ${r.expected}` : undefined) : r.expected,
            r.actual,
          );
        }
      };
      if (asyncMode === undefined) {
        evaluate(actual);
        return undefined;
      }
      const label = `expect(…)${negate ? '.not' : ''}.${asyncMode}.${name}(…)`;
      const record: AsyncAssertion = {
        promise: Promise.resolve(),
        awaited: false,
        notAwaited: new AssertionError(
          `${label} 返回的 Promise 没有被 await。这是异步的断言，必须写成 await ${label}，否则它不一定在测试结束前完成（Vitest 同样会让这个测试失败）。`,
        ),
      };
      record.promise = (async () => {
        if (!actual || typeof (actual as PromiseLike<unknown>).then !== 'function') {
          throw new AssertionError(`expect(…).${asyncMode} 需要一个 Promise，实际收到：${show(actual)}`);
        }
        let value: unknown;
        try {
          value = await actual;
        } catch (err) {
          if (asyncMode === 'resolves') {
            throw new AssertionError(`expect(…).resolves：期望 Promise 成功，但它被拒绝了：${show(err)}`);
          }
          // 与 Vitest 一致：rejects.toThrow(…) 检查的是拒绝原因本身
          if (name === 'toThrow' || name === 'toThrowError') {
            evaluate(() => {
              throw err;
            });
          } else {
            evaluate(err);
          }
          return;
        }
        if (asyncMode === 'rejects') {
          throw new AssertionError(`expect(…).rejects：期望 Promise 被拒绝，但它成功了，值为：${show(value)}`);
        }
        evaluate(value);
      })();
      // 没有被 await 时，失败由 settleAsyncAssertions 报告，不再显示为“未处理的 Promise 拒绝”
      record.promise.catch(() => {});
      asyncAssertions.push(record);
      // 返回 thenable 而不是原生 Promise：await、Promise.all、return 都会调用 then，从而记下“已经 await”
      // （await 原生 Promise 时不会读取它的 then 属性，无法得知）
      return {
        then<A = void, B = never>(onFulfilled?: ((v: void) => A | PromiseLike<A>) | null, onRejected?: ((e: unknown) => B | PromiseLike<B>) | null) {
          record.awaited = true;
          return record.promise.then(onFulfilled, onRejected);
        },
        catch<B = never>(onRejected?: ((e: unknown) => B | PromiseLike<B>) | null) {
          record.awaited = true;
          return record.promise.catch(onRejected);
        },
        finally(onFinally?: (() => void) | null) {
          record.awaited = true;
          return record.promise.finally(onFinally);
        },
        [Symbol.toStringTag]: 'Promise',
      };
    };
  }
  Object.defineProperty(target, 'not', { get: () => buildAssertion(actual, !negate, asyncMode, customMessage) });
  Object.defineProperty(target, 'resolves', { get: () => buildAssertion(actual, negate, 'resolves', customMessage) });
  Object.defineProperty(target, 'rejects', { get: () => buildAssertion(actual, negate, 'rejects', customMessage) });
  return target;
}

export const expect = Object.assign((actual: unknown, message?: string) => buildAssertion(actual, false, undefined, message), {
  assertions(count: number) {
    expectedAssertions = count;
  },
});
