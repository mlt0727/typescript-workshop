---
kind: task
title: 不要吞掉用户的设置
---
`withDefaults` 为列表组件补齐默认设置，但它有一个 bug：用户明确设置的 `pageSize: 0`（不分页）、`label: ''`（不显示标题）和 `showHidden: false` 都被替换成了默认值。

修改函数：**只有字段缺失（`undefined`）时**才使用默认值（`pageSize` 默认 `20`，`label` 默认 `'全部'`，`showHidden` 默认 `true`）。

先点击“运行”观察输出，再修改代码。

:::files{role=starter}
```ts file=defaults.ts
export type ListOptions = {
  pageSize?: number;
  label?: string;
  showHidden?: boolean;
};

export type ResolvedOptions = {
  pageSize: number;
  label: string;
  showHidden: boolean;
};

export function withDefaults(options: ListOptions): ResolvedOptions {
  return {
    pageSize: options.pageSize || 20,
    label: options.label || '全部',
    showHidden: options.showHidden || true,
  };
}

console.log(withDefaults({ pageSize: 0, label: '', showHidden: false }));
console.log(withDefaults({}));
```
:::

:::files{role=solution}
```ts file=defaults.ts
export type ListOptions = {
  pageSize?: number;
  label?: string;
  showHidden?: boolean;
};

export type ResolvedOptions = {
  pageSize: number;
  label: string;
  showHidden: boolean;
};

export function withDefaults(options: ListOptions): ResolvedOptions {
  return {
    pageSize: options.pageSize ?? 20,
    label: options.label ?? '全部',
    showHidden: options.showHidden ?? true,
  };
}

console.log(withDefaults({ pageSize: 0, label: '', showHidden: false }));
console.log(withDefaults({}));
```
:::

:::files{role=tests}
```ts file=defaults.test.ts
import { expect, test } from 'vitest';
import { withDefaults } from './defaults';

test('缺失的字段使用默认值', () => {
  expect(withDefaults({})).toEqual({ pageSize: 20, label: '全部', showHidden: true });
});

test('保留 0、空字符串和 false', () => {
  expect(withDefaults({ pageSize: 0, label: '', showHidden: false })).toEqual({
    pageSize: 0,
    label: '',
    showHidden: false,
  });
});

test('保留其他明确设置的值', () => {
  expect(withDefaults({ pageSize: 50, label: '收藏', showHidden: true })).toEqual({
    pageSize: 50,
    label: '收藏',
    showHidden: true,
  });
});

test('每个字段独立处理', () => {
  expect(withDefaults({ label: '' })).toEqual({ pageSize: 20, label: '', showHidden: true });
});
```
:::

:::hint{level=1}
`||` 在左边为任何 falsy 值时都会取右边；本题需要一个只对 `null`/`undefined` 生效的运算符。
:::

:::hint{level=2}
把三处 `||` 都换成 `??`。
:::

:::explanation
`??` 只在左边为 `null` 或 `undefined` 时取右边，所以用户设置的 `0`、`''`、`false` 都被保留；字段缺失时（值为 `undefined`）才使用默认值。

也可以写成 `options.pageSize !== undefined ? options.pageSize : 20`，效果相同（本题的类型里没有 `null`）。
:::

:::variant{kind=alt name=explicit-undefined-check}
```ts file=defaults.ts
export type ListOptions = {
  pageSize?: number;
  label?: string;
  showHidden?: boolean;
};

export type ResolvedOptions = {
  pageSize: number;
  label: string;
  showHidden: boolean;
};

export function withDefaults(options: ListOptions): ResolvedOptions {
  return {
    pageSize: options.pageSize !== undefined ? options.pageSize : 20,
    label: options.label !== undefined ? options.label : '全部',
    showHidden: options.showHidden !== undefined ? options.showHidden : true,
  };
}
```
:::

:::variant{kind=wrong name=keeps-or fails=tests reason="仍然用 ||，0、空字符串和 false 被替换"}
```ts file=defaults.ts
export type ListOptions = {
  pageSize?: number;
  label?: string;
  showHidden?: boolean;
};

export type ResolvedOptions = {
  pageSize: number;
  label: string;
  showHidden: boolean;
};

export function withDefaults(options: ListOptions): ResolvedOptions {
  return {
    pageSize: options.pageSize || 20,
    label: options.label ?? '全部',
    showHidden: options.showHidden ?? true,
  };
}
```
:::

:::variant{kind=wrong name=truthy-ternary fails=tests reason="条件写成 options.x ? …，与 || 有同样的问题"}
```ts file=defaults.ts
export type ListOptions = {
  pageSize?: number;
  label?: string;
  showHidden?: boolean;
};

export type ResolvedOptions = {
  pageSize: number;
  label: string;
  showHidden: boolean;
};

export function withDefaults(options: ListOptions): ResolvedOptions {
  return {
    pageSize: options.pageSize ? options.pageSize : 20,
    label: options.label ? options.label : '全部',
    showHidden: options.showHidden ? options.showHidden : true,
  };
}
```
:::
