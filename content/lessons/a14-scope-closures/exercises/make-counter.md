---
kind: task
title: 互不干扰的计数器
---
`createCounter(start)` 创建一个计数器，返回一个包含三个函数的对象：

- `increment()`：计数加 1，返回加 1 之后的值；
- `value()`：返回当前值；
- `reset()`：回到创建时的起始值 `start`。

`start` 不传时默认为 `0`。每次调用 `createCounter` 得到的计数器必须**互不干扰**。

起始代码有两处问题：多个计数器会互相影响，`reset` 也没有回到起始值。修好它们。

:::files{role=starter}
```ts file=counter.ts
let count = 0;

export function createCounter(start = 0): {
  increment: () => number;
  value: () => number;
  reset: () => void;
} {
  count = start;
  return {
    increment: () => {
      count++;
      return count;
    },
    value: () => count,
    reset: () => {
      count = 0;
    },
  };
}

const visits = createCounter();
visits.increment();
console.log(visits.value());
```
:::

:::files{role=solution}
```ts file=counter.ts
export function createCounter(start = 0): {
  increment: () => number;
  value: () => number;
  reset: () => void;
} {
  let count = start;
  return {
    increment: () => {
      count++;
      return count;
    },
    value: () => count,
    reset: () => {
      count = start;
    },
  };
}

const visits = createCounter();
visits.increment();
console.log(visits.value());
```
:::

:::files{role=tests}
```ts file=counter.test.ts
import { expect, test } from 'vitest';
import { createCounter } from './counter';

test('从默认值 0 开始计数', () => {
  const c = createCounter();
  expect(c.increment()).toBe(1);
  expect(c.increment()).toBe(2);
  expect(c.value()).toBe(2);
});

test('指定起始值', () => {
  const c = createCounter(10);
  expect(c.value()).toBe(10);
  expect(c.increment()).toBe(11);
});

test('两个计数器互不干扰', () => {
  const a = createCounter();
  const b = createCounter(100);
  a.increment();
  a.increment();
  b.increment();
  expect(a.value()).toBe(2);
  expect(b.value()).toBe(101);
});

test('reset 回到起始值', () => {
  const c = createCounter(5);
  c.increment();
  c.increment();
  c.reset();
  expect(c.value()).toBe(5);
});
```
:::

:::hint{level=1}
`count` 声明在函数外面，所有计数器共用这一个变量。每个计数器需要自己的变量：把它移到 `createCounter` 里面。
:::

:::hint{level=2}
在 `createCounter` 里写 `let count = start;`，删掉外面的 `let count = 0;`。`reset` 里要回到 `start`，而不是 `0`。
:::

:::explanation
每次调用 `createCounter` 时，函数内部的 `let count = start;` 都会创建一个新变量。返回对象里的三个箭头函数是闭包，它们共享**这一次调用**创建的 `count`，与其他计数器无关。

起始代码把 `count` 放在模块顶层，所有计数器读写的都是同一个变量：创建第二个计数器时还会把第一个计数器的值改掉。

`reset` 能使用 `start`，同样是因为闭包：参数也是函数作用域里的变量，会被返回的函数记住。
:::

:::variant{kind=alt name=named-functions}
```ts file=counter.ts
export function createCounter(start = 0): {
  increment: () => number;
  value: () => number;
  reset: () => void;
} {
  let count = start;
  function increment(): number {
    count += 1;
    return count;
  }
  function value(): number {
    return count;
  }
  function reset(): void {
    count = start;
  }
  return { increment: increment, value: value, reset: reset };
}
```
:::

:::variant{kind=wrong name=reset-to-zero fails=tests reason="reset 回到了 0，而不是起始值"}
```ts file=counter.ts
export function createCounter(start = 0): {
  increment: () => number;
  value: () => number;
  reset: () => void;
} {
  let count = start;
  return {
    increment: () => {
      count++;
      return count;
    },
    value: () => count,
    reset: () => {
      count = 0;
    },
  };
}
```
:::

:::variant{kind=wrong name=shared-state fails=tests reason="计数变量放在函数外面，所有计数器共用"}
```ts file=counter.ts
let count = 0;

export function createCounter(start = 0): {
  increment: () => number;
  value: () => number;
  reset: () => void;
} {
  count = start;
  return {
    increment: () => {
      count++;
      return count;
    },
    value: () => count,
    reset: () => {
      count = start;
    },
  };
}
```
:::

:::variant{kind=wrong name=value-snapshot fails=types reason="value 写成了创建时的数字，而不是返回当前值的函数"}
```ts file=counter.ts
export function createCounter(start = 0): {
  increment: () => number;
  value: () => number;
  reset: () => void;
} {
  let count = start;
  return {
    increment: () => {
      count++;
      return count;
    },
    value: count,
    reset: () => {
      count = start;
    },
  };
}
```
:::
