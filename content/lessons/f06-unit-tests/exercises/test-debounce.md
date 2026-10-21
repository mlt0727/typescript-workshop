---
kind: challenge
title: 为防抖函数写测试
grading: tests
---
`debounce.ts`（只读）实现了一个防抖函数，`debounce(fn, ms)` 返回 `debounced`：

1. 调用 `debounced(...args)` 之后，如果 `ms` 毫秒内没有再调用，就执行 `fn`，参数是**最后一次**调用的参数；在这期间每次调用都重新计时（正好过了 `ms` 毫秒时执行）；
2. `debounced.cancel()` 取消等待中的调用；
3. `debounced.flush()` 立即执行等待中的调用（之后不会再执行一次）；没有等待中的调用时什么也不做；
4. `debounced.pending()` 返回是否有等待中的调用；执行、取消之后都是 `false`。

在 `debounce.test.ts` 中为它写测试，用假计时器控制时间（起始代码已经在 `beforeEach`、`afterEach` 中打开和恢复了假计时器）。平台准备了十个故意写错的版本，你的测试要发现每一个。

:::files{role=support}
```ts file=debounce.ts readonly
export type Debounced<A extends unknown[]> = {
  (...args: A): void;
  /** 取消等待中的调用 */
  cancel(): void;
  /** 立即执行等待中的调用；没有等待中的调用时什么也不做 */
  flush(): void;
  /** 是否有等待中的调用 */
  pending(): boolean;
};

export function debounce<A extends unknown[]>(fn: (...args: A) => void, ms: number): Debounced<A> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastArgs: A | undefined;

  const clear = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  };
  const invoke = () => {
    const args = lastArgs;
    clear();
    lastArgs = undefined;
    if (args !== undefined) fn(...args);
  };

  const debounced = (...args: A) => {
    lastArgs = args;
    clear();
    timer = setTimeout(invoke, ms);
  };
  return Object.assign(debounced, {
    cancel() {
      clear();
      lastArgs = undefined;
    },
    flush() {
      if (timer !== undefined) invoke();
    },
    pending: () => timer !== undefined,
  });
}
```
:::

:::files{role=starter}
```ts file=debounce.test.ts
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { debounce } from './debounce';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('debounce', () => {
  test('300 毫秒之后调用', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 300);
    debounced('a');
    vi.advanceTimersByTime(300);
    expect(fn).toHaveBeenCalledWith('a');
  });
});
```
:::

:::files{role=solution}
```ts file=debounce.test.ts
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { debounce } from './debounce';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('debounce', () => {
  test('等待期间不调用，正好 ms 毫秒时调用一次', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 300);
    debounced('a');
    vi.advanceTimersByTime(299);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('a');
  });

  test('每次调用都重新计时，用最后一次调用的参数', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 300);
    debounced('a');
    vi.advanceTimersByTime(200);
    debounced('b');
    vi.advanceTimersByTime(200);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('b');
  });

  test('执行之后 pending() 为 false，可以再次触发', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 300);
    expect(debounced.pending()).toBe(false);
    debounced('a');
    expect(debounced.pending()).toBe(true);
    vi.advanceTimersByTime(300);
    expect(debounced.pending()).toBe(false);
    debounced('b');
    vi.advanceTimersByTime(300);
    expect(fn.mock.calls).toEqual([['a'], ['b']]);
  });

  test('cancel 取消等待中的调用', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 300);
    debounced('a');
    debounced.cancel();
    expect(debounced.pending()).toBe(false);
    vi.advanceTimersByTime(1000);
    expect(fn).not.toHaveBeenCalled();
  });

  test('flush 立即执行等待中的调用，之后不会再执行', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 300);
    debounced('a');
    debounced.flush();
    expect(fn).toHaveBeenCalledWith('a');
    vi.advanceTimersByTime(1000);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('没有等待中的调用时 flush 什么也不做', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 300);
    debounced.flush();
    expect(fn).not.toHaveBeenCalled();
  });
});
```
:::

