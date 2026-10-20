---
kind: challenge
title: 只重新渲染需要的行
---
`ProductList` 显示一个商品列表：可以按名字筛选，可以收藏商品，旁边还有一个与商品无关的“备注”框。`lib.tsx`（只读）中的 `sortByPrice` 假设很慢；`ProductRow` 用 `Tracked` 包住每一行，它用 `<Profiler>` 统计这一行被重新渲染了几次，不影响显示的内容。

现在每输入一个字，每一行都会重新渲染，商品也会重新排序一遍。优化它，**行为保持不变**：

1. 列表按价格从低到高显示（用 `sortByPrice`），只显示名字包含筛选词（去掉首尾空白）的商品；
2. 点星标收藏或取消收藏，下面显示已收藏的件数；
3. 在“备注”中输入时，不重新排序，也不重新渲染任何一行；
4. 收藏或取消收藏一件商品时，不重新排序，只重新渲染这一行；
5. 筛选时，仍然显示的行不重新渲染；
6. 只有 `products` 变化时才重新排序。

可以使用 `memo`、`useMemo`、`useCallback`，不要修改 `lib.tsx`，也不要改变 `ProductRow` 显示的内容（包括 `Tracked`）。

:::files{role=starter}
```tsx file=ProductList.tsx
import { useState } from 'react';
import { Tracked, sortByPrice, type Product } from './lib';

type RowProps = { product: Product; favorite: boolean; onToggle: (id: string) => void };

export function ProductRow({ product, favorite, onToggle }: RowProps) {
  return (
    <Tracked id={product.id}>
      <li>
        {product.name} ¥{product.price}{' '}
        <button type="button" aria-pressed={favorite} aria-label={`收藏${product.name}`} onClick={() => onToggle(product.id)}>
          {favorite ? '★' : '☆'}
        </button>
      </li>
    </Tracked>
  );
}

export function ProductList({ products }: { products: readonly Product[] }) {
  const [query, setQuery] = useState('');
  const [note, setNote] = useState('');
  const [favorites, setFavorites] = useState<ReadonlySet<string>>(new Set());

  const visible = sortByPrice(products).filter((p) => p.name.includes(query.trim()));

  function toggle(id: string) {
    const next = new Set(favorites);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setFavorites(next);
  }

  return (
    <div>
      <label>
        筛选 <input value={query} onChange={(e) => setQuery(e.currentTarget.value)} />
      </label>
      <label>
        备注 <textarea value={note} onChange={(e) => setNote(e.currentTarget.value)} />
      </label>
      <ul aria-label="商品">
        {visible.map((p) => (
          <ProductRow key={p.id} product={p} favorite={favorites.has(p.id)} onToggle={toggle} />
        ))}
      </ul>
      <p role="status">已收藏 {favorites.size} 件</p>
    </div>
  );
}
```
:::

:::files{role=support}
```tsx file=lib.tsx readonly
import { Profiler, type ReactNode } from 'react';

export type Product = { id: string; name: string; price: number };

const stats = { sorts: 0, rows: new Map<string, number>() };

/** 按价格从低到高排序，返回新数组。假设它很慢：测试会统计它被调用了几次 */
export function sortByPrice(products: readonly Product[]): Product[] {
  stats.sorts++;
  return products.toSorted((a, b) => a.price - b.price);
}

/** 包住一行的内容：用 Profiler 统计这一行被重新渲染并提交了几次，不影响显示的内容 */
export function Tracked({ id, children }: { id: string; children: ReactNode }) {
  return (
    <Profiler id={id} onRender={() => stats.rows.set(id, (stats.rows.get(id) ?? 0) + 1)}>
      {children}
    </Profiler>
  );
}

export function readStats(): { sorts: number; rows: ReadonlyMap<string, number> } {
  return { sorts: stats.sorts, rows: new Map(stats.rows) };
}

export function resetStats(): void {
  stats.sorts = 0;
  stats.rows.clear();
}
```
```tsx file=main.tsx readonly
import { createRoot } from 'react-dom/client';
import { ProductList } from './ProductList';

const products = [
  { id: 'tea', name: '绿茶', price: 12 },
  { id: 'cake', name: '蛋糕', price: 28 },
  { id: 'coffee', name: '咖啡', price: 22 },
  { id: 'milk-tea', name: '奶茶', price: 16 },
];

const container = document.getElementById('root');
if (!container) throw new Error('页面缺少 #root');
createRoot(container).render(<ProductList products={products} />);
```
:::

