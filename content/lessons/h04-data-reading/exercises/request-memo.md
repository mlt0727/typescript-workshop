---
kind: task
title: 同一个请求中去重
---
在 `request-scope.ts` 中实现 `createRequestScope()` 返回的 `memo(fn)`。它是 `React.cache` 在一个请求中做的事：

1. `memo(fn)` 返回一个函数，参数和返回值的类型与 `fn` 相同；
2. 在同一个作用域中，用**同样的参数**再次调用这个函数时，不再调用 `fn`，直接返回第一次的结果（同一个值，对象就是同一个对象）。同样的参数是指：参数的个数相同，并且每个位置上的参数像 `Map` 的键那样相等：基本类型按值比较（`1` 和 `'1'` 不同，`NaN` 等于 `NaN`），对象按引用比较；
3. `fn` 抛出了错误时，同样的参数再次调用会抛出**同一个**错误，也不再调用 `fn`。`fn` 是异步函数时，返回的 Promise 本身就是结果：同时发出的调用共用一个 Promise，失败的 Promise 也一样被记住；
4. 每次调用 `memo` 都得到一份新的缓存；不同的作用域之间什么都不共享。

:::files{role=starter}
```ts file=request-scope.ts
export type RequestScope = Readonly<{
  /** 返回 fn 的一个包装：在这个作用域中，同样的参数只调用一次 fn */
  memo<Args extends readonly unknown[], R>(fn: (...args: Args) => R): (...args: Args) => R;
}>;

/** 一个请求的作用域：框架为每个请求创建一个，请求结束就丢掉 */
export function createRequestScope(): RequestScope {
  return {
    memo<Args extends readonly unknown[], R>(fn: (...args: Args) => R) {
      // TODO
      return fn;
    },
  };
}
```
```ts file=main.ts
import { createRequestScope } from './request-scope';

let queries = 0;
async function loadUser(id: string) {
  queries += 1;
  return { id, name: `用户 ${id}` };
}

// 模拟一次请求：页面中的三个组件各自读取自己需要的用户
async function renderPage() {
  const getUser = createRequestScope().memo(loadUser);
  const users = await Promise.all([getUser('1'), getUser('1'), getUser('2')]);
  return users.map((user) => user.name);
}

console.log(await renderPage(), '查询了', queries, '次');
console.log(await renderPage(), '查询了', queries, '次');
```
:::

:::files{role=solution}
```ts file=request-scope.ts
export type RequestScope = Readonly<{
  /** 返回 fn 的一个包装：在这个作用域中，同样的参数只调用一次 fn */
  memo<Args extends readonly unknown[], R>(fn: (...args: Args) => R): (...args: Args) => R;
}>;

type Outcome<R> = { ok: true; value: R } | { ok: false; error: unknown };

/** 参数树的一个节点：沿着参数一个一个往下走，走到的节点上保存这组参数的结果 */
type Node<R> = { children: Map<unknown, Node<R>>; outcome: Outcome<R> | undefined };

const newNode = <R>(): Node<R> => ({ children: new Map(), outcome: undefined });

/** 一个请求的作用域：框架为每个请求创建一个，请求结束就丢掉 */
export function createRequestScope(): RequestScope {
  return {
    memo<Args extends readonly unknown[], R>(fn: (...args: Args) => R) {
      const root = newNode<R>();
      return (...args: Args): R => {
        let node = root;
        for (const arg of args) {
          // Map 的键：基本类型按值比较（NaN 等于 NaN），对象按引用比较
          let child = node.children.get(arg);
          if (child === undefined) {
            child = newNode<R>();
            node.children.set(arg, child);
          }
          node = child;
        }
        if (node.outcome === undefined) {
          try {
            node.outcome = { ok: true, value: fn(...args) };
          } catch (error) {
            node.outcome = { ok: false, error };
          }
        }
        if (node.outcome.ok) return node.outcome.value;
        throw node.outcome.error;
      };
    },
  };
}
```
```ts file=main.ts
import { createRequestScope } from './request-scope';

let queries = 0;
async function loadUser(id: string) {
  queries += 1;
  return { id, name: `用户 ${id}` };
}

// 模拟一次请求：页面中的三个组件各自读取自己需要的用户
async function renderPage() {
  const getUser = createRequestScope().memo(loadUser);
  const users = await Promise.all([getUser('1'), getUser('1'), getUser('2')]);
  return users.map((user) => user.name);
}

console.log(await renderPage(), '查询了', queries, '次');
console.log(await renderPage(), '查询了', queries, '次');
```
:::

