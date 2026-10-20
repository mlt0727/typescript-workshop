---
kind: challenge
title: 订单摘要
---
JSX 是表达式，普通的函数也可以返回它。在 `order.tsx` 中实现 `orderSummary(order)`，返回一个订单的摘要：

```html
<article class="order">
  <h3>订单 A1001</h3>
  <p class="meta">韩梅梅 · 3 件商品</p>
  <p class="total">合计 ¥128.50</p>
  <p class="status status-pending">待发货</p>
  <p>含 2 件赠品</p>
  <p class="note">备注：请尽快发货</p>
</article>
```

1. 金额保留两位小数；**已取消**的订单，把 `合计 ¥…` 这段文字放进 `<s>` 中（删除线）：`<p class="total"><s>合计 ¥59.00</s></p>`；
2. 状态的文字：`pending` 待发货、`shipped` 已发货、`delivered` 已送达、`cancelled` 已取消；`class` 是 `status status-状态`；
3. 赠品数大于 0 时才显示赠品那一行；
4. 备注不是 `null`、去掉首尾空白之后也不是空字符串时，才显示备注那一行（显示原文）；
5. 不显示的行什么都不渲染，不能在页面上留下多余的文字。

预览中有三个示例订单。下一课会把这个函数改造成真正的组件。

:::files{role=starter}
```tsx file=order.tsx
export type OrderStatus = 'pending' | 'shipped' | 'delivered' | 'cancelled';

export type Order = {
  id: string;
  customer: string;
  itemCount: number;
  total: number;
  status: OrderStatus;
  gifts: number;
  note: string | null;
};

export function orderSummary(order: Order) {
  return (
    <article className="order">
      <h3>订单 {order.id}</h3>
    </article>
  );
}
```
:::

:::files{role=support}
```tsx file=main.tsx readonly
import { createRoot } from 'react-dom/client';
import { orderSummary, type Order } from './order';

const first: Order = { id: 'A1001', customer: '韩梅梅', itemCount: 3, total: 128.5, status: 'pending', gifts: 1, note: '请尽快发货' };
const second: Order = { id: 'A1002', customer: '李雷', itemCount: 1, total: 59, status: 'cancelled', gifts: 0, note: null };
const third: Order = { id: 'A1003', customer: '<b>王五</b>', itemCount: 0, total: 0, status: 'delivered', gifts: 0, note: '  ' };

const container = document.getElementById('root');
if (!container) throw new Error('页面缺少 #root');
createRoot(container).render(
  <main>
    {orderSummary(first)}
    {orderSummary(second)}
    {orderSummary(third)}
  </main>,
);
```
:::

:::files{role=solution}
```tsx file=order.tsx
export type OrderStatus = 'pending' | 'shipped' | 'delivered' | 'cancelled';

export type Order = {
  id: string;
  customer: string;
  itemCount: number;
  total: number;
  status: OrderStatus;
  gifts: number;
  note: string | null;
};

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: '待发货',
  shipped: '已发货',
  delivered: '已送达',
  cancelled: '已取消',
};

export function orderSummary(order: Order) {
  const total = `合计 ¥${order.total.toFixed(2)}`;
  const hasNote = order.note !== null && order.note.trim() !== '';
  return (
    <article className="order">
      <h3>订单 {order.id}</h3>
      <p className="meta">
        {order.customer} · {order.itemCount} 件商品
      </p>
      <p className="total">{order.status === 'cancelled' ? <s>{total}</s> : total}</p>
      <p className={`status status-${order.status}`}>{STATUS_LABELS[order.status]}</p>
      {order.gifts > 0 && <p>含 {order.gifts} 件赠品</p>}
      {hasNote && <p className="note">备注：{order.note}</p>}
    </article>
  );
}
```
:::

