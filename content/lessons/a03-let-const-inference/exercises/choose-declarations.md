---
kind: task
title: 修好倒计时
---
`countdown(from)` 应该返回从 `from` 倒数到 1 的文字，最后加上 `发射！`。例如 `countdown(3)` 返回 `'3 2 1 发射！'`，`countdown(0)` 返回 `'发射！'`。

起始代码的逻辑是对的，但声明方式选错了，TypeScript 报了错。只修改声明关键字，让它通过类型检查和测试。本题不允许使用 `var`。（`for` 循环的写法与 Java/C++ 相同。）

:::files{role=starter}
```ts file=countdown.ts
export function countdown(from: number): string {
  const text = '';
  for (const i = from; i >= 1; i--) {
    text = text + i + ' ';
  }
  return text + '发射！';
}

console.log(countdown(3));
```
:::

:::files{role=solution}
```ts file=countdown.ts
export function countdown(from: number): string {
  let text = '';
  for (let i = from; i >= 1; i--) {
    text = text + i + ' ';
  }
  return text + '发射！';
}

console.log(countdown(3));
```
:::

:::files{role=tests}
```ts file=countdown.test.ts
import { expect, test } from 'vitest';
import { countdown } from './countdown';

test('从 3 倒数', () => {
  expect(countdown(3)).toBe('3 2 1 发射！');
});

test('只有 1', () => {
  expect(countdown(1)).toBe('1 发射！');
});

test('0 时直接发射', () => {
  expect(countdown(0)).toBe('发射！');
});
```
:::

:::hint{level=1}
看两个 TS2588 错误分别在哪一行：哪两个变量在声明之后又被重新赋值了？
:::

:::hint{level=2}
`text` 在循环里被重新赋值，`i` 在每轮循环后执行 `i--`，所以这两个都要用 `let` 声明。
:::

:::explanation
`const` 声明的变量不能重新赋值。`text = text + …` 和 `i--`（等价于 `i = i - 1`）都是重新赋值，所以 `text` 和 `i` 要改成 `let`。

这正是 `let` 的典型用途：计数器、循环变量、逐步累加的结果。函数里其他不会被重新赋值的值，仍然应该优先用 `const`。

不能用 `var` 代替：它也能让代码运行，但 `var` 声明的 `i` 会漏到 `for` 循环外面，现代代码不再使用它。
:::

:::variant{kind=alt name=while-loop}
```ts file=countdown.ts
export function countdown(from: number): string {
  let text = '';
  let i = from;
  while (i >= 1) {
    text = text + i + ' ';
    i--;
  }
  return text + '发射！';
}
```
:::

:::variant{kind=wrong name=only-text fails=types reason="只改了 text，循环变量 i 仍然是 const"}
```ts file=countdown.ts
export function countdown(from: number): string {
  let text = '';
  for (const i = from; i >= 1; i--) {
    text = text + i + ' ';
  }
  return text + '发射！';
}
```
:::

:::variant{kind=wrong name=use-var fails=rules reason="用 var 代替 let"}
```ts file=countdown.ts
export function countdown(from: number): string {
  var text = '';
  for (var i = from; i >= 1; i--) {
    text = text + i + ' ';
  }
  return text + '发射！';
}
```
:::

:::variant{kind=wrong name=off-by-one fails=tests reason="把循环条件改成了 i > 1，少输出了 1"}
```ts file=countdown.ts
export function countdown(from: number): string {
  let text = '';
  for (let i = from; i > 1; i--) {
    text = text + i + ' ';
  }
  return text + '发射！';
}
```
:::