:::files{role=solution}
```tsx file=ProductList.tsx
import { memo, useCallback, useMemo, useState } from 'react';
import { Tracked, sortByPrice, type Product } from './lib';

type RowProps = { product: Product; favorite: boolean; onToggle: (id: string) => void };

export const ProductRow = memo(function ProductRow({ product, favorite, onToggle }: RowProps) {
  return (
    <Tracked id={product.id}>
      <li>
        {product.name} ¥{product.price}{' '}
        <button type="button" aria-pressed={favorite} aria-label={`收藏${product.name}`} onClick={() => onToggle(product.id)}>
          {favorite ? '★' : '☆'}
        </button>
      </li>
    </Tracked>
  );
});

export function ProductList({ products }: { products: readonly Product[] }) {
  const [query, setQuery] = useState('');
  const [note, setNote] = useState('');
  const [favorites, setFavorites] = useState<ReadonlySet<string>>(new Set());

  const sorted = useMemo(() => sortByPrice(products), [products]);
  const visible = sorted.filter((p) => p.name.includes(query.trim()));

  const toggle = useCallback((id: string) => {
    setFavorites((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  return (
    <div>
      <label>
        筛选 <input value={query} onChange={(e) => setQuery(e.currentTarget.value)} />
      </label>
      <label>
        备注 <textarea value={note} onChange={(e) => setNote(e.currentTarget.value)} />
      </label>
      <ul aria-label="商品">
        {visible.map((p) => (
          <ProductRow key={p.id} product={p} favorite={favorites.has(p.id)} onToggle={toggle} />
        ))}
      </ul>
      <p role="status">已收藏 {favorites.size} 件</p>
    </div>
  );
}
```
:::

