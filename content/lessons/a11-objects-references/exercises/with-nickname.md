---
kind: task
title: 不要改动传入的对象
---
`withNickname(user, nickname)` 应该返回一个**新的**用户对象：昵称换成 `nickname`，其他属性不变。传入的 `user` 不能被修改——页面的其他部分还在使用它。

起始代码能返回正确的结果，但测试发现它修改了传入的对象。修好它。

:::files{role=starter}
```ts file=user.ts
export function withNickname(
  user: { name: string; nickname: string; level: number },
  nickname: string,
): { name: string; nickname: string; level: number } {
  user.nickname = nickname;
  return user;
}

const ada = { name: 'Ada', nickname: '', level: 3 };
const renamed = withNickname(ada, '计算之母');
console.log(ada, renamed);
```
:::

:::files{role=solution}
```ts file=user.ts
export function withNickname(
  user: { name: string; nickname: string; level: number },
  nickname: string,
): { name: string; nickname: string; level: number } {
  const copy = { ...user };
  copy.nickname = nickname;
  return copy;
}

const ada = { name: 'Ada', nickname: '', level: 3 };
const renamed = withNickname(ada, '计算之母');
console.log(ada, renamed);
```
:::

:::files{role=tests}
```ts file=user.test.ts
import { expect, test } from 'vitest';
import { withNickname } from './user';

test('返回新昵称，其他属性不变', () => {
  const user = { name: 'Ada', nickname: '', level: 3 };
  expect(withNickname(user, '计算之母')).toEqual({ name: 'Ada', nickname: '计算之母', level: 3 });
});

test('不修改传入的对象', () => {
  const user = { name: 'Grace', nickname: 'Amazing', level: 5 };
  withNickname(user, 'Grandma COBOL');
  expect(user).toEqual({ name: 'Grace', nickname: 'Amazing', level: 5 });
});

test('返回的是另一个对象', () => {
  const user = { name: 'Linus', nickname: '', level: 1 };
  expect(withNickname(user, 'L')).not.toBe(user);
});
```
:::

:::hint{level=1}
`user.nickname = …` 直接修改了调用方的对象。先复制一份，再修改副本。
:::

:::hint{level=2}
`const copy = { ...user };`，然后修改 `copy.nickname` 并返回 `copy`。也可以一步写成 `return { ...user, nickname: nickname };`：展开之后再写的同名属性会覆盖展开得到的值。
:::

:::explanation
参数 `user` 和调用方的变量指向同一个对象，`user.nickname = nickname` 修改的就是调用方的数据。

`{ ...user }` 创建了一个新对象并复制了 `user` 的全部属性。这里的属性都是字符串和数字，浅拷贝已经足够：修改副本的 `nickname` 不会影响原对象。

`const copy = user` 不是复制，它只是给同一个对象起了另一个名字。
:::

:::variant{kind=alt name=spread-override}
```ts file=user.ts
export function withNickname(
  user: { name: string; nickname: string; level: number },
  nickname: string,
): { name: string; nickname: string; level: number } {
  return { ...user, nickname: nickname };
}
```
:::

:::variant{kind=wrong name=alias fails=tests reason="const copy = user 只是起了另一个名字，没有复制"}
```ts file=user.ts
export function withNickname(
  user: { name: string; nickname: string; level: number },
  nickname: string,
): { name: string; nickname: string; level: number } {
  const copy = user;
  copy.nickname = nickname;
  return copy;
}
```
:::

:::variant{kind=wrong name=copy-after-mutate fails=tests reason="先修改了原对象再复制，原对象已经被改了"}
```ts file=user.ts
export function withNickname(
  user: { name: string; nickname: string; level: number },
  nickname: string,
): { name: string; nickname: string; level: number } {
  user.nickname = nickname;
  return { ...user };
}
```
:::
