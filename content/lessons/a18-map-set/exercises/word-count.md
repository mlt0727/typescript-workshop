---
kind: task
title: 统计单词出现次数
---
`countWords(text)` 统计每个单词出现的次数，返回 `Map<string, number>`。起始代码已经拆出单词并开始计数，但第 4 行有类型错误，下面的后两条要求也还没有做到。把它改对：

- 单词之间用**一个空格**分隔，`text.split(' ')` 把文本拆成单词的数组（起始代码已经写好）；
- 不区分大小写：统一转成小写（`toLowerCase()`）后再统计；
- 空字符串返回空的 Map。

Map 的顺序是单词第一次出现的顺序。例如 `countWords('To be or not to be')` 得到的 Map 依次是 `to → 2`、`be → 2`、`or → 1`、`not → 1`。

:::files{role=starter}
```ts file=count.ts
export function countWords(text: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const word of text.split(' ')) {
    counts.set(word, counts.get(word) + 1);
  }
  return counts;
}

console.log(countWords('To be or not to be'));
```
:::

:::files{role=solution}
```ts file=count.ts
export function countWords(text: string): Map<string, number> {
  const counts = new Map<string, number>();
  if (text === '') {
    return counts;
  }
  for (const raw of text.split(' ')) {
    const word = raw.toLowerCase();
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  return counts;
}

console.log(countWords('To be or not to be'));
```
:::

:::files{role=tests}
```ts file=count.test.ts
import { expect, test } from 'vitest';
import { countWords } from './count';

test('统计次数，保持第一次出现的顺序', () => {
  const counts = countWords('To be or not to be');
  expect([...counts]).toEqual([
    ['to', 2],
    ['be', 2],
    ['or', 1],
    ['not', 1],
  ]);
});

test('不区分大小写', () => {
  expect(countWords('Hi hi HI').get('hi')).toBe(3);
});

test('空字符串返回空 Map', () => {
  expect(countWords('').size).toBe(0);
});

test('只有一个单词', () => {
  expect([...countWords('ts')]).toEqual([['ts', 1]]);
});
```
:::

:::hint{level=1}
`counts.get(word)` 在第一次遇到某个单词时是 `undefined`，要提供默认值 `0`。另外别忘了转小写，以及空字符串的情况：`''.split(' ')` 得到的是 `['']`。
:::

:::hint{level=2}
计数写成 `counts.set(word, (counts.get(word) ?? 0) + 1);`。转小写可以在拆分之前做：`text.toLowerCase().split(' ')`。空字符串在循环前单独处理：`if (text === '') { return counts; }`。
:::

:::explanation
`(counts.get(word) ?? 0) + 1` 是 Map 计数的惯用写法：没有记录时从 0 开始。

`''.split(' ')` 返回 `['']`（一个空字符串元素），不是空数组，所以不单独处理的话，空文本会统计出一个“空单词”。

不能用 `counts.get(word)!`：第一次遇到某个单词时它确实是 `undefined`，`undefined + 1` 得到 `NaN`。
:::

:::variant{kind=alt name=has-check}
```ts file=count.ts
export function countWords(text: string): Map<string, number> {
  const counts = new Map<string, number>();
  const words = text.split(' ').filter((w) => w !== '');
  for (const word of words.map((w) => w.toLowerCase())) {
    const previous = counts.get(word);
    counts.set(word, previous === undefined ? 1 : previous + 1);
  }
  return counts;
}
```
:::

:::variant{kind=wrong name=non-null fails=rules reason="用非空断言，第一次计数时得到 NaN"}
```ts file=count.ts
export function countWords(text: string): Map<string, number> {
  const counts = new Map<string, number>();
  if (text === '') return counts;
  for (const raw of text.split(' ')) {
    const word = raw.toLowerCase();
    counts.set(word, counts.get(word)! + 1);
  }
  return counts;
}
```
:::

:::variant{kind=wrong name=case-sensitive fails=tests reason="没有统一转成小写"}
```ts file=count.ts
export function countWords(text: string): Map<string, number> {
  const counts = new Map<string, number>();
  if (text === '') return counts;
  for (const word of text.split(' ')) {
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  return counts;
}
```
:::

:::variant{kind=wrong name=empty-word fails=tests reason="没有处理空字符串，统计出了一个空单词"}
```ts file=count.ts
export function countWords(text: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const raw of text.split(' ')) {
    const word = raw.toLowerCase();
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  return counts;
}
```
:::
