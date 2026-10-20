---
kind: task
title: 把秒数显示成 分:秒
---
实现 `formatDuration(totalSeconds)`，把秒数显示成 `分:秒` 的形式：

- 分钟数不补零，可以超过 59；
- 秒数总是两位，不足两位时前面补 `0`。

例如 `formatDuration(125)` 返回 `'2:05'`，`formatDuration(3600)` 返回 `'60:00'`。传入的 `totalSeconds` 一定是大于或等于 0 的整数。

:::files{role=starter}
```ts file=duration.ts
export function formatDuration(totalSeconds: number): string {
  const minutes = totalSeconds / 60;
  const seconds = totalSeconds % 60;
  return minutes + ':' + seconds;
}

console.log(formatDuration(125));
```
:::

:::files{role=solution}
```ts file=duration.ts
export function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

console.log(formatDuration(125));
```
:::

:::files{role=tests}
```ts file=duration.test.ts
import { expect, test } from 'vitest';
import { formatDuration } from './duration';

test('秒数补零', () => {
  expect(formatDuration(125)).toBe('2:05');
  expect(formatDuration(5)).toBe('0:05');
});

test('整分钟', () => {
  expect(formatDuration(0)).toBe('0:00');
  expect(formatDuration(60)).toBe('1:00');
});

test('秒数接近 60 时不进位', () => {
  expect(formatDuration(59)).toBe('0:59');
  expect(formatDuration(119)).toBe('1:59');
});

test('超过一小时仍然只显示分钟', () => {
  expect(formatDuration(3600)).toBe('60:00');
  expect(formatDuration(3725)).toBe('62:05');
});
```
:::

:::hint{level=1}
运行起始代码：`125 / 60` 不是整数。分钟数要取整；秒数不足两位时要补零。
:::

:::hint{level=2}
分钟用 `Math.floor(totalSeconds / 60)`。补零可以先用 `String(seconds)` 把数字转成字符串，再调用 `padStart(2, '0')`；最后用模板字符串拼起来。
:::

:::explanation
JavaScript 的 `/` 不会取整，`125 / 60` 是 `2.0833…`，所以分钟数需要 `Math.floor`（对非负数来说，`Math.trunc` 结果相同）。`%` 得到剩下的秒数。

`padStart` 是字符串的方法，数字没有这个方法，所以先用 `String(seconds)` 转换。也可以写成 `${seconds}` 再补零，或者判断 `seconds < 10` 时在前面加 `'0'`。
:::

:::variant{kind=alt name=manual-pad}
```ts file=duration.ts
export function formatDuration(totalSeconds: number): string {
  const minutes = Math.trunc(totalSeconds / 60);
  const seconds = totalSeconds - minutes * 60;
  const secondsText = seconds < 10 ? '0' + seconds : '' + seconds;
  return minutes + ':' + secondsText;
}
```
:::

:::variant{kind=wrong name=no-floor fails=tests reason="没有对分钟数取整"}
```ts file=duration.ts
export function formatDuration(totalSeconds: number): string {
  const minutes = totalSeconds / 60;
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
```
:::

:::variant{kind=wrong name=no-pad fails=tests reason="秒数没有补零"}
```ts file=duration.ts
export function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds}`;
}
```
:::

:::variant{kind=wrong name=round fails=tests reason="用 Math.round 取整，秒数过半时分钟数多了 1"}
```ts file=duration.ts
export function formatDuration(totalSeconds: number): string {
  const minutes = Math.round(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
```
:::

:::variant{kind=wrong name=pad-number fails=types reason="直接对数字调用 padStart"}
```ts file=duration.ts
export function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.padStart(2, '0')}`;
}
```
:::
