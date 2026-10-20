---
kind: challenge
title: 购物车的 Context
---
`cart.tsx` 中的三个组件 `ProductList`、`CartBadge`、`CartPanel` 已经写好，它们都通过 `useCart()` 读写购物车。实现 `CartProvider` 和 `useCart`：

- `CartProvider` 接收商品目录 `products`，在 state 中保存购物车的内容，通过 Context 提供 `CartValue`；
- `lines`：购物车中的每一种商品和数量，按**加入购物车的顺序**排列（移除之后再加入的，排在最后）；`count` 是总件数，`total` 是总价；
- `add(id)`：这种商品加 1（没有就加入，数量为 1）；
- `setQuantity(id, quantity)`：设置数量；小于等于 0 时从购物车中移除；购物车中还没有这种商品、数量又大于 0 时，加入到最后；
- 每种商品最多 99 件，超过的部分忽略；`clear()` 清空购物车；
- 商品的名字和价格总是来自**最新的** `products`：目录中的价格变了，合计也要跟着变；
- `useCart()` 在 Provider 之外调用时抛出错误 `useCart 必须在 <CartProvider> 中使用`。

:::files{role=starter}
```tsx file=cart.tsx
import { createContext, useContext, useState, type ReactNode } from 'react';

export type Product = { id: string; name: string; price: number };
export type CartLine = { product: Product; quantity: number };
export type CartValue = {
  products: readonly Product[];
  lines: readonly CartLine[];
  count: number;
  total: number;
  add: (id: string) => void;
  setQuantity: (id: string, quantity: number) => void;
  clear: () => void;
};

const MAX = 99;

// TODO：创建 Context，实现 CartProvider 和 useCart
export function CartProvider({ products, children }: { products: readonly Product[]; children: ReactNode }) {
  return <>{children}</>;
}

export function useCart(): CartValue {
  return { products: [], lines: [], count: 0, total: 0, add: () => {}, setQuantity: () => {}, clear: () => {} };
}

const yuan = (n: number) => `¥${n.toFixed(2)}`;

export function ProductList() {
  const { products, add } = useCart();
  return (
    <ul aria-label="商品">
      {products.map((p) => (
        <li key={p.id}>
          {p.name} {yuan(p.price)}{' '}
          <button type="button" aria-label={`把${p.name}加入购物车`} onClick={() => add(p.id)}>
            加入购物车
          </button>
        </li>
      ))}
    </ul>
  );
}

export function CartBadge() {
  const { count } = useCart();
  return <output aria-label="购物车中的商品数量">{count}</output>;
}

export function CartPanel() {
  const { lines, total, setQuantity, clear } = useCart();
  if (lines.length === 0) return <p>购物车是空的</p>;
  return (
    <section aria-label="购物车">
      <ul>
        {lines.map(({ product, quantity }) => (
          <li key={product.id}>
            {product.name} × <output aria-label={`${product.name}的数量`}>{quantity}</output>{' '}
            <button type="button" aria-label={`减少${product.name}`} onClick={() => setQuantity(product.id, quantity - 1)}>
              −
            </button>
            <button type="button" aria-label={`增加${product.name}`} disabled={quantity >= MAX} onClick={() => setQuantity(product.id, quantity + 1)}>
              +
            </button>
            <button type="button" aria-label={`移除${product.name}`} onClick={() => setQuantity(product.id, 0)}>
              移除
            </button>
          </li>
        ))}
      </ul>
      <p>合计 {yuan(total)}</p>
      <button type="button" onClick={clear}>
        清空购物车
      </button>
    </section>
  );
}
```
:::

:::files{role=support}
```tsx file=main.tsx readonly
import { createRoot } from 'react-dom/client';
import { CartBadge, CartPanel, CartProvider, ProductList, type Product } from './cart';

const products: Product[] = [
  { id: 'tea', name: '绿茶', price: 12.5 },
  { id: 'cake', name: '蛋糕', price: 28 },
  { id: 'coffee', name: '咖啡', price: 22 },
];

const container = document.getElementById('root');
if (!container) throw new Error('页面缺少 #root');
createRoot(container).render(
  <CartProvider products={products}>
    <header>
      购物车：<CartBadge /> 件
    </header>
    <ProductList />
    <CartPanel />
  </CartProvider>,
);
```
:::