:::mutant{name=no-reset hint="每次调用没有重新计时：从第一次调用开始算 ms 毫秒就执行了。需要在等待期间再调用一次"}
```ts file=debounce.ts
export type Debounced<A extends unknown[]> = {
  (...args: A): void;
  /** 取消等待中的调用 */
  cancel(): void;
  /** 立即执行等待中的调用；没有等待中的调用时什么也不做 */
  flush(): void;
  /** 是否有等待中的调用 */
  pending(): boolean;
};

export function debounce<A extends unknown[]>(fn: (...args: A) => void, ms: number): Debounced<A> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastArgs: A | undefined;

  const clear = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  };
  const invoke = () => {
    const args = lastArgs;
    clear();
    lastArgs = undefined;
    if (args !== undefined) fn(...args);
  };

  const debounced = (...args: A) => {
    lastArgs = args;
    timer = setTimeout(invoke, ms);
  };
  return Object.assign(debounced, {
    cancel() {
      clear();
      lastArgs = undefined;
    },
    flush() {
      if (timer !== undefined) invoke();
    },
    pending: () => timer !== undefined,
  });
}
```
:::

:::mutant{name=first-args hint="用的是第一次调用的参数，而不是最后一次的：需要连续调用两次、参数不同"}
```ts file=debounce.ts
export type Debounced<A extends unknown[]> = {
  (...args: A): void;
  /** 取消等待中的调用 */
  cancel(): void;
  /** 立即执行等待中的调用；没有等待中的调用时什么也不做 */
  flush(): void;
  /** 是否有等待中的调用 */
  pending(): boolean;
};

export function debounce<A extends unknown[]>(fn: (...args: A) => void, ms: number): Debounced<A> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastArgs: A | undefined;

  const clear = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  };
  const invoke = () => {
    const args = lastArgs;
    clear();
    lastArgs = undefined;
    if (args !== undefined) fn(...args);
  };

  const debounced = (...args: A) => {
    if (lastArgs === undefined) lastArgs = args;
    clear();
    timer = setTimeout(invoke, ms);
  };
  return Object.assign(debounced, {
    cancel() {
      clear();
      lastArgs = undefined;
    },
    flush() {
      if (timer !== undefined) invoke();
    },
    pending: () => timer !== undefined,
  });
}
```
:::

:::mutant{name=leading hint="第一次调用时立即执行了 fn，而不是等待 ms 毫秒：需要检查调用之后、时间到之前 fn 还没有被调用"}
```ts file=debounce.ts
export type Debounced<A extends unknown[]> = {
  (...args: A): void;
  /** 取消等待中的调用 */
  cancel(): void;
  /** 立即执行等待中的调用；没有等待中的调用时什么也不做 */
  flush(): void;
  /** 是否有等待中的调用 */
  pending(): boolean;
};

export function debounce<A extends unknown[]>(fn: (...args: A) => void, ms: number): Debounced<A> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastArgs: A | undefined;

  const clear = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  };
  const invoke = () => {
    const args = lastArgs;
    clear();
    lastArgs = undefined;
    if (args !== undefined) fn(...args);
  };

  const debounced = (...args: A) => {
    if (timer === undefined) fn(...args);
    else lastArgs = args;
    clear();
    timer = setTimeout(invoke, ms);
  };
  return Object.assign(debounced, {
    cancel() {
      clear();
      lastArgs = undefined;
    },
    flush() {
      if (timer !== undefined) invoke();
    },
    pending: () => timer !== undefined,
  });
}
```
:::

:::mutant{name=late hint="比 ms 晚了一倍才执行：需要检查正好到 ms 毫秒时 fn 已经被调用了"}
```ts file=debounce.ts
export type Debounced<A extends unknown[]> = {
  (...args: A): void;
  /** 取消等待中的调用 */
  cancel(): void;
  /** 立即执行等待中的调用；没有等待中的调用时什么也不做 */
  flush(): void;
  /** 是否有等待中的调用 */
  pending(): boolean;
};

export function debounce<A extends unknown[]>(fn: (...args: A) => void, ms: number): Debounced<A> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastArgs: A | undefined;

  const clear = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  };
  const invoke = () => {
    const args = lastArgs;
    clear();
    lastArgs = undefined;
    if (args !== undefined) fn(...args);
  };

  const debounced = (...args: A) => {
    lastArgs = args;
    clear();
    timer = setTimeout(invoke, ms * 2);
  };
  return Object.assign(debounced, {
    cancel() {
      clear();
      lastArgs = undefined;
    },
    flush() {
      if (timer !== undefined) invoke();
    },
    pending: () => timer !== undefined,
  });
}
```
:::

