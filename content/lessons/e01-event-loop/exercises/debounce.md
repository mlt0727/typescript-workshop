---
kind: challenge
title: 防抖
---
搜索框每输入一个字就发一次请求太浪费了。**防抖**（debounce）的做法是：等用户停止输入一段时间后，只执行最后一次。

实现 `debounce(fn, wait)`，返回一个新函数 `debounced`：

- 调用 `debounced(value)` 时，不立即执行 `fn`，而是重新开始计时；从**最后一次**调用起过了 `wait` 毫秒仍没有新的调用，才用**最后一次**的参数调用一次 `fn`。
- `debounced.cancel()`：取消正在等待的调用。
- `debounced.flush()`：如果有正在等待的调用，立即执行它（并取消计时）；没有则什么也不做。
- `debounced.pending()`：是否有正在等待的调用。

为了简化，`fn` 只接收一个字符串参数：`(value: string) => void`。

起始代码已经给出了返回值的形状。`Debounced` 类型中的 `(value: string): void` 叫**调用签名**，表示这个值可以像函数一样调用；它同时还带有 `cancel`、`flush`、`pending` 三个方法——JavaScript 中函数也是对象，可以附加属性。`Object.assign(函数, { … })` 把这些方法复制到函数对象上，并返回这个函数。你只需要实现它们的行为。

:::files{role=starter}
```ts file=debounce.ts
export type Debounced = {
  (value: string): void;
  cancel: () => void;
  flush: () => void;
  pending: () => boolean;
};

export function debounce(fn: (value: string) => void, wait: number): Debounced {
  const debounced = (value: string) => {
    setTimeout(() => fn(value), wait);
  };
  return Object.assign(debounced, {
    cancel: () => {},
    flush: () => {},
    pending: () => false,
  });
}
```
:::

:::files{role=solution}
```ts file=debounce.ts
export type Debounced = {
  (value: string): void;
  cancel: () => void;
  flush: () => void;
  pending: () => boolean;
};

export function debounce(fn: (value: string) => void, wait: number): Debounced {
  let timer: number | null = null;
  let lastValue = '';

  function run(): void {
    timer = null;
    fn(lastValue);
  }

  const debounced = (value: string): void => {
    lastValue = value;
    if (timer !== null) {
      clearTimeout(timer);
    }
    timer = setTimeout(run, wait);
  };

  return Object.assign(debounced, {
    cancel(): void {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
    },
    flush(): void {
      if (timer !== null) {
        clearTimeout(timer);
        run();
      }
    },
    pending(): boolean {
      return timer !== null;
    },
  });
}
```
:::