:::files{role=tests}
```ts file=request-scope.test.ts
import { describe, expect, test, vi } from 'vitest';
import { createRequestScope } from './request-scope';

describe('createRequestScope().memo', () => {
  test('同样的参数只调用一次，返回同一个结果', () => {
    const scope = createRequestScope();
    const load = vi.fn((id: string) => ({ id, name: `用户 ${id}` }));
    const getUser = scope.memo(load);
    const a = getUser('1');
    expect(getUser('1')).toBe(a);
    expect(getUser('2')).toStrictEqual({ id: '2', name: '用户 2' });
    expect(load).toHaveBeenCalledTimes(2);
  });

  test('每个参数都要相同，参数的个数也要相同', () => {
    const scope = createRequestScope();
    const fn = vi.fn((...args: unknown[]) => args.length);
    const memoized = scope.memo(fn);
    memoized('a', 1);
    memoized('a', 2);
    memoized('a');
    memoized('a', 1, undefined);
    memoized('a', 1);
    expect(fn).toHaveBeenCalledTimes(4);
  });

  test('基本类型按值比较：1 和 "1" 不同，NaN 和 NaN 相同', () => {
    const scope = createRequestScope();
    const fn = vi.fn((x: unknown) => typeof x);
    const memoized = scope.memo(fn);
    memoized(1);
    memoized('1');
    memoized(NaN);
    memoized(NaN);
    memoized(null);
    memoized(undefined);
    expect(fn).toHaveBeenCalledTimes(5);
  });

  test('对象按引用比较：内容相同的两个对象是不同的参数', () => {
    const scope = createRequestScope();
    const fn = vi.fn((filter: { status: string }) => filter.status);
    const memoized = scope.memo(fn);
    const filter = { status: 'open' };
    memoized(filter);
    memoized(filter);
    memoized({ status: 'open' });
    expect(fn).toHaveBeenCalledTimes(2);
  });

  test('抛出的错误也会被记住', () => {
    const scope = createRequestScope();
    const error = new Error('数据库不可用');
    const fn = vi.fn((_id: string): string => {
      throw error;
    });
    const memoized = scope.memo(fn);
    expect(() => memoized('1')).toThrow(error);
    let second: unknown;
    try {
      memoized('1');
    } catch (caught) {
      second = caught;
    }
    expect(second).toBe(error);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('异步函数：同时发出的调用共用一个 Promise，失败的 Promise 也一样', async () => {
    const scope = createRequestScope();
    const fn = vi.fn(async (id: string) => {
      if (id === 'x') throw new Error('不存在');
      return `用户 ${id}`;
    });
    const memoized = scope.memo(fn);
    const first = memoized('1');
    expect(memoized('1')).toBe(first);
    await expect(first).resolves.toBe('用户 1');
    const failed = memoized('x');
    expect(memoized('x')).toBe(failed);
    await expect(failed).rejects.toThrow('不存在');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  test('每次 memo 都有自己的缓存；不同的作用域（不同的请求）互不共享', () => {
    const fn = vi.fn((id: string) => id);
    const scope = createRequestScope();
    scope.memo(fn)('1');
    scope.memo(fn)('1');
    const other = createRequestScope();
    other.memo(fn)('1');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  test('一个页面中三个组件读取用户：同一个请求中数据库只查两次', async () => {
    const db = vi.fn(async (id: string) => ({ id }));
    const render = async () => {
      const getUser = createRequestScope().memo(db);
      return Promise.all([getUser('1'), getUser('1'), getUser('2')]);
    };
    await render();
    expect(db).toHaveBeenCalledTimes(2);
    await render();
    expect(db).toHaveBeenCalledTimes(4);
  });
});
```
:::

:::hint{level=1}
参数可以有很多个，每个都要“像 `Map` 的键那样”比较，那就用一棵 `Map` 的树：根节点的 `Map` 以第一个参数为键，子节点的 `Map` 以第二个参数为键……走完所有的参数，到达的那个节点上保存这组参数的结果。参数个数不同的两次调用会停在不同的节点上。
:::

:::hint{level=2}
节点保存的结果写成一个可辨识联合：`{ ok: true; value: R } | { ok: false; error: unknown }`。没有结果时，在 `try`/`catch` 中调用 `fn(...args)`，把返回值或者错误存进节点；然后返回值，或者 `throw` 存下的错误。
:::

:::explanation
`React.cache` 解决的是“组件各自读取自己需要的数据”带来的重复：布局、页面和几个子组件都需要当前的用户，与其在顶层读一次再一层一层地传下去，不如让每个组件直接调用 `getUser(id)`，由缓存保证同一个请求中只查一次。