:::mutant{name=cancel-noop hint="cancel 什么也没做：需要检查 cancel 之后，时间到了 fn 也不会被调用"}
```ts file=debounce.ts
export type Debounced<A extends unknown[]> = {
  (...args: A): void;
  /** 取消等待中的调用 */
  cancel(): void;
  /** 立即执行等待中的调用；没有等待中的调用时什么也不做 */
  flush(): void;
  /** 是否有等待中的调用 */
  pending(): boolean;
};

export function debounce<A extends unknown[]>(fn: (...args: A) => void, ms: number): Debounced<A> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastArgs: A | undefined;

  const clear = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  };
  const invoke = () => {
    const args = lastArgs;
    clear();
    lastArgs = undefined;
    if (args !== undefined) fn(...args);
  };

  const debounced = (...args: A) => {
    lastArgs = args;
    clear();
    timer = setTimeout(invoke, ms);
  };
  return Object.assign(debounced, {
    cancel() {},
    flush() {
      if (timer !== undefined) invoke();
    },
    pending: () => timer !== undefined,
  });
}
```
:::

:::mutant{name=flush-twice hint="flush 执行了 fn，却没有清除计时器：时间到了又执行了一次。需要检查 flush 之后不会再执行"}
```ts file=debounce.ts
export type Debounced<A extends unknown[]> = {
  (...args: A): void;
  /** 取消等待中的调用 */
  cancel(): void;
  /** 立即执行等待中的调用；没有等待中的调用时什么也不做 */
  flush(): void;
  /** 是否有等待中的调用 */
  pending(): boolean;
};

export function debounce<A extends unknown[]>(fn: (...args: A) => void, ms: number): Debounced<A> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastArgs: A | undefined;

  const clear = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  };
  const invoke = () => {
    const args = lastArgs;
    clear();
    lastArgs = undefined;
    if (args !== undefined) fn(...args);
  };

  const debounced = (...args: A) => {
    lastArgs = args;
    clear();
    timer = setTimeout(invoke, ms);
  };
  return Object.assign(debounced, {
    cancel() {
      clear();
      lastArgs = undefined;
    },
    flush() {
      if (lastArgs !== undefined) fn(...lastArgs);
    },
    pending: () => timer !== undefined,
  });
}
```
:::

:::mutant{name=stale-pending hint="执行之后 pending() 仍然是 true：需要在执行之后检查 pending()"}
```ts file=debounce.ts
export type Debounced<A extends unknown[]> = {
  (...args: A): void;
  /** 取消等待中的调用 */
  cancel(): void;
  /** 立即执行等待中的调用；没有等待中的调用时什么也不做 */
  flush(): void;
  /** 是否有等待中的调用 */
  pending(): boolean;
};

export function debounce<A extends unknown[]>(fn: (...args: A) => void, ms: number): Debounced<A> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastArgs: A | undefined;

  const clear = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  };
  const invoke = () => {
    const args = lastArgs;
    lastArgs = undefined;
    if (args !== undefined) fn(...args);
  };

  const debounced = (...args: A) => {
    lastArgs = args;
    clear();
    timer = setTimeout(invoke, ms);
  };
  return Object.assign(debounced, {
    cancel() {
      clear();
      lastArgs = undefined;
    },
    flush() {
      if (timer !== undefined) invoke();
    },
    pending: () => timer !== undefined,
  });
}
```
:::