:::files{role=tests}
```tsx file=ProductList.test.tsx
import { beforeEach, expect, test } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readStats, resetStats, type Product } from './lib';
import { ProductList } from './ProductList';

const products: readonly Product[] = [
  { id: 'tea', name: '绿茶', price: 12 },
  { id: 'cake', name: '蛋糕', price: 28 },
  { id: 'coffee', name: '咖啡', price: 22 },
  { id: 'milk-tea', name: '奶茶', price: 16 },
];

const names = () => within(screen.getByRole('list', { name: '商品' })).getAllByRole('listitem').map((li) => li.textContent?.split(' ')[0]);
const star = (name: string) => screen.getByRole('button', { name: `收藏${name}` });

beforeEach(() => {
  resetStats();
});

test('按价格从低到高显示；筛选词去掉首尾空白', async () => {
  const user = userEvent.setup();
  render(<ProductList products={products} />);
  expect(names()).toEqual(['绿茶', '奶茶', '咖啡', '蛋糕']);
  await user.type(screen.getByLabelText('筛选'), ' 茶 ');
  expect(names()).toEqual(['绿茶', '奶茶']);
});

test('收藏：星标和数量随之变化，再点一次取消', async () => {
  const user = userEvent.setup();
  render(<ProductList products={products} />);
  await user.click(star('咖啡'));
  expect(star('咖啡')).toHaveAttribute('aria-pressed', 'true');
  expect(star('咖啡')).toHaveTextContent('★');
  expect(screen.getByText('已收藏 1 件')).toBeInTheDocument();
  await user.click(star('蛋糕'));
  await user.click(star('咖啡'));
  expect(star('咖啡')).toHaveAttribute('aria-pressed', 'false');
  expect(star('蛋糕')).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByText('已收藏 1 件')).toBeInTheDocument();
});

test('在“备注”中输入：不重新渲染任何一行，也不重新排序', async () => {
  const user = userEvent.setup();
  render(<ProductList products={products} />);
  const before = readStats();
  expect(before.sorts).toBe(1);
  await user.type(screen.getByLabelText('备注'), '周末进货');
  const after = readStats();
  expect(after.sorts, '备注与商品无关，不应该重新排序').toBe(1);
  expect([...after.rows], '备注与商品无关，不应该重新渲染任何一行').toEqual([...before.rows]);
});

test('收藏一件商品：只重新渲染这一行，不重新排序', async () => {
  const user = userEvent.setup();
  render(<ProductList products={products} />);
  await user.click(star('咖啡'));
  await user.click(star('咖啡'));
  const { sorts, rows } = readStats();
  expect(sorts).toBe(1);
  expect(Object.fromEntries(rows), '只有“咖啡”这一行应该重新渲染（每次点击一次）').toEqual({ tea: 1, 'milk-tea': 1, coffee: 3, cake: 1 });
});

test('筛选时，仍然显示的行不重新渲染', async () => {
  const user = userEvent.setup();
  render(<ProductList products={products} />);
  await user.type(screen.getByLabelText('筛选'), '茶');
  const { rows, sorts } = readStats();
  expect(rows.get('tea')).toBe(1);
  expect(rows.get('milk-tea')).toBe(1);
  expect(sorts, '排序只取决于商品目录，筛选时不应该重新排序').toBe(1);
});

test('商品目录变化时重新排序一次', () => {
  const { rerender } = render(<ProductList products={products} />);
  rerender(<ProductList products={[...products, { id: 'water', name: '矿泉水', price: 3 }]} />);
  expect(names()[0]).toBe('矿泉水');
  expect(readStats().sorts).toBe(2);
  rerender(<ProductList products={products.map((p) => (p.id === 'cake' ? { ...p, price: 5 } : p))} />);
  expect(names()[0], '商品数量不变、价格变了，也要重新排序').toBe('蛋糕');
  expect(readStats().sorts).toBe(3);
});
```
:::

:::hint{level=1}
需要三样东西：用 `memo` 包住 `ProductRow`，让它在 props 不变时跳过渲染；用 `useMemo` 缓存排序的结果，依赖只有 `products`；用 `useCallback` 让 `toggle` 在每次渲染时都是同一个函数。
:::

:::hint{level=2}
`export const ProductRow = memo(function ProductRow({ … }: RowProps) { … });`。`toggle` 中如果直接读取 `favorites`，就要把它写进依赖，每次收藏之后函数都会变，所有行又都要重新渲染；改用更新函数 `setFavorites((current) => …)`，依赖就是 `[]`。筛选可以留在渲染时做：`sorted.filter(…)` 返回新数组，但数组中的商品还是原来的对象。
:::

:::explanation
`memo` 只在**每一个** prop 都和上一次相同时才跳过渲染，所以要逐个检查传给 `ProductRow` 的 props：

- `product`：`sortByPrice` 和 `filter` 都返回新数组，但数组中的商品还是原来的那些对象，所以即使每次都重新排序，`product` 也不会变。`useMemo(() => sortByPrice(products), [products])` 是为了另一件事：避免在备注、收藏、筛选变化时重复做那个慢的排序；
- `favorite`：一个布尔值，只有被点击的那一行会变；
- `onToggle`：普通的函数每次渲染都是新的。`useCallback` 让它保持不变，前提是依赖不变：用更新函数读取最新的收藏，依赖就是空数组。如果写成 `useCallback(…, [favorites])`，每次收藏之后 `toggle` 都是新的，所有行又都会重新渲染。

