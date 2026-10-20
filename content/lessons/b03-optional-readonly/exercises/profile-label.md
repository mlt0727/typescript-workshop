---
kind: task
title: 带可选信息的称呼
---
用户资料中 `nickname`、`age` 和 `vip` 都是可选的。实现 `profileLabel(profile)`：

- 提供了昵称时显示昵称（即使是空字符串，也是用户自己设置的），没有提供时显示 `name`；
- 有年龄时在后面加上 `（N 岁）`，0 岁也要显示；
- `vip` 为 `true` 时在最前面加上 `★`；`false` 或没有提供时不加。

例如 `{ name: 'Ada', nickname: '阿达', age: 36, vip: true }` 显示为 `'★阿达（36 岁）'`，`{ name: 'Bob' }` 显示为 `'Bob'`。

:::files{role=starter}
```ts file=profile.ts
export interface Profile {
  name: string;
  nickname?: string;
  age?: number;
  vip?: boolean;
}

export function profileLabel(profile: Profile): string {
  const shown = profile.nickname || profile.name;
  const age = profile.age ? `（${profile.age} 岁）` : '';
  return (profile.vip ? '★' : '') + shown + age;
}
```
:::

:::files{role=solution}
```ts file=profile.ts
export interface Profile {
  name: string;
  nickname?: string;
  age?: number;
  vip?: boolean;
}

export function profileLabel(profile: Profile): string {
  const shown = profile.nickname ?? profile.name;
  const age = profile.age === undefined ? '' : `（${profile.age} 岁）`;
  const star = profile.vip === true ? '★' : '';
  return star + shown + age;
}
```
:::

:::files{role=tests}
```ts file=profile.test.ts
import { expect, test } from 'vitest';
import { profileLabel } from './profile';

test('全部信息', () => {
  expect(profileLabel({ name: 'Ada', nickname: '阿达', age: 36, vip: true })).toBe('★阿达（36 岁）');
});

test('只有名字', () => {
  expect(profileLabel({ name: 'Bob' })).toBe('Bob');
});

test('0 岁也显示', () => {
  expect(profileLabel({ name: '小宝', age: 0 })).toBe('小宝（0 岁）');
});

test('vip 为 false 时不加星号', () => {
  expect(profileLabel({ name: 'Cy', vip: false })).toBe('Cy');
});

test('空昵称也是用户设置的昵称', () => {
  expect(profileLabel({ name: 'Dan', nickname: '' })).toBe('');
});
```
:::

:::hint{level=1}
起始代码用了真假检查（`||` 和 `profile.age ? …`），在 `0` 和空字符串上会出错。哪些值在这里是有意义的？
:::

:::hint{level=2}
昵称用 `profile.nickname ?? profile.name`；年龄用 `profile.age === undefined ? '' : …`。`vip` 用真假检查或 `=== true` 都可以，因为 `false` 和 `undefined` 都表示“不加星号”。
:::

:::explanation
可选属性的类型包含 `undefined`，“没有提供”和“提供了一个 falsy 值”是两回事。规格明确了：0 岁要显示，空字符串昵称要显示（用户把昵称设成了空），所以昵称和年龄都只应该在 `undefined` 时退回默认，要用 `??` 或 `=== undefined`。

`vip` 不同：`false` 和“没有提供”都表示不加星号，真假检查正好合适。判断该用哪种检查，要看 falsy 值在这个字段上有没有意义（a07）。
:::

:::variant{kind=alt name=destructure-defaults}
```ts file=profile.ts
export interface Profile {
  name: string;
  nickname?: string;
  age?: number;
  vip?: boolean;
}

export function profileLabel({ name, nickname = name, age, vip = false }: Profile): string {
  const parts: string[] = [];
  if (vip) parts.push('★');
  parts.push(nickname);
  if (age !== undefined) parts.push(`（${age} 岁）`);
  return parts.join('');
}
```
:::

:::variant{kind=wrong name=truthy-age fails=tests reason="用真假检查判断年龄，0 岁没有显示"}
```ts file=profile.ts
export interface Profile {
  name: string;
  nickname?: string;
  age?: number;
  vip?: boolean;
}

export function profileLabel(profile: Profile): string {
  const shown = profile.nickname ?? profile.name;
  const age = profile.age ? `（${profile.age} 岁）` : '';
  return (profile.vip ? '★' : '') + shown + age;
}
```
:::

:::variant{kind=wrong name=or-nickname fails=tests reason="用 || 选择昵称，空字符串昵称被换成了名字"}
```ts file=profile.ts
export interface Profile {
  name: string;
  nickname?: string;
  age?: number;
  vip?: boolean;
}

export function profileLabel(profile: Profile): string {
  const shown = profile.nickname || profile.name;
  const age = profile.age === undefined ? '' : `（${profile.age} 岁）`;
  return (profile.vip ? '★' : '') + shown + age;
}
```
:::

:::variant{kind=wrong name=unchecked-nickname fails=types reason="没有检查 undefined 就读取可选属性的 .length"}
```ts file=profile.ts
export interface Profile {
  name: string;
  nickname?: string;
  age?: number;
  vip?: boolean;
}

export function profileLabel(profile: Profile): string {
  const shown = profile.nickname.length > 0 ? profile.nickname : profile.name;
  const age = profile.age === undefined ? '' : `（${profile.age} 岁）`;
  return (profile.vip ? '★' : '') + shown + age;
}
```
:::