:::mutant{name=pending-always-false hint="等待期间 pending() 也是 false：需要在调用之后、执行之前检查 pending() 是 true"}
```ts file=debounce.ts
export type Debounced<A extends unknown[]> = {
  (...args: A): void;
  /** 取消等待中的调用 */
  cancel(): void;
  /** 立即执行等待中的调用；没有等待中的调用时什么也不做 */
  flush(): void;
  /** 是否有等待中的调用 */
  pending(): boolean;
};

export function debounce<A extends unknown[]>(fn: (...args: A) => void, ms: number): Debounced<A> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastArgs: A | undefined;

  const clear = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  };
  const invoke = () => {
    const args = lastArgs;
    clear();
    lastArgs = undefined;
    if (args !== undefined) fn(...args);
  };

  const debounced = (...args: A) => {
    lastArgs = args;
    clear();
    timer = setTimeout(invoke, ms);
  };
  return Object.assign(debounced, {
    cancel() {
      clear();
      lastArgs = undefined;
    },
    flush() {
      if (timer !== undefined) invoke();
    },
    pending: () => false,
  });
}
```
:::

:::mutant{name=flush-without-pending hint="没有等待中的调用时，flush 也执行了 fn（没有参数）：需要在没有调用过、或者已经执行完之后调用 flush，检查 fn 没有被调用"}
```ts file=debounce.ts
export type Debounced<A extends unknown[]> = {
  (...args: A): void;
  /** 取消等待中的调用 */
  cancel(): void;
  /** 立即执行等待中的调用；没有等待中的调用时什么也不做 */
  flush(): void;
  /** 是否有等待中的调用 */
  pending(): boolean;
};

export function debounce<A extends unknown[]>(fn: (...args: A) => void, ms: number): Debounced<A> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastArgs: A | undefined;

  const clear = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  };
  const invoke = () => {
    const args = lastArgs;
    clear();
    lastArgs = undefined;
    if (args !== undefined) fn(...args);
  };

  const debounced = (...args: A) => {
    lastArgs = args;
    clear();
    timer = setTimeout(invoke, ms);
  };
  return Object.assign(debounced, {
    cancel() {
      clear();
      lastArgs = undefined;
    },
    flush() {
      const args = lastArgs;
      clear();
      lastArgs = undefined;
      fn(...((args ?? []) as A));
    },
    pending: () => timer !== undefined,
  });
}
```
:::

:::mutant{name=cancel-keeps-timer hint="cancel 只丢掉了参数，没有清除计时器：fn 不会被调用，但 cancel 之后 pending() 仍然是 true。需要在 cancel 之后检查 pending()"}
```ts file=debounce.ts
export type Debounced<A extends unknown[]> = {
  (...args: A): void;
  /** 取消等待中的调用 */
  cancel(): void;
  /** 立即执行等待中的调用；没有等待中的调用时什么也不做 */
  flush(): void;
  /** 是否有等待中的调用 */
  pending(): boolean;
};

export function debounce<A extends unknown[]>(fn: (...args: A) => void, ms: number): Debounced<A> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastArgs: A | undefined;

  const clear = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  };
  const invoke = () => {
    const args = lastArgs;
    clear();
    lastArgs = undefined;
    if (args !== undefined) fn(...args);
  };

  const debounced = (...args: A) => {
    lastArgs = args;
    clear();
    timer = setTimeout(invoke, ms);
  };
  return Object.assign(debounced, {
    cancel() {
      lastArgs = undefined;
    },
    flush() {
      if (timer !== undefined) invoke();
    },
    pending: () => timer !== undefined,
  });
}
```
:::

:::hint{level=1}
起始代码中的测试只检查了“最后被调用了，参数是 `a`”。想一想还有哪些事“不应该发生”：时间到之前不应该调用（用 `advanceTimersByTime(299)` 再检查 `not.toHaveBeenCalled()`）；等待期间再调用一次，不应该按第一次的时间执行；`cancel`、`flush` 之后不应该再执行。
:::

:::hint{level=2}
`fn.mock.calls` 是每一次调用的参数组成的数组，`expect(fn.mock.calls).toEqual([['b']])` 一次检查了次数和参数。检查重新计时：调用 `a`，前进 200，调用 `b`，再前进 200（这时距离第一次调用已经 400 毫秒），`fn` 应该还没有被调用；再前进 100，应该正好被调用一次，参数是 `b`。
:::

:::explanation
防抖的规格里，一半是“会发生什么”，一半是“不会发生什么”：