比较参数时用 `Map` 的键的规则（SameValueZero），不用 `JSON.stringify`：后者把内容相同的两个对象当成同一个，把 `NaN` 和 `null` 都变成 `null`，还会在遇到 `bigint` 或循环引用时抛出错误。对象按引用比较也意味着：每次渲染都新建的对象参数（例如 `getPosts({ status: 'open' })`）永远命中不了缓存，传基本类型的参数更可靠。

错误也要记住：一个失败的查询，同一个请求中的其他组件再试一次大概率也会失败，还会让上游的压力翻倍。异步函数的结果是 Promise，记住 Promise 本身，同时发出的几次调用就自然地共用了一个请求。

缓存只属于一个作用域：Next.js 中 `React.cache` 的作用域是一个请求，请求之间不共享。跨请求的缓存是 `'use cache'` 的事，它需要的东西完全不同（下一个练习）。

替代解不用树，把每组参数和结果存进一个数组，逐个比较；参数组合多的时候会慢，但更容易看懂。
:::

:::variant{kind=alt name=linear-search}
```ts file=request-scope.ts
export type RequestScope = Readonly<{
  /** 返回 fn 的一个包装：在这个作用域中，同样的参数只调用一次 fn */
  memo<Args extends readonly unknown[], R>(fn: (...args: Args) => R): (...args: Args) => R;
}>;

/** SameValueZero：Map 的键、Array.prototype.includes 使用的比较方式 */
const same = (a: unknown, b: unknown) => a === b || (Number.isNaN(a) && Number.isNaN(b));

type Entry<R> = Readonly<{ args: readonly unknown[]; run: () => R }>;

/** 一个请求的作用域：框架为每个请求创建一个，请求结束就丢掉 */
export function createRequestScope(): RequestScope {
  return {
    memo<Args extends readonly unknown[], R>(fn: (...args: Args) => R) {
      // 每组参数一项，按顺序线性查找；run 重放第一次的结果（返回值或者抛出的错误）
      const entries: Entry<R>[] = [];
      return (...args: Args): R => {
        const found = entries.find((entry) => entry.args.length === args.length && entry.args.every((arg, i) => same(arg, args[i])));
        if (found !== undefined) return found.run();
        let run: () => R;
        try {
          const value = fn(...args);
          run = () => value;
        } catch (error) {
          run = () => {
            throw error;
          };
        }
        entries.push({ args, run });
        return run();
      };
    },
  };
}
```
:::

:::variant{kind=wrong name=json-key fails=tests reason="用 JSON.stringify(args) 当作键：内容相同的两个对象被当成了同一个参数，NaN 和 null 也分不开"}
```ts file=request-scope.ts
export type RequestScope = Readonly<{
  /** 返回 fn 的一个包装：在这个作用域中，同样的参数只调用一次 fn */
  memo<Args extends readonly unknown[], R>(fn: (...args: Args) => R): (...args: Args) => R;
}>;

type Outcome<R> = { ok: true; value: R } | { ok: false; error: unknown };

/** 参数树的一个节点：沿着参数一个一个往下走，走到的节点上保存这组参数的结果 */
type Node<R> = { children: Map<unknown, Node<R>>; outcome: Outcome<R> | undefined };

const newNode = <R>(): Node<R> => ({ children: new Map(), outcome: undefined });

/** 一个请求的作用域：框架为每个请求创建一个，请求结束就丢掉 */
export function createRequestScope(): RequestScope {
  return {
    memo<Args extends readonly unknown[], R>(fn: (...args: Args) => R) {
      const root = newNode<R>();
      return (...args: Args): R => {
        const key = JSON.stringify(args);
        let node = root.children.get(key);
        if (node === undefined) {
          node = newNode<R>();
          root.children.set(key, node);
        }
        if (node.outcome === undefined) {
          try {
            node.outcome = { ok: true, value: fn(...args) };
          } catch (error) {
            node.outcome = { ok: false, error };
          }
        }
        if (node.outcome.ok) return node.outcome.value;
        throw node.outcome.error;
      };
    },
  };
}
```
:::