:::files{role=solution}
```tsx file=cart.tsx
import { createContext, useContext, useState, type ReactNode } from 'react';

export type Product = { id: string; name: string; price: number };
export type CartLine = { product: Product; quantity: number };
export type CartValue = {
  products: readonly Product[];
  lines: readonly CartLine[];
  count: number;
  total: number;
  add: (id: string) => void;
  setQuantity: (id: string, quantity: number) => void;
  clear: () => void;
};

const MAX = 99;

const CartContext = createContext<CartValue | null>(null);

export function CartProvider({ products, children }: { products: readonly Product[]; children: ReactNode }) {
  const [items, setItems] = useState<readonly { id: string; quantity: number }[]>([]);

  const lines = items.flatMap(({ id, quantity }) => {
    const product = products.find((p) => p.id === id);
    return product === undefined ? [] : [{ product, quantity }];
  });

  function setQuantity(id: string, quantity: number) {
    const next = Math.min(MAX, Math.trunc(quantity));
    setItems((current) => {
      if (next <= 0) return current.filter((item) => item.id !== id);
      if (current.some((item) => item.id === id)) return current.map((item) => (item.id === id ? { id, quantity: next } : item));
      return [...current, { id, quantity: next }];
    });
  }

  const value: CartValue = {
    products,
    lines,
    count: lines.reduce((sum, line) => sum + line.quantity, 0),
    total: lines.reduce((sum, line) => sum + line.product.price * line.quantity, 0),
    add: (id) =>
      setItems((current) => {
        const found = current.find((item) => item.id === id);
        if (found === undefined) return [...current, { id, quantity: 1 }];
        return current.map((item) => (item.id === id ? { id, quantity: Math.min(MAX, item.quantity + 1) } : item));
      }),
    setQuantity,
    clear: () => setItems([]),
  };
  return <CartContext value={value}>{children}</CartContext>;
}

export function useCart(): CartValue {
  const value = useContext(CartContext);
  if (value === null) throw new Error('useCart 必须在 <CartProvider> 中使用');
  return value;
}

const yuan = (n: number) => `¥${n.toFixed(2)}`;

export function ProductList() {
  const { products, add } = useCart();
  return (
    <ul aria-label="商品">
      {products.map((p) => (
        <li key={p.id}>
          {p.name} {yuan(p.price)}{' '}
          <button type="button" aria-label={`把${p.name}加入购物车`} onClick={() => add(p.id)}>
            加入购物车
          </button>
        </li>
      ))}
    </ul>
  );
}

export function CartBadge() {
  const { count } = useCart();
  return <output aria-label="购物车中的商品数量">{count}</output>;
}

export function CartPanel() {
  const { lines, total, setQuantity, clear } = useCart();
  if (lines.length === 0) return <p>购物车是空的</p>;
  return (
    <section aria-label="购物车">
      <ul>
        {lines.map(({ product, quantity }) => (
          <li key={product.id}>
            {product.name} × <output aria-label={`${product.name}的数量`}>{quantity}</output>{' '}
            <button type="button" aria-label={`减少${product.name}`} onClick={() => setQuantity(product.id, quantity - 1)}>
              −
            </button>
            <button type="button" aria-label={`增加${product.name}`} disabled={quantity >= MAX} onClick={() => setQuantity(product.id, quantity + 1)}>
              +
            </button>
            <button type="button" aria-label={`移除${product.name}`} onClick={() => setQuantity(product.id, 0)}>
              移除
            </button>
          </li>
        ))}
      </ul>
      <p>合计 {yuan(total)}</p>
      <button type="button" onClick={clear}>
        清空购物车
      </button>
    </section>
  );
}
```
:::