把筛选也放进同一个 `useMemo`（依赖 `[products, query]`）看起来更省事，但每输入一个筛选字都会重新排序一遍。依赖要写得恰好：排序只依赖目录，筛选很便宜，留在渲染时做就好。

在 `memo` 的组件上写内联的 `onToggle={(id) => toggle(id)}`，前面的努力就全白费了。自定义比较函数（`memo` 的第二个参数）也很危险：只比较 `product` 而忽略 `favorite`，星标就不会更新了。

这道题的“慢”是假设出来的。真实项目中，先用 React DevTools 的 Profiler 确认问题在哪里；更简单的办法往往是调整结构，例如把“备注”做成一个自己保存输入内容的组件，`ProductList` 根本不会因为备注而重新渲染。启用 React Compiler 的项目中，编译器会自动完成这里的大部分工作。
:::

:::variant{kind=alt name=memo-wrapper}
```tsx file=ProductList.tsx
import { memo, useCallback, useMemo, useState, type ChangeEvent } from 'react';
import { Tracked, sortByPrice, type Product } from './lib';

type RowProps = { product: Product; favorite: boolean; onToggle: (id: string) => void };

function Row({ product, favorite, onToggle }: RowProps) {
  return (
    <Tracked id={product.id}>
      <li>
        {product.name} ¥{product.price}{' '}
        <button type="button" aria-pressed={favorite} aria-label={`收藏${product.name}`} onClick={() => onToggle(product.id)}>
          {favorite ? '★' : '☆'}
        </button>
      </li>
    </Tracked>
  );
}

export const ProductRow = memo(Row);

export function ProductList({ products }: { products: readonly Product[] }) {
  const [query, setQuery] = useState('');
  const [note, setNote] = useState('');
  const [favorites, setFavorites] = useState<ReadonlySet<string>>(() => new Set());

  const sorted = useMemo(() => sortByPrice(products), [products]);
  const text = query.trim();
  const visible = useMemo(() => (text === '' ? sorted : sorted.filter((p) => p.name.includes(text))), [sorted, text]);

  const toggle = useCallback(
    (id: string) =>
      setFavorites((current) => (current.has(id) ? new Set([...current].filter((x) => x !== id)) : new Set([...current, id]))),
    [],
  );

  const onQuery = (e: ChangeEvent<HTMLInputElement>) => setQuery(e.currentTarget.value);

  return (
    <div>
      <label>
        筛选 <input value={query} onChange={onQuery} />
      </label>
      <label>
        备注 <textarea value={note} onChange={(e) => setNote(e.currentTarget.value)} />
      </label>
      <ul aria-label="商品">
        {visible.map((p) => (
          <ProductRow key={p.id} product={p} favorite={favorites.has(p.id)} onToggle={toggle} />
        ))}
      </ul>
      <p role="status">已收藏 {favorites.size} 件</p>
    </div>
  );
}
```
:::

:::variant{kind=wrong name=no-memo fails=tests reason="用了 useMemo 和 useCallback，却没有用 memo 包住 ProductRow，每次都重新渲染所有的行"}
```tsx file=ProductList.tsx
import { useCallback, useMemo, useState } from 'react';
import { Tracked, sortByPrice, type Product } from './lib';

type RowProps = { product: Product; favorite: boolean; onToggle: (id: string) => void };

export function ProductRow({ product, favorite, onToggle }: RowProps) {
  return (
    <Tracked id={product.id}>
      <li>
        {product.name} ¥{product.price}{' '}
        <button type="button" aria-pressed={favorite} aria-label={`收藏${product.name}`} onClick={() => onToggle(product.id)}>
          {favorite ? '★' : '☆'}
        </button>
      </li>
    </Tracked>
  );
}

export function ProductList({ products }: { products: readonly Product[] }) {
  const [query, setQuery] = useState('');
  const [note, setNote] = useState('');
  const [favorites, setFavorites] = useState<ReadonlySet<string>>(new Set());

  const sorted = useMemo(() => sortByPrice(products), [products]);
  const visible = sorted.filter((p) => p.name.includes(query.trim()));

  const toggle = useCallback((id: string) => {
    setFavorites((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  return (
    <div>
      <label>
        筛选 <input value={query} onChange={(e) => setQuery(e.currentTarget.value)} />
      </label>
      <label>
        备注 <textarea value={note} onChange={(e) => setNote(e.currentTarget.value)} />
      </label>
      <ul aria-label="商品">
        {visible.map((p) => (
          <ProductRow key={p.id} product={p} favorite={favorites.has(p.id)} onToggle={toggle} />
        ))}
      </ul>
      <p role="status">已收藏 {favorites.size} 件</p>
    </div>
  );
}
```
:::