:::files{role=tests}
```tsx file=order.test.tsx
import { describe, expect, test } from 'vitest';
import { render } from '@testing-library/react';
import { orderSummary, type Order, type OrderStatus } from './order';

const base: Order = {
  id: 'A1001',
  customer: '韩梅梅',
  itemCount: 3,
  total: 128.5,
  status: 'pending',
  gifts: 2,
  note: '请尽快发货',
};

function show(order: Order): HTMLElement {
  const { container } = render(orderSummary(order));
  const article = container.querySelector('article.order');
  if (!(article instanceof HTMLElement)) throw new Error('没有找到 <article class="order">');
  return article;
}

describe('orderSummary', () => {
  test('完整的订单：各部分按顺序出现', () => {
    const article = show(base);
    expect([...article.children].map((el) => el.tagName)).toEqual(['H3', 'P', 'P', 'P', 'P', 'P']);
    expect(article.querySelector('h3')).toHaveTextContent(/^订单 A1001$/);
    expect(article.querySelector('.meta')).toHaveTextContent(/^韩梅梅 · 3 件商品$/);
    expect(article.querySelector('.total')).toHaveTextContent(/^合计 ¥128\.50$/);
    expect(article.querySelector('.status')).toHaveTextContent(/^待发货$/);
    expect(article.children[4]).toHaveTextContent(/^含 2 件赠品$/);
    expect(article.querySelector('.note')).toHaveTextContent(/^备注：请尽快发货$/);
  });

  test('每种状态的文字和 class', () => {
    const labels: Record<OrderStatus, string> = { pending: '待发货', shipped: '已发货', delivered: '已送达', cancelled: '已取消' };
    const statuses: OrderStatus[] = ['pending', 'shipped', 'delivered', 'cancelled'];
    for (const status of statuses) {
      const article = show({ ...base, status });
      const badge = article.querySelector('.status');
      expect(badge, status).toHaveTextContent(labels[status]);
      expect(article.querySelector('.total s') !== null, `${status} 的金额是否加删除线`).toBe(status === 'cancelled');
      expect(badge?.className, status).toBe(`status status-${status}`);
    }
  });

  test('金额保留两位小数；只有已取消的订单加删除线', () => {
    expect(show({ ...base, total: 59 }).querySelector('.total')).toHaveTextContent(/^合计 ¥59\.00$/);
    expect(show({ ...base, total: 0.1 + 0.2 }).querySelector('.total')).toHaveTextContent(/^合计 ¥0\.30$/);
    expect(show(base).querySelector('.total s')).toBeNull();
    const struck = show({ ...base, status: 'cancelled', total: 59 }).querySelector('.total s');
    expect(struck).toHaveTextContent(/^合计 ¥59\.00$/);
  });

  test('没有赠品、没有备注时什么都不显示，也不会多出一个 0', () => {
    for (const note of [null, '', '   ']) {
      const article = show({ ...base, gifts: 0, note });
      expect(article.textContent, String(note)).not.toContain('赠品');
      expect(article.querySelector('.note'), String(note)).toBeNull();
      expect([...article.childNodes].every((node) => node.nodeType === Node.ELEMENT_NODE), '不应该有直接的文字节点').toBe(true);
      expect(article.children, String(note)).toHaveLength(4);
    }
  });

  test('用户输入的文字原样显示', () => {
    const article = show({ ...base, customer: '<b>张三</b>', note: '<img src=x onerror=alert(1)>' });
    expect(article.querySelector('b, img')).toBeNull();
    expect(article.querySelector('.meta')).toHaveTextContent('<b>张三</b> · 3 件商品');
    expect(article.querySelector('.note')).toHaveTextContent('备注：<img src=x onerror=alert(1)>');
  });
});
```
:::

:::hint{level=1}
先把要显示的文字算好放进变量，例如 `` const total = `合计 ¥${order.total.toFixed(2)}` ``，再写 JSX。状态的文字可以放在一个 `Record<OrderStatus, string>` 对象里：少写一种状态，TypeScript 就会报错。
:::

:::hint{level=2}
删除线：`{order.status === 'cancelled' ? <s>{total}</s> : total}`。赠品：`{order.gifts > 0 && <p>…</p>}`，注意 `&&` 左边要是布尔值。备注：先算出 `const hasNote = order.note !== null && order.note.trim() !== ''`。`className` 可以写成模板字符串：``className={`status status-${order.status}`}``。
:::

:::explanation
这道题练习的是 JSX 中最常用的几种表达式：模板字符串、三元运算符、`&&` 条件渲染，以及用对象查表。