:::files{role=tests}
```tsx file=cart.test.tsx
import type { ReactNode } from 'react';
import { expect, test } from 'vitest';
import { act, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CartBadge, CartPanel, CartProvider, ProductList, useCart, type Product } from './cart';

const products: Product[] = [
  { id: 'tea', name: '绿茶', price: 12.5 },
  { id: 'cake', name: '蛋糕', price: 28 },
];

function Shop({ catalog = products }: { catalog?: readonly Product[] }) {
  return (
    <CartProvider products={catalog}>
      <CartBadge />
      <ProductList />
      <CartPanel />
    </CartProvider>
  );
}

const badge = () => screen.getByRole('status', { name: '购物车中的商品数量' });
const quantityOf = (name: string) => screen.getByRole('status', { name: `${name}的数量` });
const button = (name: string) => screen.getByRole('button', { name });

test('加入购物车：数量、件数、合计在各个组件中同步更新', async () => {
  const user = userEvent.setup();
  render(<Shop />);
  expect(badge()).toHaveTextContent('0');
  expect(screen.getByText('购物车是空的')).toBeInTheDocument();
  await user.click(button('把绿茶加入购物车'));
  await user.click(button('把蛋糕加入购物车'));
  await user.click(button('把绿茶加入购物车'));
  expect(badge()).toHaveTextContent('3');
  expect(quantityOf('绿茶')).toHaveTextContent('2');
  expect(quantityOf('蛋糕')).toHaveTextContent('1');
  expect(screen.getByText('合计 ¥53.00')).toBeInTheDocument();
  const names = screen.getAllByRole('listitem').filter((li) => li.closest('[aria-label="购物车"]') !== null);
  expect(names.map((li) => li.textContent?.split(' ×')[0])).toEqual(['绿茶', '蛋糕']);
});

test('减少到 0 时从购物车中移除；移除；清空', async () => {
  const user = userEvent.setup();
  render(<Shop />);
  await user.click(button('把绿茶加入购物车'));
  await user.click(button('把蛋糕加入购物车'));
  await user.click(button('减少绿茶'));
  expect(screen.queryByRole('status', { name: '绿茶的数量' })).toBeNull();
  expect(badge()).toHaveTextContent('1');
  await user.click(button('增加蛋糕'));
  await user.click(button('移除蛋糕'));
  expect(screen.getByText('购物车是空的')).toBeInTheDocument();
  await user.click(button('把蛋糕加入购物车'));
  await user.click(button('清空购物车'));
  expect(badge()).toHaveTextContent('0');
});

test('每种商品最多 99 件', () => {
  const wrapper = ({ children }: { children: ReactNode }) => <CartProvider products={products}>{children}</CartProvider>;
  const { result } = renderHook(() => useCart(), { wrapper });
  act(() => {
    for (let i = 0; i < 101; i++) result.current.add('tea');
  });
  expect(result.current.lines[0]?.quantity).toBe(99);
  act(() => {
    result.current.setQuantity('tea', 50);
    result.current.setQuantity('cake', 150);
  });
  expect(result.current.lines.map((line) => [line.product.id, line.quantity])).toEqual([
    ['tea', 50],
    ['cake', 99],
  ]);
  expect(result.current.count).toBe(149);
});

test('移除之后再加入的商品排在最后', () => {
  const wrapper = ({ children }: { children: ReactNode }) => <CartProvider products={products}>{children}</CartProvider>;
  const { result } = renderHook(() => useCart(), { wrapper });
  act(() => {
    result.current.add('tea');
    result.current.add('cake');
    result.current.setQuantity('tea', 0);
    result.current.add('tea');
  });
  expect(result.current.lines.map((line) => line.product.id)).toEqual(['cake', 'tea']);
});

test('名字和价格来自最新的商品目录，而不是加入时的副本', async () => {
  const user = userEvent.setup();
  const { rerender } = render(<Shop />);
  await user.click(button('把蛋糕加入购物车'));
  rerender(
    <Shop
      catalog={[
        { id: 'tea', name: '绿茶', price: 12.5 },
        { id: 'cake', name: '奶油蛋糕', price: 30 },
      ]}
    />,
  );
  expect(quantityOf('奶油蛋糕')).toHaveTextContent('1');
  expect(screen.getByText('合计 ¥30.00')).toBeInTheDocument();
});

test('两个 Provider 各有各的购物车', async () => {
  const user = userEvent.setup();
  render(
    <>
      <Shop />
      <CartProvider products={products}>
        <section aria-label="另一个">
          <CartBadge />
        </section>
      </CartProvider>
    </>,
  );
  await user.click(button('把绿茶加入购物车'));
  const badges = screen.getAllByRole('status', { name: '购物车中的商品数量' });
  expect(badges.map((b) => b.textContent)).toEqual(['1', '0']);
});

test('在 Provider 之外使用 useCart 立即报错', () => {
  expect(() => renderHook(() => useCart())).toThrow('useCart 必须在 <CartProvider> 中使用');
});
```
```tsx file=cart.test-d.tsx
import { expectTypeOf } from 'vitest';
import { useCart, type CartValue } from './cart';

expectTypeOf(useCart).returns.toEqualTypeOf<CartValue>();
```
:::

:::hint{level=1}
state 中只存“哪种商品、几件”：`readonly { id: string; quantity: number }[]`（g07：存 id 而不是对象的副本）。`lines`、`count`、`total` 都在渲染时从这个数组和 `products` 算出来。
:::

:::hint{level=2}
修改数组用更新函数和不修改原数组的方法（g04）：加入是 `[...current, { id, quantity: 1 }]`，修改是 `map`，移除是 `filter`。`setQuantity` 也要处理“购物车中还没有这种商品”的情况：这时和加入一样，追加到最后。`lines` 可以用 `flatMap`：在 `products` 中找到对应的商品就返回 `[{ product, quantity }]`，找不到就返回 `[]`。
:::