- 时间到之前**不会**调用（发现“第一次调用就立即执行”）；
- 正好到 `ms` 毫秒时**会**调用（发现“晚了一倍才执行”）。用 299 加 1 两步推进，同时检查了这两条；
- 等待期间再调用，**不会**按第一次的时间执行（发现“没有重新计时”），并且用的是最后一次的参数（发现“用了第一次的参数”）；
- `cancel` 之后**不会**再调用；`flush` 之后**不会**再调用一次；
- 执行之后 `pending()` 是 `false`。

只检查“最后被调用了一次”的测试会漏掉好几个错误实现：立即执行的、晚了一倍才执行的、没有重新计时的、用了第一次参数的，只要时间推进得足够多，最终也都只调用了一次，错的是时间或参数。

假计时器让这些检查可以精确到毫秒，而且测试瞬间就能完成。记得在 `afterEach` 中 `vi.useRealTimers()`：假计时器是全局的，不恢复的话会影响其他测试。

错误解中有一个期望“调用之后立刻执行”：那是**节流**（throttle）的常见行为，在固定的时间间隔内最多执行一次，第一次通常立即执行。写测试之前先确认规格，测试表达的是规格，而不是你对这个函数的印象。
:::

:::variant{kind=alt name=shared-setup}
```ts file=debounce.test.ts
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { debounce } from './debounce';

let fn = vi.fn();
let saved = debounce(fn, 500);

beforeEach(() => {
  vi.useFakeTimers();
  fn = vi.fn();
  saved = debounce(fn, 500);
});
afterEach(() => {
  vi.useRealTimers();
});

test('输入停下 500 毫秒之后保存最后一次的内容', () => {
  for (const text of ['草', '草稿', '草稿一']) {
    saved(text);
    vi.advanceTimersByTime(400);
  }
  expect(fn).toHaveBeenCalledTimes(0);
  vi.advanceTimersByTime(100);
  expect(fn.mock.calls).toEqual([['草稿一']]);
  expect(saved.pending()).toBe(false);
});

test('时间到之前没有调用，到点立即调用', () => {
  saved('x');
  vi.advanceTimersByTime(499);
  expect(fn).toHaveBeenCalledTimes(0);
  vi.advanceTimersByTime(1);
  expect(fn).toHaveBeenCalledTimes(1);
});

test('等待中、cancel 之后的 pending()', () => {
  saved('x');
  expect(saved.pending()).toBe(true);
  saved.cancel();
  expect(saved.pending()).toBe(false);
});

test('cancel 与 flush', () => {
  saved('x');
  saved.cancel();
  saved.flush();
  vi.runAllTimers();
  expect(fn).toHaveBeenCalledTimes(0);

  saved('y');
  saved.flush();
  vi.runAllTimers();
  expect(fn.mock.calls).toEqual([['y']]);
});
```
:::

:::variant{kind=wrong name=only-final-count fails=mutants misses=no-reset,first-args,pending-always-false,flush-without-pending,cancel-keeps-timer reason="每个测试中只调用了一次 debounced，只数了 fn 被调用的次数：发现不了“没有重新计时”“用了第一次的参数”，也没有检查等待中和 cancel 之后的 pending()、没有等待时的 flush"}
```ts file=debounce.test.ts
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { debounce } from './debounce';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('debounce', () => {
  test('300 毫秒之后调用一次', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 300);
    debounced('a');
    vi.advanceTimersByTime(300);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(debounced.pending()).toBe(false);
  });

  test('cancel 与 flush', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 300);
    debounced('a');
    debounced.cancel();
    vi.advanceTimersByTime(1000);
    expect(fn).not.toHaveBeenCalled();
    debounced('b');
    debounced.flush();
    vi.advanceTimersByTime(1000);
    expect(fn.mock.calls).toEqual([['b']]);
  });
});
```
:::

:::variant{kind=wrong name=expects-immediate fails=tests reason="期望调用之后立刻执行：那是“节流”的行为，不是防抖"}
```ts file=debounce.test.ts
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { debounce } from './debounce';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('debounce', () => {
  test('调用之后立刻执行', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 300);
    debounced('a');
    expect(fn).toHaveBeenCalledWith('a');
  });
});
```
:::
