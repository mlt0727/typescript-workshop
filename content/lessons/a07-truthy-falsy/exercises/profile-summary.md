---
kind: challenge
title: 资料摘要里的 0 和 false
---
用户资料的三个字段都可能没填（值为 `null`）。实现 `profileSummary(name, age, subscribed)`，返回一行摘要，格式为：

`姓名：…，年龄：…，订阅：…`（冒号和逗号都是中文全角符号）

各字段的显示规则：

- **姓名**：去掉首尾空格后显示；是 `null` 或去掉空格后为空时显示 `未填`。
- **年龄**：显示数字；`null` 时显示 `未填`。`0` 是有效年龄，显示 `0`。
- **订阅**：`true` 显示 `是`，`false` 显示 `否`，`null` 显示 `未填`。

例如 `profileSummary('Ada', 0, false)` 返回 `'姓名：Ada，年龄：0，订阅：否'`。

:::files{role=starter}
```ts file=profile.ts
export function profileSummary(
  name: string | null,
  age: number | null,
  subscribed: boolean | null,
): string {
  const nameText = name || '未填';
  const ageText = age || '未填';
  const subscribedText = subscribed ? '是' : '未填';
  return `姓名：${nameText}，年龄：${ageText}，订阅：${subscribedText}`;
}

console.log(profileSummary('Ada', 0, false));
```
:::

:::files{role=solution}
```ts file=profile.ts
export function profileSummary(
  name: string | null,
  age: number | null,
  subscribed: boolean | null,
): string {
  let nameText = '未填';
  if (name !== null && name.trim() !== '') {
    nameText = name.trim();
  }

  let ageText = '未填';
  if (age !== null) {
    ageText = String(age);
  }

  let subscribedText = '未填';
  if (subscribed === true) {
    subscribedText = '是';
  } else if (subscribed === false) {
    subscribedText = '否';
  }

  return `姓名：${nameText}，年龄：${ageText}，订阅：${subscribedText}`;
}

console.log(profileSummary('Ada', 0, false));
```
:::

:::files{role=tests}
```ts file=profile.test.ts
import { describe, expect, test } from 'vitest';
import { profileSummary } from './profile';

describe('profileSummary', () => {
  test('全部填写', () => {
    expect(profileSummary('Ada', 36, true)).toBe('姓名：Ada，年龄：36，订阅：是');
  });

  test('0 和 false 是有效的值', () => {
    expect(profileSummary('Ada', 0, false)).toBe('姓名：Ada，年龄：0，订阅：否');
  });

  test('全部没填', () => {
    expect(profileSummary(null, null, null)).toBe('姓名：未填，年龄：未填，订阅：未填');
  });

  test('姓名去掉首尾空格，只有空格算没填', () => {
    expect(profileSummary('  Ada  ', 5, null)).toBe('姓名：Ada，年龄：5，订阅：未填');
    expect(profileSummary('   ', null, false)).toBe('姓名：未填，年龄：未填，订阅：否');
    expect(profileSummary('', 20, true)).toBe('姓名：未填，年龄：20，订阅：是');
  });
});
```
```ts file=profile.test-d.ts
import { expectTypeOf } from 'vitest';
import { profileSummary } from './profile';

expectTypeOf(profileSummary).toEqualTypeOf<
  (name: string | null, age: number | null, subscribed: boolean | null) => string
>();
```
:::

:::hint{level=1}
三个字段要分别想清楚：哪些 falsy 值在这里是有意义的？`0` 是有效年龄，`false` 表示“没有订阅”，它们都不能被当成“没填”。只有姓名的空字符串才算没填。
:::

:::hint{level=2}
年龄用 `if (age !== null)` 判断；订阅分三种情况：`subscribed === true`、`subscribed === false`、其余（`null`）。姓名先排除 `null`，再用 `name.trim()` 判断是不是空的。
:::

:::explanation
起始代码在三个地方用了真假检查，只有一个是对的：

- `name || '未填'` 能处理 `null` 和空字符串，但不能处理只有空格的字符串，也没有去掉空格。
- `age || '未填'` 把有效年龄 `0` 当成了没填。
- `subscribed ? '是' : '未填'` 把 `false`（明确表示不订阅）当成了没填。

判断“有没有值”时，要问一个问题：这个类型的 falsy 值在业务上有没有意义？`number` 的 `0`、`boolean` 的 `false` 通常有意义，所以要明确写 `=== null`。

下一课的 `??` 只在 `null`/`undefined` 时才使用默认值，可以把年龄写成 `` `${age ?? '未填'}` ``。
:::

:::variant{kind=alt name=ternaries}
```ts file=profile.ts
export function profileSummary(
  name: string | null,
  age: number | null,
  subscribed: boolean | null,
): string {
  const trimmed = name === null ? '' : name.trim();
  const nameText = trimmed === '' ? '未填' : trimmed;
  const ageText = age === null ? '未填' : `${age}`;
  const subscribedText = subscribed === null ? '未填' : subscribed ? '是' : '否';
  return `姓名：${nameText}，年龄：${ageText}，订阅：${subscribedText}`;
}
```
:::

:::variant{kind=wrong name=age-truthy fails=tests reason="用真假检查判断年龄，0 岁显示成了未填"}
```ts file=profile.ts
export function profileSummary(
  name: string | null,
  age: number | null,
  subscribed: boolean | null,
): string {
  const trimmed = name === null ? '' : name.trim();
  const nameText = trimmed === '' ? '未填' : trimmed;
  const ageText = age ? String(age) : '未填';
  const subscribedText = subscribed === null ? '未填' : subscribed ? '是' : '否';
  return `姓名：${nameText}，年龄：${ageText}，订阅：${subscribedText}`;
}
```
:::

:::variant{kind=wrong name=subscribed-truthy fails=tests reason="把 false 当成了没填"}
```ts file=profile.ts
export function profileSummary(
  name: string | null,
  age: number | null,
  subscribed: boolean | null,
): string {
  const trimmed = name === null ? '' : name.trim();
  const nameText = trimmed === '' ? '未填' : trimmed;
  const ageText = age === null ? '未填' : String(age);
  let subscribedText = '未填';
  if (subscribed) {
    subscribedText = '是';
  }
  return `姓名：${nameText}，年龄：${ageText}，订阅：${subscribedText}`;
}
```
:::

:::variant{kind=wrong name=name-no-trim fails=tests reason="姓名没有去掉空格，只有空格时没有显示未填"}
```ts file=profile.ts
export function profileSummary(
  name: string | null,
  age: number | null,
  subscribed: boolean | null,
): string {
  const nameText = name || '未填';
  const ageText = age === null ? '未填' : String(age);
  const subscribedText = subscribed === null ? '未填' : subscribed ? '是' : '否';
  return `姓名：${nameText}，年龄：${ageText}，订阅：${subscribedText}`;
}
```
:::