:::variant{kind=wrong name=first-arg-only fails=tests reason="只按第一个参数区分：getPosts('a', 1) 和 getPosts('a', 2) 得到了同一个结果"}
```ts file=request-scope.ts
export type RequestScope = Readonly<{
  /** 返回 fn 的一个包装：在这个作用域中，同样的参数只调用一次 fn */
  memo<Args extends readonly unknown[], R>(fn: (...args: Args) => R): (...args: Args) => R;
}>;

type Outcome<R> = { ok: true; value: R } | { ok: false; error: unknown };

/** 参数树的一个节点：沿着参数一个一个往下走，走到的节点上保存这组参数的结果 */
type Node<R> = { children: Map<unknown, Node<R>>; outcome: Outcome<R> | undefined };

const newNode = <R>(): Node<R> => ({ children: new Map(), outcome: undefined });

/** 一个请求的作用域：框架为每个请求创建一个，请求结束就丢掉 */
export function createRequestScope(): RequestScope {
  return {
    memo<Args extends readonly unknown[], R>(fn: (...args: Args) => R) {
      const root = newNode<R>();
      return (...args: Args): R => {
        let node = root;
        for (const arg of args.slice(0, 1)) {
          // Map 的键：基本类型按值比较（NaN 等于 NaN），对象按引用比较
          let child = node.children.get(arg);
          if (child === undefined) {
            child = newNode<R>();
            node.children.set(arg, child);
          }
          node = child;
        }
        if (node.outcome === undefined) {
          try {
            node.outcome = { ok: true, value: fn(...args) };
          } catch (error) {
            node.outcome = { ok: false, error };
          }
        }
        if (node.outcome.ok) return node.outcome.value;
        throw node.outcome.error;
      };
    },
  };
}
```
:::

:::variant{kind=wrong name=string-key fails=tests reason="把参数转成字符串再比较：1 和 '1' 被当成了同一个参数"}
```ts file=request-scope.ts
export type RequestScope = Readonly<{
  /** 返回 fn 的一个包装：在这个作用域中，同样的参数只调用一次 fn */
  memo<Args extends readonly unknown[], R>(fn: (...args: Args) => R): (...args: Args) => R;
}>;

type Outcome<R> = { ok: true; value: R } | { ok: false; error: unknown };

/** 参数树的一个节点：沿着参数一个一个往下走，走到的节点上保存这组参数的结果 */
type Node<R> = { children: Map<unknown, Node<R>>; outcome: Outcome<R> | undefined };

const newNode = <R>(): Node<R> => ({ children: new Map(), outcome: undefined });

/** 一个请求的作用域：框架为每个请求创建一个，请求结束就丢掉 */
export function createRequestScope(): RequestScope {
  return {
    memo<Args extends readonly unknown[], R>(fn: (...args: Args) => R) {
      const root = newNode<R>();
      return (...args: Args): R => {
        let node = root;
        for (const arg of args) {
          // Map 的键：基本类型按值比较（NaN 等于 NaN），对象按引用比较
          let child = node.children.get(String(arg));
          if (child === undefined) {
            child = newNode<R>();
            node.children.set(String(arg), child);
          }
          node = child;
        }
        if (node.outcome === undefined) {
          try {
            node.outcome = { ok: true, value: fn(...args) };
          } catch (error) {
            node.outcome = { ok: false, error };
          }
        }
        if (node.outcome.ok) return node.outcome.value;
        throw node.outcome.error;
      };
    },
  };
}
```
:::

:::variant{kind=wrong name=errors-not-cached fails=tests reason="没有记住抛出的错误：同一个请求中，失败的查询又被执行了一次"}
```ts file=request-scope.ts
export type RequestScope = Readonly<{
  /** 返回 fn 的一个包装：在这个作用域中，同样的参数只调用一次 fn */
  memo<Args extends readonly unknown[], R>(fn: (...args: Args) => R): (...args: Args) => R;
}>;

type Outcome<R> = { ok: true; value: R } | { ok: false; error: unknown };

/** 参数树的一个节点：沿着参数一个一个往下走，走到的节点上保存这组参数的结果 */
type Node<R> = { children: Map<unknown, Node<R>>; outcome: Outcome<R> | undefined };

const newNode = <R>(): Node<R> => ({ children: new Map(), outcome: undefined });

/** 一个请求的作用域：框架为每个请求创建一个，请求结束就丢掉 */
export function createRequestScope(): RequestScope {
  return {
    memo<Args extends readonly unknown[], R>(fn: (...args: Args) => R) {
      const root = newNode<R>();
      return (...args: Args): R => {
        let node = root;
        for (const arg of args) {
          // Map 的键：基本类型按值比较（NaN 等于 NaN），对象按引用比较
          let child = node.children.get(arg);
          if (child === undefined) {
            child = newNode<R>();
            node.children.set(arg, child);
          }
          node = child;
        }
        if (node.outcome === undefined || !node.outcome.ok) {
          node.outcome = { ok: true, value: fn(...args) };
        }
        return node.outcome.value;
      };
    },
  };
}
```
:::