:::files{role=tests}
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
  test('连续调用只执行最后一次', () => {
    const fn = vi.fn();
    const search = debounce(fn, 300);
    search('t');
    vi.advanceTimersByTime(100);
    search('ty');
    vi.advanceTimersByTime(100);
    search('typ');
    vi.advanceTimersByTime(299);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('typ');
  });

  test('停顿足够久的两次调用各执行一次', () => {
    const fn = vi.fn();
    const search = debounce(fn, 200);
    search('a');
    vi.advanceTimersByTime(200);
    search('b');
    vi.advanceTimersByTime(200);
    expect(fn.mock.calls).toEqual([['a'], ['b']]);
  });

  test('cancel', () => {
    const fn = vi.fn();
    const search = debounce(fn, 200);
    search('a');
    expect(search.pending()).toBe(true);
    search.cancel();
    expect(search.pending()).toBe(false);
    vi.advanceTimersByTime(1000);
    expect(fn).not.toHaveBeenCalled();
  });

  test('flush 立即执行等待中的调用', () => {
    const fn = vi.fn();
    const search = debounce(fn, 200);
    search('now');
    search.flush();
    expect(fn).toHaveBeenCalledWith('now');
    expect(search.pending()).toBe(false);
    vi.advanceTimersByTime(1000);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('定时器到点执行之后，不再有等待中的调用', () => {
    const fn = vi.fn();
    const search = debounce(fn, 200);
    search('a');
    vi.advanceTimersByTime(200);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(search.pending()).toBe(false);
    search.flush();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('没有等待中的调用时 flush 什么也不做', () => {
    const fn = vi.fn();
    const search = debounce(fn, 200);
    search.flush();
    expect(fn).not.toHaveBeenCalled();
  });

  test('不同的防抖函数互不影响', () => {
    const a = vi.fn();
    const b = vi.fn();
    const da = debounce(a, 100);
    const db = debounce(b, 100);
    da('x');
    db('y');
    vi.advanceTimersByTime(100);
    expect(a).toHaveBeenCalledWith('x');
    expect(b).toHaveBeenCalledWith('y');
  });
});
```
:::

:::hint{level=1}
用闭包变量保存“当前的定时器编号”（没有等待时为 `null`）和“最后一次的参数”。每次调用都先清除旧的定时器，再设置新的。
:::

:::hint{level=2}
`debounced(value)`：保存 `lastValue = value`；如果 `timer !== null` 就 `clearTimeout(timer)`；然后 `timer = setTimeout(run, wait)`。`run` 把 `timer` 设回 `null` 再调用 `fn(lastValue)`。`flush` 在有定时器时清除它并立刻 `run()`。起始代码中的 `Object.assign(函数, { cancel, flush, pending })` 已经把方法挂到了函数上，保留这个结构即可。
:::

:::explanation
防抖的核心是“每次调用都重新计时”：`clearTimeout` 取消上一次安排的执行，`setTimeout` 重新安排。只有在 `wait` 毫秒内没有新调用时，定时器才会真正到点。

`timer` 同时充当“是否有等待中的调用”的标记：执行、取消、立即执行之后都把它设回 `null`，`pending()` 只需检查它。

起始代码每次调用都安排一个新的定时器，却从不取消旧的，于是每次输入都会执行一次——这正是防抖要解决的问题。

定时器编号的类型写成了 `number`：在浏览器（以及本平台）中 `setTimeout` 返回数字；在 Node.js 中它返回一个 `Timeout` 对象。需要同时兼容两种环境时，可以写 `ReturnType<typeof setTimeout>`（C 阶段讲这种写法）。

`Debounced` 类型中的 `(value: string): void` 叫**调用签名**：它描述的值既可以像函数一样调用，又带有 `cancel` 等属性。函数在 JavaScript 中也是对象，可以附加属性。
:::

:::variant{kind=alt name=class-backed}
```ts file=debounce.ts
export type Debounced = {
  (value: string): void;
  cancel: () => void;
  flush: () => void;
  pending: () => boolean;
};

class Debouncer {
  #timer: number | undefined;
  #value = '';
  readonly #fn: (value: string) => void;
  readonly #wait: number;

  constructor(fn: (value: string) => void, wait: number) {
    this.#fn = fn;
    this.#wait = wait;
  }

  call(value: string): void {
    this.#value = value;
    this.cancel();
    this.#timer = setTimeout(() => this.flush(), this.#wait);
  }

  cancel(): void {
    clearTimeout(this.#timer);
    this.#timer = undefined;
  }

  flush(): void {
    if (this.#timer === undefined) return;
    this.cancel();
    this.#fn(this.#value);
  }

  pending(): boolean {
    return this.#timer !== undefined;
  }
}

export function debounce(fn: (value: string) => void, wait: number): Debounced {
  const d = new Debouncer(fn, wait);
  return Object.assign((value: string) => d.call(value), {
    cancel: () => d.cancel(),
    flush: () => d.flush(),
    pending: () => d.pending(),
  });
}
```
:::

:::variant{kind=wrong name=throttle-like fails=tests reason="已有等待中的调用时忽略新调用，执行的是第一次而不是最后一次"}
```ts file=debounce.ts
export type Debounced = {
  (value: string): void;
  cancel: () => void;
  flush: () => void;
  pending: () => boolean;
};

export function debounce(fn: (value: string) => void, wait: number): Debounced {
  let timer: number | null = null;
  let lastValue = '';
  const run = () => {
    timer = null;
    fn(lastValue);
  };
  const debounced = (value: string) => {
    if (timer !== null) return;
    lastValue = value;
    timer = setTimeout(run, wait);
  };
  return Object.assign(debounced, {
    cancel: () => {
      if (timer !== null) clearTimeout(timer);
      timer = null;
    },
    flush: () => {
      if (timer !== null) {
        clearTimeout(timer);
        run();
      }
    },
    pending: () => timer !== null,
  });
}
```
:::

:::variant{kind=wrong name=no-clear fails=tests reason="没有清除旧的定时器，每次调用都会执行"}
```ts file=debounce.ts
export type Debounced = {
  (value: string): void;
  cancel: () => void;
  flush: () => void;
  pending: () => boolean;
};

export function debounce(fn: (value: string) => void, wait: number): Debounced {
  let timer: number | null = null;
  let lastValue = '';
  const run = () => {
    timer = null;
    fn(lastValue);
  };
  const debounced = (value: string) => {
    lastValue = value;
    timer = setTimeout(run, wait);
  };
  return Object.assign(debounced, {
    cancel: () => {
      if (timer !== null) clearTimeout(timer);
      timer = null;
    },
    flush: () => {
      if (timer !== null) {
        clearTimeout(timer);
        run();
      }
    },
    pending: () => timer !== null,
  });
}
```
:::

:::variant{kind=wrong name=flush-keeps-timer fails=tests reason="flush 执行后没有清除定时器，稍后又执行了一次"}
```ts file=debounce.ts
export type Debounced = {
  (value: string): void;
  cancel: () => void;
  flush: () => void;
  pending: () => boolean;
};

export function debounce(fn: (value: string) => void, wait: number): Debounced {
  let timer: number | null = null;
  let lastValue = '';
  const debounced = (value: string) => {
    lastValue = value;
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(lastValue);
    }, wait);
  };
  return Object.assign(debounced, {
    cancel: () => {
      if (timer !== null) clearTimeout(timer);
      timer = null;
    },
    flush: () => {
      if (timer !== null) fn(lastValue);
    },
    pending: () => timer !== null,
  });
}
```
:::

:::variant{kind=wrong name=run-keeps-timer fails=tests reason="定时器到点执行后没有把 timer 设回 null，pending 一直为真，flush 又执行了一次"}
```ts file=debounce.ts
export type Debounced = {
  (value: string): void;
  cancel: () => void;
  flush: () => void;
  pending: () => boolean;
};

export function debounce(fn: (value: string) => void, wait: number): Debounced {
  let timer: number | null = null;
  let lastValue = '';

  const debounced = (value: string): void => {
    lastValue = value;
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => fn(lastValue), wait);
  };

  return Object.assign(debounced, {
    cancel(): void {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
    },
    flush(): void {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
        fn(lastValue);
      }
    },
    pending(): boolean {
      return timer !== null;
    },
  });
}
```
:::