:::explanation
这道题把前面几课的东西用在了一起：

- **Context**（本课）：三个组件分散在页面各处，却共享同一个购物车，不用一层层传 props；
- **自定义 Hook 与 null 默认值**：`useCart` 检查 Provider 是否存在，返回不含 `null` 的类型；
- **state 的结构**（g07）：只存 `id` 和数量，名字和价格从最新的目录中查出来，所以目录更新后合计自动正确。如果把加入时的商品对象存进 state，就成了一份不会更新的副本；
- **派生数据**：件数和合计不另存，每次渲染时计算；
- **不可变更新**（g04）：每次修改都创建新数组。

`setQuantity` 和 `add` 都用更新函数（`setItems((current) => …)`），所以在一个事件中连续调用多次（测试中连续调用 `add` 101 次）也都基于最新的数据。
:::

:::variant{kind=alt name=map-state}
```tsx file=cart.tsx
import { createContext, useContext, useState, type ReactNode } from 'react';

export type Product = { id: string; name: string; price: number };
export type CartLine = { product: Product; quantity: number };
export type CartValue = {
  products: readonly Product[];
  lines: readonly CartLine[];
  count: number;
  total: number;
  add: (id: string) => void;
  setQuantity: (id: string, quantity: number) => void;
  clear: () => void;
};

const MAX = 99;

const CartContext = createContext<CartValue | null>(null);

type Quantities = ReadonlyMap<string, number>;

export function CartProvider({ products, children }: { products: readonly Product[]; children: ReactNode }) {
  const [quantities, setQuantities] = useState<Quantities>(new Map());

  const update = (id: string, change: (old: number) => number) =>
    setQuantities((current) => {
      const next = new Map(current);
      const quantity = Math.min(MAX, Math.trunc(change(current.get(id) ?? 0)));
      if (quantity <= 0) next.delete(id);
      else next.set(id, quantity);
      return next;
    });

  const lines: CartLine[] = [];
  for (const [id, quantity] of quantities) {
    const product = products.find((p) => p.id === id);
    if (product) lines.push({ product, quantity });
  }

  return (
    <CartContext
      value={{
        products,
        lines,
        count: lines.reduce((n, l) => n + l.quantity, 0),
        total: lines.reduce((n, l) => n + l.quantity * l.product.price, 0),
        add: (id) => update(id, (q) => q + 1),
        setQuantity: (id, quantity) => update(id, () => quantity),
        clear: () => setQuantities(new Map()),
      }}
    >
      {children}
    </CartContext>
  );
}

export function useCart(): CartValue {
  const cart = useContext(CartContext);
  if (cart === null) throw new Error('useCart 必须在 <CartProvider> 中使用');
  return cart;
}

const yuan = (n: number) => `¥${n.toFixed(2)}`;

export function ProductList() {
  const { products, add } = useCart();
  return (
    <ul aria-label="商品">
      {products.map((p) => (
        <li key={p.id}>
          {p.name} {yuan(p.price)}{' '}
          <button type="button" aria-label={`把${p.name}加入购物车`} onClick={() => add(p.id)}>
            加入购物车
          </button>
        </li>
      ))}
    </ul>
  );
}

export function CartBadge() {
  const { count } = useCart();
  return <output aria-label="购物车中的商品数量">{count}</output>;
}

export function CartPanel() {
  const { lines, total, setQuantity, clear } = useCart();
  if (lines.length === 0) return <p>购物车是空的</p>;
  return (
    <section aria-label="购物车">
      <ul>
        {lines.map(({ product, quantity }) => (
          <li key={product.id}>
            {product.name} × <output aria-label={`${product.name}的数量`}>{quantity}</output>{' '}
            <button type="button" aria-label={`减少${product.name}`} onClick={() => setQuantity(product.id, quantity - 1)}>
              −
            </button>
            <button type="button" aria-label={`增加${product.name}`} disabled={quantity >= MAX} onClick={() => setQuantity(product.id, quantity + 1)}>
              +
            </button>
            <button type="button" aria-label={`移除${product.name}`} onClick={() => setQuantity(product.id, 0)}>
              移除
            </button>
          </li>
        ))}
      </ul>
      <p>合计 {yuan(total)}</p>
      <button type="button" onClick={clear}>
        清空购物车
      </button>
    </section>
  );
}
```
:::