:::variant{kind=wrong name=inline-handler fails=tests reason="给 memo 组件传了内联的箭头函数，每次都是新的 onToggle"}
```tsx file=ProductList.tsx
import { memo, useCallback, useMemo, useState } from 'react';
import { Tracked, sortByPrice, type Product } from './lib';

type RowProps = { product: Product; favorite: boolean; onToggle: (id: string) => void };

export const ProductRow = memo(function ProductRow({ product, favorite, onToggle }: RowProps) {
  return (
    <Tracked id={product.id}>
      <li>
        {product.name} ¥{product.price}{' '}
        <button type="button" aria-pressed={favorite} aria-label={`收藏${product.name}`} onClick={() => onToggle(product.id)}>
          {favorite ? '★' : '☆'}
        </button>
      </li>
    </Tracked>
  );
});

export function ProductList({ products }: { products: readonly Product[] }) {
  const [query, setQuery] = useState('');
  const [note, setNote] = useState('');
  const [favorites, setFavorites] = useState<ReadonlySet<string>>(new Set());

  const sorted = useMemo(() => sortByPrice(products), [products]);
  const visible = sorted.filter((p) => p.name.includes(query.trim()));

  const toggle = useCallback((id: string) => {
    setFavorites((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  return (
    <div>
      <label>
        筛选 <input value={query} onChange={(e) => setQuery(e.currentTarget.value)} />
      </label>
      <label>
        备注 <textarea value={note} onChange={(e) => setNote(e.currentTarget.value)} />
      </label>
      <ul aria-label="商品">
        {visible.map((p) => (
          <ProductRow key={p.id} product={p} favorite={favorites.has(p.id)} onToggle={(id) => toggle(id)} />
        ))}
      </ul>
      <p role="status">已收藏 {favorites.size} 件</p>
    </div>
  );
}
```
:::

:::variant{kind=wrong name=callback-reads-state fails=tests reason="useCallback 依赖 favorites，每次收藏之后 toggle 都变了，所有的行都重新渲染"}
```tsx file=ProductList.tsx
import { memo, useCallback, useMemo, useState } from 'react';
import { Tracked, sortByPrice, type Product } from './lib';

type RowProps = { product: Product; favorite: boolean; onToggle: (id: string) => void };

export const ProductRow = memo(function ProductRow({ product, favorite, onToggle }: RowProps) {
  return (
    <Tracked id={product.id}>
      <li>
        {product.name} ¥{product.price}{' '}
        <button type="button" aria-pressed={favorite} aria-label={`收藏${product.name}`} onClick={() => onToggle(product.id)}>
          {favorite ? '★' : '☆'}
        </button>
      </li>
    </Tracked>
  );
});

export function ProductList({ products }: { products: readonly Product[] }) {
  const [query, setQuery] = useState('');
  const [note, setNote] = useState('');
  const [favorites, setFavorites] = useState<ReadonlySet<string>>(new Set());

  const sorted = useMemo(() => sortByPrice(products), [products]);
  const visible = sorted.filter((p) => p.name.includes(query.trim()));

  const toggle = useCallback(
    (id: string) => {
      const next = new Set(favorites);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      setFavorites(next);
    },
    [favorites],
  );

  return (
    <div>
      <label>
        筛选 <input value={query} onChange={(e) => setQuery(e.currentTarget.value)} />
      </label>
      <label>
        备注 <textarea value={note} onChange={(e) => setNote(e.currentTarget.value)} />
      </label>
      <ul aria-label="商品">
        {visible.map((p) => (
          <ProductRow key={p.id} product={p} favorite={favorites.has(p.id)} onToggle={toggle} />
        ))}
      </ul>
      <p role="status">已收藏 {favorites.size} 件</p>
    </div>
  );
}
```
:::