`{order.gifts && <p>…</p>}` 是 React 中最常见的错误之一：`gifts` 为 0 时，`&&` 的结果是 `0`，React 会把数字渲染成文字，页面上多出一个“0”。`{order.note && …}` 也有问题：只含空格的备注是真值，会显示一行空的“备注：”。两种情况的解决办法都是让 `&&` 左边成为一个**明确的布尔值**。

`Record<OrderStatus, string>` 要求对象恰好包含联合类型中的每一个成员。以后增加一种状态（例如 `'refunded'`），忘了写它的中文就会编译失败，效果和 `switch` 的穷尽检查一样。

客户名和备注都来自用户，但通过 `{…}` 插入时都是文字，测试中的 `<b>`、`<img onerror>` 只会原样显示。不要为了“方便”去用 `dangerouslySetInnerHTML`。
:::

:::variant{kind=alt name=switch-and-helpers}
```tsx file=order.tsx
export type OrderStatus = 'pending' | 'shipped' | 'delivered' | 'cancelled';

export type Order = {
  id: string;
  customer: string;
  itemCount: number;
  total: number;
  status: OrderStatus;
  gifts: number;
  note: string | null;
};

function statusLabel(status: OrderStatus): string {
  switch (status) {
    case 'pending':
      return '待发货';
    case 'shipped':
      return '已发货';
    case 'delivered':
      return '已送达';
    case 'cancelled':
      return '已取消';
    default: {
      const unreachable: never = status;
      return unreachable;
    }
  }
}

function giftLine(gifts: number) {
  if (gifts <= 0) return null;
  return <p>含 {gifts} 件赠品</p>;
}

export function orderSummary({ id, customer, itemCount, total, status, gifts, note }: Order) {
  const money = '合计 ¥' + total.toFixed(2);
  const trimmed = note?.trim() ?? '';
  return (
    <article className="order">
      <h3>订单 {id}</h3>
      <p className="meta">{`${customer} · ${itemCount} 件商品`}</p>
      <p className="total">{status === 'cancelled' ? <s>{money}</s> : money}</p>
      <p className={'status status-' + status}>{statusLabel(status)}</p>
      {giftLine(gifts)}
      {trimmed === '' ? null : <p className="note">备注：{note}</p>}
    </article>
  );
}
```
:::

:::variant{kind=wrong name=zero-and fails=tests reason="用 gifts && …，赠品为 0 时页面上多出一个 0"}
```tsx file=order.tsx
export type OrderStatus = 'pending' | 'shipped' | 'delivered' | 'cancelled';

export type Order = {
  id: string;
  customer: string;
  itemCount: number;
  total: number;
  status: OrderStatus;
  gifts: number;
  note: string | null;
};

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: '待发货',
  shipped: '已发货',
  delivered: '已送达',
  cancelled: '已取消',
};

export function orderSummary(order: Order) {
  const total = `合计 ¥${order.total.toFixed(2)}`;
  const hasNote = order.note !== null && order.note.trim() !== '';
  return (
    <article className="order">
      <h3>订单 {order.id}</h3>
      <p className="meta">
        {order.customer} · {order.itemCount} 件商品
      </p>
      <p className="total">{order.status === 'cancelled' ? <s>{total}</s> : total}</p>
      <p className={`status status-${order.status}`}>{STATUS_LABELS[order.status]}</p>
      {order.gifts && <p>含 {order.gifts} 件赠品</p>}
      {hasNote && <p className="note">备注：{order.note}</p>}
    </article>
  );
}
```
:::

:::variant{kind=wrong name=truthy-note fails=tests reason="用 note && …，只含空格的备注也显示了出来"}
```tsx file=order.tsx
export type OrderStatus = 'pending' | 'shipped' | 'delivered' | 'cancelled';

export type Order = {
  id: string;
  customer: string;
  itemCount: number;
  total: number;
  status: OrderStatus;
  gifts: number;
  note: string | null;
};

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: '待发货',
  shipped: '已发货',
  delivered: '已送达',
  cancelled: '已取消',
};

export function orderSummary(order: Order) {
  const total = `合计 ¥${order.total.toFixed(2)}`;
  return (
    <article className="order">
      <h3>订单 {order.id}</h3>
      <p className="meta">
        {order.customer} · {order.itemCount} 件商品
      </p>
      <p className="total">{order.status === 'cancelled' ? <s>{total}</s> : total}</p>
      <p className={`status status-${order.status}`}>{STATUS_LABELS[order.status]}</p>
      {order.gifts > 0 && <p>含 {order.gifts} 件赠品</p>}
      {order.note && <p className="note">备注：{order.note}</p>}
    </article>
  );
}
```
:::