:::variant{kind=wrong name=store-copies fails=tests reason="把加入时的商品对象存进了 state，目录中的名字和价格变了，购物车不变"}
```tsx file=cart.tsx
import { createContext, useContext, useState, type ReactNode } from 'react';

export type Product = { id: string; name: string; price: number };
export type CartLine = { product: Product; quantity: number };
export type CartValue = {
  products: readonly Product[];
  lines: readonly CartLine[];
  count: number;
  total: number;
  add: (id: string) => void;
  setQuantity: (id: string, quantity: number) => void;
  clear: () => void;
};

const MAX = 99;

const CartContext = createContext<CartValue | null>(null);

export function CartProvider({ products, children }: { products: readonly Product[]; children: ReactNode }) {
  const [lines, setLines] = useState<readonly CartLine[]>([]);

  function setQuantity(id: string, quantity: number) {
    const next = Math.min(MAX, Math.trunc(quantity));
    setLines((current) => {
      if (next <= 0) return current.filter((line) => line.product.id !== id);
      if (current.some((line) => line.product.id === id)) {
        return current.map((line) => (line.product.id === id ? { ...line, quantity: next } : line));
      }
      const product = products.find((p) => p.id === id);
      return product === undefined ? current : [...current, { product, quantity: next }];
    });
  }

  const value: CartValue = {
    products,
    lines,
    count: lines.reduce((sum, line) => sum + line.quantity, 0),
    total: lines.reduce((sum, line) => sum + line.product.price * line.quantity, 0),
    add: (id) =>
      setLines((current) => {
        const product = products.find((p) => p.id === id);
        if (product === undefined) return current;
        const found = current.find((line) => line.product.id === id);
        if (found === undefined) return [...current, { product, quantity: 1 }];
        return current.map((line) => (line.product.id === id ? { ...line, quantity: Math.min(MAX, line.quantity + 1) } : line));
      }),
    setQuantity,
    clear: () => setLines([]),
  };
  return <CartContext value={value}>{children}</CartContext>;
}

export function useCart(): CartValue {
  const value = useContext(CartContext);
  if (value === null) throw new Error('useCart 必须在 <CartProvider> 中使用');
  return value;
}

const yuan = (n: number) => `¥${n.toFixed(2)}`;

export function ProductList() {
  const { products, add } = useCart();
  return (
    <ul aria-label="商品">
      {products.map((p) => (
        <li key={p.id}>
          {p.name} {yuan(p.price)}{' '}
          <button type="button" aria-label={`把${p.name}加入购物车`} onClick={() => add(p.id)}>
            加入购物车
          </button>
        </li>
      ))}
    </ul>
  );
}

export function CartBadge() {
  const { count } = useCart();
  return <output aria-label="购物车中的商品数量">{count}</output>;
}

export function CartPanel() {
  const { lines, total, setQuantity, clear } = useCart();
  if (lines.length === 0) return <p>购物车是空的</p>;
  return (
    <section aria-label="购物车">
      <ul>
        {lines.map(({ product, quantity }) => (
          <li key={product.id}>
            {product.name} × <output aria-label={`${product.name}的数量`}>{quantity}</output>{' '}
            <button type="button" aria-label={`减少${product.name}`} onClick={() => setQuantity(product.id, quantity - 1)}>
              −
            </button>
            <button type="button" aria-label={`增加${product.name}`} disabled={quantity >= MAX} onClick={() => setQuantity(product.id, quantity + 1)}>
              +
            </button>
            <button type="button" aria-label={`移除${product.name}`} onClick={() => setQuantity(product.id, 0)}>
              移除
            </button>
          </li>
        ))}
      </ul>
      <p>合计 {yuan(total)}</p>
      <button type="button" onClick={clear}>
        清空购物车
      </button>
    </section>
  );
}
```
:::