:::variant{kind=wrong name=sort-every-render fails=tests reason="没有缓存排序的结果，每次渲染都重新排序"}
```tsx file=ProductList.tsx
import { memo, useCallback, useState } from 'react';
import { Tracked, sortByPrice, type Product } from './lib';

type RowProps = { product: Product; favorite: boolean; onToggle: (id: string) => void };

export const ProductRow = memo(function ProductRow({ product, favorite, onToggle }: RowProps) {
  return (
    <Tracked id={product.id}>
      <li>
        {product.name} ¥{product.price}{' '}
        <button type="button" aria-pressed={favorite} aria-label={`收藏${product.name}`} onClick={() => onToggle(product.id)}>
          {favorite ? '★' : '☆'}
        </button>
      </li>
    </Tracked>
  );
});

export function ProductList({ products }: { products: readonly Product[] }) {
  const [query, setQuery] = useState('');
  const [note, setNote] = useState('');
  const [favorites, setFavorites] = useState<ReadonlySet<string>>(new Set());

  const sorted = sortByPrice(products);
  const visible = sorted.filter((p) => p.name.includes(query.trim()));

  const toggle = useCallback((id: string) => {
    setFavorites((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  return (
    <div>
      <label>
        筛选 <input value={query} onChange={(e) => setQuery(e.currentTarget.value)} />
      </label>
      <label>
        备注 <textarea value={note} onChange={(e) => setNote(e.currentTarget.value)} />
      </label>
      <ul aria-label="商品">
        {visible.map((p) => (
          <ProductRow key={p.id} product={p} favorite={favorites.has(p.id)} onToggle={toggle} />
        ))}
      </ul>
      <p role="status">已收藏 {favorites.size} 件</p>
    </div>
  );
}
```
:::

:::variant{kind=wrong name=compare-product-only fails=tests reason="memo 的比较函数只比较 product，忽略了 favorite，星标不再更新"}
```tsx file=ProductList.tsx
import { memo, useCallback, useMemo, useState } from 'react';
import { Tracked, sortByPrice, type Product } from './lib';

type RowProps = { product: Product; favorite: boolean; onToggle: (id: string) => void };

export const ProductRow = memo(function ProductRow({ product, favorite, onToggle }: RowProps) {
  return (
    <Tracked id={product.id}>
      <li>
        {product.name} ¥{product.price}{' '}
        <button type="button" aria-pressed={favorite} aria-label={`收藏${product.name}`} onClick={() => onToggle(product.id)}>
          {favorite ? '★' : '☆'}
        </button>
      </li>
    </Tracked>
  );
}, (prev, next) => prev.product === next.product);

export function ProductList({ products }: { products: readonly Product[] }) {
  const [query, setQuery] = useState('');
  const [note, setNote] = useState('');
  const [favorites, setFavorites] = useState<ReadonlySet<string>>(new Set());

  const sorted = useMemo(() => sortByPrice(products), [products]);
  const visible = sorted.filter((p) => p.name.includes(query.trim()));

  const toggle = useCallback((id: string) => {
    setFavorites((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  return (
    <div>
      <label>
        筛选 <input value={query} onChange={(e) => setQuery(e.currentTarget.value)} />
      </label>
      <label>
        备注 <textarea value={note} onChange={(e) => setNote(e.currentTarget.value)} />
      </label>
      <ul aria-label="商品">
        {visible.map((p) => (
          <ProductRow key={p.id} product={p} favorite={favorites.has(p.id)} onToggle={toggle} />
        ))}
      </ul>
      <p role="status">已收藏 {favorites.size} 件</p>
    </div>
  );
}
```
:::