:::variant{kind=wrong name=no-to-fixed fails=tests reason="金额没有保留两位小数"}
```tsx file=order.tsx
export type OrderStatus = 'pending' | 'shipped' | 'delivered' | 'cancelled';

export type Order = {
  id: string;
  customer: string;
  itemCount: number;
  total: number;
  status: OrderStatus;
  gifts: number;
  note: string | null;
};

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: '待发货',
  shipped: '已发货',
  delivered: '已送达',
  cancelled: '已取消',
};

export function orderSummary(order: Order) {
  const total = `合计 ¥${order.total}`;
  const hasNote = order.note !== null && order.note.trim() !== '';
  return (
    <article className="order">
      <h3>订单 {order.id}</h3>
      <p className="meta">
        {order.customer} · {order.itemCount} 件商品
      </p>
      <p className="total">{order.status === 'cancelled' ? <s>{total}</s> : total}</p>
      <p className={`status status-${order.status}`}>{STATUS_LABELS[order.status]}</p>
      {order.gifts > 0 && <p>含 {order.gifts} 件赠品</p>}
      {hasNote && <p className="note">备注：{order.note}</p>}
    </article>
  );
}
```
:::

:::variant{kind=wrong name=no-strike fails=tests reason="已取消的订单没有加删除线"}
```tsx file=order.tsx
export type OrderStatus = 'pending' | 'shipped' | 'delivered' | 'cancelled';

export type Order = {
  id: string;
  customer: string;
  itemCount: number;
  total: number;
  status: OrderStatus;
  gifts: number;
  note: string | null;
};

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: '待发货',
  shipped: '已发货',
  delivered: '已送达',
  cancelled: '已取消',
};

export function orderSummary(order: Order) {
  const total = `合计 ¥${order.total.toFixed(2)}`;
  const hasNote = order.note !== null && order.note.trim() !== '';
  return (
    <article className="order">
      <h3>订单 {order.id}</h3>
      <p className="meta">
        {order.customer} · {order.itemCount} 件商品
      </p>
      <p className="total">{total}</p>
      <p className={`status status-${order.status}`}>{STATUS_LABELS[order.status]}</p>
      {order.gifts > 0 && <p>含 {order.gifts} 件赠品</p>}
      {hasNote && <p className="note">备注：{order.note}</p>}
    </article>
  );
}
```
:::

:::variant{kind=wrong name=inner-html fails=tests reason="用 dangerouslySetInnerHTML 拼接客户名，HTML 标签生效了"}
```tsx file=order.tsx
export type OrderStatus = 'pending' | 'shipped' | 'delivered' | 'cancelled';

export type Order = {
  id: string;
  customer: string;
  itemCount: number;
  total: number;
  status: OrderStatus;
  gifts: number;
  note: string | null;
};

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: '待发货',
  shipped: '已发货',
  delivered: '已送达',
  cancelled: '已取消',
};

export function orderSummary(order: Order) {
  const total = `合计 ¥${order.total.toFixed(2)}`;
  const hasNote = order.note !== null && order.note.trim() !== '';
  return (
    <article className="order">
      <h3>订单 {order.id}</h3>
      <p className="meta" dangerouslySetInnerHTML={{ __html: `${order.customer} · ${order.itemCount} 件商品` }} />
      <p className="total">{order.status === 'cancelled' ? <s>{total}</s> : total}</p>
      <p className={`status status-${order.status}`}>{STATUS_LABELS[order.status]}</p>
      {order.gifts > 0 && <p>含 {order.gifts} 件赠品</p>}
      {hasNote && <p className="note">备注：{order.note}</p>}
    </article>
  );
}
```
:::