:::variant{kind=wrong name=set-existing-only fails=tests reason="setQuantity 只修改已经在购物车中的商品，不在购物车中的被忽略了"}
```tsx file=cart.tsx
import { createContext, useContext, useState, type ReactNode } from 'react';

export type Product = { id: string; name: string; price: number };
export type CartLine = { product: Product; quantity: number };
export type CartValue = {
  products: readonly Product[];
  lines: readonly CartLine[];
  count: number;
  total: number;
  add: (id: string) => void;
  setQuantity: (id: string, quantity: number) => void;
  clear: () => void;
};

const MAX = 99;

const CartContext = createContext<CartValue | null>(null);

export function CartProvider({ products, children }: { products: readonly Product[]; children: ReactNode }) {
  const [items, setItems] = useState<readonly { id: string; quantity: number }[]>([]);

  const lines = items.flatMap(({ id, quantity }) => {
    const product = products.find((p) => p.id === id);
    return product === undefined ? [] : [{ product, quantity }];
  });

  function setQuantity(id: string, quantity: number) {
    const next = Math.min(MAX, Math.trunc(quantity));
    setItems((current) => {
      if (next <= 0) return current.filter((item) => item.id !== id);
      return current.map((item) => (item.id === id ? { id, quantity: next } : item));
    });
  }

  const value: CartValue = {
    products,
    lines,
    count: lines.reduce((sum, line) => sum + line.quantity, 0),
    total: lines.reduce((sum, line) => sum + line.product.price * line.quantity, 0),
    add: (id) =>
      setItems((current) => {
        const found = current.find((item) => item.id === id);
        if (found === undefined) return [...current, { id, quantity: 1 }];
        return current.map((item) => (item.id === id ? { id, quantity: Math.min(MAX, item.quantity + 1) } : item));
      }),
    setQuantity,
    clear: () => setItems([]),
  };
  return <CartContext value={value}>{children}</CartContext>;
}

export function useCart(): CartValue {
  const value = useContext(CartContext);
  if (value === null) throw new Error('useCart 必须在 <CartProvider> 中使用');
  return value;
}

const yuan = (n: number) => `¥${n.toFixed(2)}`;

export function ProductList() {
  const { products, add } = useCart();
  return (
    <ul aria-label="商品">
      {products.map((p) => (
        <li key={p.id}>
          {p.name} {yuan(p.price)}{' '}
          <button type="button" aria-label={`把${p.name}加入购物车`} onClick={() => add(p.id)}>
            加入购物车
          </button>
        </li>
      ))}
    </ul>
  );
}

export function CartBadge() {
  const { count } = useCart();
  return <output aria-label="购物车中的商品数量">{count}</output>;
}

export function CartPanel() {
  const { lines, total, setQuantity, clear } = useCart();
  if (lines.length === 0) return <p>购物车是空的</p>;
  return (
    <section aria-label="购物车">
      <ul>
        {lines.map(({ product, quantity }) => (
          <li key={product.id}>
            {product.name} × <output aria-label={`${product.name}的数量`}>{quantity}</output>{' '}
            <button type="button" aria-label={`减少${product.name}`} onClick={() => setQuantity(product.id, quantity - 1)}>
              −
            </button>
            <button type="button" aria-label={`增加${product.name}`} disabled={quantity >= MAX} onClick={() => setQuantity(product.id, quantity + 1)}>
              +
            </button>
            <button type="button" aria-label={`移除${product.name}`} onClick={() => setQuantity(product.id, 0)}>
              移除
            </button>
          </li>
        ))}
      </ul>
      <p>合计 {yuan(total)}</p>
      <button type="button" onClick={clear}>
        清空购物车
      </button>
    </section>
  );
}
```
:::

:::variant{kind=wrong name=no-limit fails=tests reason="加入购物车时没有限制最多 99 件"}
```tsx file=cart.tsx
import { createContext, useContext, useState, type ReactNode } from 'react';

export type Product = { id: string; name: string; price: number };
export type CartLine = { product: Product; quantity: number };
export type CartValue = {
  products: readonly Product[];
  lines: readonly CartLine[];
  count: number;
  total: number;
  add: (id: string) => void;
  setQuantity: (id: string, quantity: number) => void;
  clear: () => void;
};

const MAX = 99;

const CartContext = createContext<CartValue | null>(null);

export function CartProvider({ products, children }: { products: readonly Product[]; children: ReactNode }) {
  const [items, setItems] = useState<readonly { id: string; quantity: number }[]>([]);

  const lines = items.flatMap(({ id, quantity }) => {
    const product = products.find((p) => p.id === id);
    return product === undefined ? [] : [{ product, quantity }];
  });

  function setQuantity(id: string, quantity: number) {
    const next = Math.min(MAX, Math.trunc(quantity));
    setItems((current) => {
      if (next <= 0) return current.filter((item) => item.id !== id);
      if (current.some((item) => item.id === id)) return current.map((item) => (item.id === id ? { id, quantity: next } : item));
      return [...current, { id, quantity: next }];
    });
  }

  const value: CartValue = {
    products,
    lines,
    count: lines.reduce((sum, line) => sum + line.quantity, 0),
    total: lines.reduce((sum, line) => sum + line.product.price * line.quantity, 0),
    add: (id) =>
      setItems((current) => {
        const found = current.find((item) => item.id === id);
        if (found === undefined) return [...current, { id, quantity: 1 }];
        return current.map((item) => (item.id === id ? { id, quantity: item.quantity + 1 } : item));
      }),
    setQuantity,
    clear: () => setItems([]),
  };
  return <CartContext value={value}>{children}</CartContext>;
}

export function useCart(): CartValue {
  const value = useContext(CartContext);
  if (value === null) throw new Error('useCart 必须在 <CartProvider> 中使用');
  return value;
}

const yuan = (n: number) => `¥${n.toFixed(2)}`;

export function ProductList() {
  const { products, add } = useCart();
  return (
    <ul aria-label="商品">
      {products.map((p) => (
        <li key={p.id}>
          {p.name} {yuan(p.price)}{' '}
          <button type="button" aria-label={`把${p.name}加入购物车`} onClick={() => add(p.id)}>
            加入购物车
          </button>
        </li>
      ))}
    </ul>
  );
}

export function CartBadge() {
  const { count } = useCart();
  return <output aria-label="购物车中的商品数量">{count}</output>;
}

export function CartPanel() {
  const { lines, total, setQuantity, clear } = useCart();
  if (lines.length === 0) return <p>购物车是空的</p>;
  return (
    <section aria-label="购物车">
      <ul>
        {lines.map(({ product, quantity }) => (
          <li key={product.id}>
            {product.name} × <output aria-label={`${product.name}的数量`}>{quantity}</output>{' '}
            <button type="button" aria-label={`减少${product.name}`} onClick={() => setQuantity(product.id, quantity - 1)}>
              −
            </button>
            <button type="button" aria-label={`增加${product.name}`} disabled={quantity >= MAX} onClick={() => setQuantity(product.id, quantity + 1)}>
              +
            </button>
            <button type="button" aria-label={`移除${product.name}`} onClick={() => setQuantity(product.id, 0)}>
              移除
            </button>
          </li>
        ))}
      </ul>
      <p>合计 {yuan(total)}</p>
      <button type="button" onClick={clear}>
        清空购物车
      </button>
    </section>
  );
}
```
:::