:::variant{kind=wrong name=missing-dependency fails=tests reason="把筛选也放进 useMemo，依赖却漏掉了 query，筛选不起作用"}
```tsx file=ProductList.tsx
import { memo, useCallback, useMemo, useState } from 'react';
import { Tracked, sortByPrice, type Product } from './lib';

type RowProps = { product: Product; favorite: boolean; onToggle: (id: string) => void };

export const ProductRow = memo(function ProductRow({ product, favorite, onToggle }: RowProps) {
  return (
    <Tracked id={product.id}>
      <li>
        {product.name} ¥{product.price}{' '}
        <button type="button" aria-pressed={favorite} aria-label={`收藏${product.name}`} onClick={() => onToggle(product.id)}>
          {favorite ? '★' : '☆'}
        </button>
      </li>
    </Tracked>
  );
});

export function ProductList({ products }: { products: readonly Product[] }) {
  const [query, setQuery] = useState('');
  const [note, setNote] = useState('');
  const [favorites, setFavorites] = useState<ReadonlySet<string>>(new Set());

  const visible = useMemo(() => sortByPrice(products).filter((p) => p.name.includes(query.trim())), [products]);

  const toggle = useCallback((id: string) => {
    setFavorites((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  return (
    <div>
      <label>
        筛选 <input value={query} onChange={(e) => setQuery(e.currentTarget.value)} />
      </label>
      <label>
        备注 <textarea value={note} onChange={(e) => setNote(e.currentTarget.value)} />
      </label>
      <ul aria-label="商品">
        {visible.map((p) => (
          <ProductRow key={p.id} product={p} favorite={favorites.has(p.id)} onToggle={toggle} />
        ))}
      </ul>
      <p role="status">已收藏 {favorites.size} 件</p>
    </div>
  );
}
```
:::

:::variant{kind=wrong name=sort-with-filter fails=tests reason="把排序和筛选放进同一个 useMemo，每输入一个筛选字都重新排序"}
```tsx file=ProductList.tsx
import { memo, useCallback, useMemo, useState } from 'react';
import { Tracked, sortByPrice, type Product } from './lib';

type RowProps = { product: Product; favorite: boolean; onToggle: (id: string) => void };

export const ProductRow = memo(function ProductRow({ product, favorite, onToggle }: RowProps) {
  return (
    <Tracked id={product.id}>
      <li>
        {product.name} ¥{product.price}{' '}
        <button type="button" aria-pressed={favorite} aria-label={`收藏${product.name}`} onClick={() => onToggle(product.id)}>
          {favorite ? '★' : '☆'}
        </button>
      </li>
    </Tracked>
  );
});

export function ProductList({ products }: { products: readonly Product[] }) {
  const [query, setQuery] = useState('');
  const [note, setNote] = useState('');
  const [favorites, setFavorites] = useState<ReadonlySet<string>>(new Set());

  const visible = useMemo(() => sortByPrice(products).filter((p) => p.name.includes(query.trim())), [products, query]);

  const toggle = useCallback((id: string) => {
    setFavorites((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  return (
    <div>
      <label>
        筛选 <input value={query} onChange={(e) => setQuery(e.currentTarget.value)} />
      </label>
      <label>
        备注 <textarea value={note} onChange={(e) => setNote(e.currentTarget.value)} />
      </label>
      <ul aria-label="商品">
        {visible.map((p) => (
          <ProductRow key={p.id} product={p} favorite={favorites.has(p.id)} onToggle={toggle} />
        ))}
      </ul>
      <p role="status">已收藏 {favorites.size} 件</p>
    </div>
  );
}
```
:::