:::variant{kind=wrong name=keep-zero fails=tests reason="数量减到 0 时没有移除"}
```tsx file=cart.tsx
import { createContext, useContext, useState, type ReactNode } from 'react';

export type Product = { id: string; name: string; price: number };
export type CartLine = { product: Product; quantity: number };
export type CartValue = {
  products: readonly Product[];
  lines: readonly CartLine[];
  count: number;
  total: number;
  add: (id: string) => void;
  setQuantity: (id: string, quantity: number) => void;
  clear: () => void;
};

const MAX = 99;

const CartContext = createContext<CartValue | null>(null);

export function CartProvider({ products, children }: { products: readonly Product[]; children: ReactNode }) {
  const [items, setItems] = useState<readonly { id: string; quantity: number }[]>([]);

  const lines = items.flatMap(({ id, quantity }) => {
    const product = products.find((p) => p.id === id);
    return product === undefined ? [] : [{ product, quantity }];
  });

  function setQuantity(id: string, quantity: number) {
    const next = Math.min(MAX, Math.trunc(quantity));
    setItems((current) => {
      if (current.some((item) => item.id === id)) return current.map((item) => (item.id === id ? { id, quantity: next } : item));
      return [...current, { id, quantity: next }];
    });
  }

  const value: CartValue = {
    products,
    lines,
    count: lines.reduce((sum, line) => sum + line.quantity, 0),
    total: lines.reduce((sum, line) => sum + line.product.price * line.quantity, 0),
    add: (id) =>
      setItems((current) => {
        const found = current.find((item) => item.id === id);
        if (found === undefined) return [...current, { id, quantity: 1 }];
        return current.map((item) => (item.id === id ? { id, quantity: Math.min(MAX, item.quantity + 1) } : item));
      }),
    setQuantity,
    clear: () => setItems([]),
  };
  return <CartContext value={value}>{children}</CartContext>;
}

export function useCart(): CartValue {
  const value = useContext(CartContext);
  if (value === null) throw new Error('useCart 必须在 <CartProvider> 中使用');
  return value;
}

const yuan = (n: number) => `¥${n.toFixed(2)}`;

export function ProductList() {
  const { products, add } = useCart();
  return (
    <ul aria-label="商品">
      {products.map((p) => (
        <li key={p.id}>
          {p.name} {yuan(p.price)}{' '}
          <button type="button" aria-label={`把${p.name}加入购物车`} onClick={() => add(p.id)}>
            加入购物车
          </button>
        </li>
      ))}
    </ul>
  );
}

export function CartBadge() {
  const { count } = useCart();
  return <output aria-label="购物车中的商品数量">{count}</output>;
}

export function CartPanel() {
  const { lines, total, setQuantity, clear } = useCart();
  if (lines.length === 0) return <p>购物车是空的</p>;
  return (
    <section aria-label="购物车">
      <ul>
        {lines.map(({ product, quantity }) => (
          <li key={product.id}>
            {product.name} × <output aria-label={`${product.name}的数量`}>{quantity}</output>{' '}
            <button type="button" aria-label={`减少${product.name}`} onClick={() => setQuantity(product.id, quantity - 1)}>
              −
            </button>
            <button type="button" aria-label={`增加${product.name}`} disabled={quantity >= MAX} onClick={() => setQuantity(product.id, quantity + 1)}>
              +
            </button>
            <button type="button" aria-label={`移除${product.name}`} onClick={() => setQuantity(product.id, 0)}>
              移除
            </button>
          </li>
        ))}
      </ul>
      <p>合计 {yuan(total)}</p>
      <button type="button" onClick={clear}>
        清空购物车
      </button>
    </section>
  );
}
```
:::

:::variant{kind=wrong name=silent-default fails=tests reason="在 Provider 之外返回一个空的购物车，而不是报错"}
```tsx file=cart.tsx
import { createContext, useContext, useState, type ReactNode } from 'react';

export type Product = { id: string; name: string; price: number };
export type CartLine = { product: Product; quantity: number };
export type CartValue = {
  products: readonly Product[];
  lines: readonly CartLine[];
  count: number;
  total: number;
  add: (id: string) => void;
  setQuantity: (id: string, quantity: number) => void;
  clear: () => void;
};

const MAX = 99;

const CartContext = createContext<CartValue | null>(null);

export function CartProvider({ products, children }: { products: readonly Product[]; children: ReactNode }) {
  const [items, setItems] = useState<readonly { id: string; quantity: number }[]>([]);

  const lines = items.flatMap(({ id, quantity }) => {
    const product = products.find((p) => p.id === id);
    return product === undefined ? [] : [{ product, quantity }];
  });

  function setQuantity(id: string, quantity: number) {
    const next = Math.min(MAX, Math.trunc(quantity));
    setItems((current) => {
      if (next <= 0) return current.filter((item) => item.id !== id);
      if (current.some((item) => item.id === id)) return current.map((item) => (item.id === id ? { id, quantity: next } : item));
      return [...current, { id, quantity: next }];
    });
  }

  const value: CartValue = {
    products,
    lines,
    count: lines.reduce((sum, line) => sum + line.quantity, 0),
    total: lines.reduce((sum, line) => sum + line.product.price * line.quantity, 0),
    add: (id) =>
      setItems((current) => {
        const found = current.find((item) => item.id === id);
        if (found === undefined) return [...current, { id, quantity: 1 }];
        return current.map((item) => (item.id === id ? { id, quantity: Math.min(MAX, item.quantity + 1) } : item));
      }),
    setQuantity,
    clear: () => setItems([]),
  };
  return <CartContext value={value}>{children}</CartContext>;
}

const EMPTY: CartValue = { products: [], lines: [], count: 0, total: 0, add: () => {}, setQuantity: () => {}, clear: () => {} };

export function useCart(): CartValue {
  return useContext(CartContext) ?? EMPTY;
}

const yuan = (n: number) => `¥${n.toFixed(2)}`;

export function ProductList() {
  const { products, add } = useCart();
  return (
    <ul aria-label="商品">
      {products.map((p) => (
        <li key={p.id}>
          {p.name} {yuan(p.price)}{' '}
          <button type="button" aria-label={`把${p.name}加入购物车`} onClick={() => add(p.id)}>
            加入购物车
          </button>
        </li>
      ))}
    </ul>
  );
}

export function CartBadge() {
  const { count } = useCart();
  return <output aria-label="购物车中的商品数量">{count}</output>;
}

export function CartPanel() {
  const { lines, total, setQuantity, clear } = useCart();
  if (lines.length === 0) return <p>购物车是空的</p>;
  return (
    <section aria-label="购物车">
      <ul>
        {lines.map(({ product, quantity }) => (
          <li key={product.id}>
            {product.name} × <output aria-label={`${product.name}的数量`}>{quantity}</output>{' '}
            <button type="button" aria-label={`减少${product.name}`} onClick={() => setQuantity(product.id, quantity - 1)}>
              −
            </button>
            <button type="button" aria-label={`增加${product.name}`} disabled={quantity >= MAX} onClick={() => setQuantity(product.id, quantity + 1)}>
              +
            </button>
            <button type="button" aria-label={`移除${product.name}`} onClick={() => setQuantity(product.id, 0)}>
              移除
            </button>
          </li>
        ))}
      </ul>
      <p>合计 {yuan(total)}</p>
      <button type="button" onClick={clear}>
        清空购物车
      </button>
    </section>
  );
}
```
:::
