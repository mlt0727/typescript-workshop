---
kind: challenge
title: 用模块扩充给事件总线加上事件
---
`bus.ts`（只读）是一个通用的事件总线：`AppEvents` 是一个空的接口，`on(type, handler)` 和 `emit(type, payload)` 的事件名和数据类型都来自它。每个功能模块用**模块扩充**（`declare module './bus' { interface AppEvents { … } }`）把自己的事件加进去。

1. **`cart.ts`**：加上 `'cart:add'`（数据 `{ sku: string; quantity: number }`）和 `'cart:clear'`（数据是 `undefined`）两个事件。`addToCart(sku, quantity = 1)` 在 `quantity` 不是正整数时抛出 `RangeError`（不发出事件），否则发出 `'cart:add'`；`clearCart()` 发出 `'cart:clear'`；
2. **`toast.ts`**：加上 `'toast:show'`（数据 `{ message: string; tone: Tone }`）。`showToast(message, tone = 'info')` 发出这个事件；`connectCartToasts()` 监听购物车的两个事件，分别显示 `已加入购物车：sku × quantity` 和 `购物车已清空`（语气都是 `info`），返回一个函数，调用之后两个监听都被取消；
3. 扩充之后，`AppEvents` 中正好有这三个事件，`emit`、`on` 的参数都有准确的类型（见类型测试）。

起始代码中的函数已经写好了一部分，但还没有扩充 `AppEvents`，所以 `emit('cart:add', …)` 报错：`keyof AppEvents` 还是 `never`。不能使用类型断言。

:::files{role=support}
```ts file=bus.ts readonly
/** 每个模块通过模块扩充，在这里加上自己的事件：事件名 → 数据的类型 */
export interface AppEvents {}

type Handler = (payload: unknown) => void;
const handlers = new Map<PropertyKey, Set<Handler>>();

export function on<K extends keyof AppEvents>(type: K, handler: (payload: AppEvents[K]) => void): () => void {
  const set = handlers.get(type) ?? new Set<Handler>();
  handlers.set(type, set);
  // 运行时的 payload 就是 emit 时传入的那个值；这里只是把类型“交还”给处理函数
  const wrapped: Handler = (payload) => handler(payload as AppEvents[K]);
  set.add(wrapped);
  return () => {
    set.delete(wrapped);
  };
}

export function emit<K extends keyof AppEvents>(type: K, payload: AppEvents[K]): void {
  for (const handler of [...(handlers.get(type) ?? [])]) handler(payload);
}
```
:::

:::files{role=starter}
```ts file=cart.ts
import { emit } from './bus';

export function addToCart(sku: string, quantity = 1): void {
  emit('cart:add', { sku, quantity });
}

export function clearCart(): void {
  emit('cart:clear', undefined);
}
```
```ts file=toast.ts
import { emit, on } from './bus';

export type Tone = 'info' | 'error';

export function showToast(message: string, tone: Tone = 'info'): void {
  emit('toast:show', { message, tone });
}

export function connectCartToasts(): () => void {
  return () => {};
}
```
```ts file=main.ts
import { on } from './bus';
import { addToCart, clearCart } from './cart';
import { connectCartToasts } from './toast';

on('toast:show', ({ message, tone }) => console.log(`[${tone}] ${message}`));
const disconnect = connectCartToasts();
addToCart('钢笔', 2);
clearCart();
disconnect();
addToCart('橡皮');
```
:::

:::files{role=solution}
```ts file=cart.ts
import { emit } from './bus';

declare module './bus' {
  interface AppEvents {
    'cart:add': { sku: string; quantity: number };
    'cart:clear': undefined;
  }
}

export function addToCart(sku: string, quantity = 1): void {
  if (!Number.isInteger(quantity) || quantity < 1) throw new RangeError(`数量必须是正整数：${quantity}`);
  emit('cart:add', { sku, quantity });
}

export function clearCart(): void {
  emit('cart:clear', undefined);
}
```
```ts file=toast.ts
import { emit, on } from './bus';

export type Tone = 'info' | 'error';

declare module './bus' {
  interface AppEvents {
    'toast:show': { message: string; tone: Tone };
  }
}

export function showToast(message: string, tone: Tone = 'info'): void {
  emit('toast:show', { message, tone });
}

/** 购物车的事件转换成提示；返回断开连接的函数 */
export function connectCartToasts(): () => void {
  const offAdd = on('cart:add', ({ sku, quantity }) => showToast(`已加入购物车：${sku} × ${quantity}`));
  const offClear = on('cart:clear', () => showToast('购物车已清空'));
  return () => {
    offAdd();
    offClear();
  };
}
```
```ts file=main.ts
import { on } from './bus';
import { addToCart, clearCart } from './cart';
import { connectCartToasts } from './toast';

on('toast:show', ({ message, tone }) => console.log(`[${tone}] ${message}`));
const disconnect = connectCartToasts();
addToCart('钢笔', 2);
clearCart();
disconnect();
addToCart('橡皮');
```
:::

:::files{role=tests}
```ts file=events.test.ts
import { describe, expect, test, vi } from 'vitest';
import { on } from './bus';
import { addToCart, clearCart } from './cart';
import { connectCartToasts, showToast } from './toast';

describe('cart', () => {
  test('addToCart 发出 cart:add，数量默认为 1', () => {
    const handler = vi.fn();
    const off = on('cart:add', handler);
    addToCart('pen', 2);
    addToCart('eraser');
    off();
    expect(handler.mock.calls).toEqual([[{ sku: 'pen', quantity: 2 }], [{ sku: 'eraser', quantity: 1 }]]);
  });

  test('数量不是正整数时抛出 RangeError，不发出事件', () => {
    const handler = vi.fn();
    const off = on('cart:add', handler);
    for (const quantity of [0, -1, 1.5, Number.NaN]) expect(() => addToCart('pen', quantity), String(quantity)).toThrow(RangeError);
    off();
    expect(handler).not.toHaveBeenCalled();
  });

  test('clearCart 发出 cart:clear', () => {
    const handler = vi.fn();
    const off = on('cart:clear', handler);
    clearCart();
    off();
    expect(handler).toHaveBeenCalledTimes(1);
  });
});

describe('toast', () => {
  test('showToast 的语气默认为 info', () => {
    const handler = vi.fn();
    const off = on('toast:show', handler);
    showToast('已保存');
    showToast('保存失败', 'error');
    off();
    expect(handler.mock.calls).toEqual([[{ message: '已保存', tone: 'info' }], [{ message: '保存失败', tone: 'error' }]]);
  });

  test('connectCartToasts 把购物车的事件转换成提示，断开之后不再提示', () => {
    const messages: string[] = [];
    const off = on('toast:show', ({ message }) => messages.push(message));
    const disconnect = connectCartToasts();
    addToCart('pen', 2);
    clearCart();
    disconnect();
    addToCart('eraser');
    clearCart();
    off();
    expect(messages).toEqual(['已加入购物车：pen × 2', '购物车已清空']);
  });
});
```
```ts file=events.test-d.ts
import { expectTypeOf } from 'vitest';
import { emit, on, type AppEvents } from './bus';

// 两个模块扩充之后，AppEvents 中正好有这三个事件
expectTypeOf<keyof AppEvents>().toEqualTypeOf<'cart:add' | 'cart:clear' | 'toast:show'>();

emit('cart:add', { sku: 'pen', quantity: 1 });
emit('cart:clear', undefined);
on('toast:show', (payload) => {
  expectTypeOf(payload).toEqualTypeOf<{ message: string; tone: 'info' | 'error' }>();
});

// @ts-expect-error 缺少 quantity
emit('cart:add', { sku: 'pen' });
// @ts-expect-error 不存在的事件
emit('cart:remove', { sku: 'pen' });
// @ts-expect-error tone 只能是 info 或 error
emit('toast:show', { message: '注意', tone: 'warning' });
```
:::

:::hint{level=1}
在 `cart.ts` 中（它已经是一个模块：有 `import`）写 `declare module './bus' { interface AppEvents { 'cart:add': …; 'cart:clear': undefined } }`，路径要和 `import` 时写的一样。`toast.ts` 中同样写一段，加上 `'toast:show'`。两段扩充会和 `bus.ts` 中的空接口合并成一个。
:::

:::hint{level=2}
`connectCartToasts` 中调用两次 `on`，保存它们返回的取消函数，最后返回一个依次调用这两个函数的函数。`on('cart:add', ({ sku, quantity }) => …)` 的参数可以直接解构：扩充之后它的类型就是 `{ sku: string; quantity: number }`。检查数量用 `Number.isInteger(quantity) && quantity >= 1`。
:::

:::explanation
模块扩充让“谁定义事件”和“谁使用事件”分开：`bus.ts` 不需要知道任何具体的事件，每个功能模块在自己的文件中声明自己的事件，类型检查时它们合并成同一个 `AppEvents`。新增一个功能，不需要修改总线的代码。

三种写法的区别：

- `declare module './bus' { interface AppEvents { … } }`：扩充 `./bus` 这个模块导出的 `AppEvents`，正是想要的；
- `declare global { interface AppEvents { … } }`：扩充的是**全局**作用域，得到的是另一个与 `bus.ts` 无关的 `AppEvents`；
- 在模块中直接写 `export interface AppEvents { … }`：这只是 `cart.ts` 自己的一个同名接口，与 `bus.ts` 的那个毫无关系。

扩充只影响类型，运行时什么也没有：`declare module` 整段都会被去掉。所以 `bus.ts` 中的 `Map` 用的是 `PropertyKey` 和 `unknown`，类型与事件的对应关系完全由 `on`、`emit` 的签名保证。`bus.ts` 中那一处 `payload as AppEvents[K]` 是 c10 讲过的“关在一个函数中”的断言：运行时传给处理函数的正是 `emit` 时的那个值，签名已经保证了它的类型。

这和 Vue、Pinia、Express 等类库的做法相同：类库提供一个空的（或部分的）接口，使用者通过模块扩充加上自己的属性。
:::

:::variant{kind=alt name=extends-alias}
```ts file=cart.ts
import { emit } from './bus';

type CartEvents = {
  'cart:add': { sku: string; quantity: number };
  'cart:clear': undefined;
};

declare module './bus' {
  interface AppEvents extends CartEvents {}
}

export function addToCart(sku: string, quantity = 1): void {
  if (quantity % 1 !== 0 || !(quantity >= 1)) throw new RangeError('数量无效');
  emit('cart:add', { sku, quantity });
}

export function clearCart(): void {
  emit('cart:clear', undefined);
}
```
```ts file=toast.ts
import { emit, on } from './bus';

export type Tone = 'info' | 'error';

declare module './bus' {
  interface AppEvents {
    'toast:show': { message: string; tone: Tone };
  }
}

export function showToast(message: string, tone: Tone = 'info'): void {
  emit('toast:show', { message, tone });
}

export function connectCartToasts(): () => void {
  const subscriptions = [
    on('cart:add', (item) => showToast(`已加入购物车：${item.sku} × ${item.quantity}`)),
    on('cart:clear', () => showToast('购物车已清空')),
  ];
  return () => subscriptions.forEach((off) => off());
}
```
:::

:::variant{kind=wrong name=declare-global fails=types reason="写成了 declare global：扩充的是一个新的全局接口 AppEvents，bus.ts 导出的那个接口没有变化"}
```ts file=cart.ts
import { emit } from './bus';

declare global {
  interface AppEvents {
    'cart:add': { sku: string; quantity: number };
    'cart:clear': undefined;
  }
}

export function addToCart(sku: string, quantity = 1): void {
  if (!Number.isInteger(quantity) || quantity < 1) throw new RangeError(`数量必须是正整数：${quantity}`);
  emit('cart:add', { sku, quantity });
}

export function clearCart(): void {
  emit('cart:clear', undefined);
}
```
```ts file=toast.ts
import { emit, on } from './bus';

export type Tone = 'info' | 'error';

declare global {
  interface AppEvents {
    'toast:show': { message: string; tone: Tone };
  }
}

export function showToast(message: string, tone: Tone = 'info'): void {
  emit('toast:show', { message, tone });
}

/** 购物车的事件转换成提示；返回断开连接的函数 */
export function connectCartToasts(): () => void {
  const offAdd = on('cart:add', ({ sku, quantity }) => showToast(`已加入购物车：${sku} × ${quantity}`));
  const offClear = on('cart:clear', () => showToast('购物车已清空'));
  return () => {
    offAdd();
    offClear();
  };
}
```
:::

:::variant{kind=wrong name=local-interface fails=types reason="在 cart.ts 中写了一个同名的接口：模块中的接口是局部的，不会和 bus.ts 中的合并"}
```ts file=cart.ts
import { emit } from './bus';

export interface AppEvents {
  'cart:add': { sku: string; quantity: number };
  'cart:clear': undefined;
}

export function addToCart(sku: string, quantity = 1): void {
  if (!Number.isInteger(quantity) || quantity < 1) throw new RangeError(`数量必须是正整数：${quantity}`);
  emit('cart:add', { sku, quantity });
}

export function clearCart(): void {
  emit('cart:clear', undefined);
}
```
```ts file=toast.ts
import { emit, on } from './bus';

export type Tone = 'info' | 'error';

declare module './bus' {
  interface AppEvents {
    'toast:show': { message: string; tone: Tone };
  }
}

export function showToast(message: string, tone: Tone = 'info'): void {
  emit('toast:show', { message, tone });
}

/** 购物车的事件转换成提示；返回断开连接的函数 */
export function connectCartToasts(): () => void {
  const offAdd = on('cart:add', ({ sku, quantity }) => showToast(`已加入购物车：${sku} × ${quantity}`));
  const offClear = on('cart:clear', () => showToast('购物车已清空'));
  return () => {
    offAdd();
    offClear();
  };
}
```
:::

:::variant{kind=wrong name=no-validation fails=tests reason="没有检查数量：0、负数、小数都发出了事件"}
```ts file=cart.ts
import { emit } from './bus';

declare module './bus' {
  interface AppEvents {
    'cart:add': { sku: string; quantity: number };
    'cart:clear': undefined;
  }
}

export function addToCart(sku: string, quantity = 1): void {
  emit('cart:add', { sku, quantity });
}

export function clearCart(): void {
  emit('cart:clear', undefined);
}
```
```ts file=toast.ts
import { emit, on } from './bus';

export type Tone = 'info' | 'error';

declare module './bus' {
  interface AppEvents {
    'toast:show': { message: string; tone: Tone };
  }
}

export function showToast(message: string, tone: Tone = 'info'): void {
  emit('toast:show', { message, tone });
}

/** 购物车的事件转换成提示；返回断开连接的函数 */
export function connectCartToasts(): () => void {
  const offAdd = on('cart:add', ({ sku, quantity }) => showToast(`已加入购物车：${sku} × ${quantity}`));
  const offClear = on('cart:clear', () => showToast('购物车已清空'));
  return () => {
    offAdd();
    offClear();
  };
}
```
:::

:::variant{kind=wrong name=never-disconnects fails=tests reason="返回的函数只取消了一个监听：断开之后清空购物车仍然有提示"}
```ts file=cart.ts
import { emit } from './bus';

declare module './bus' {
  interface AppEvents {
    'cart:add': { sku: string; quantity: number };
    'cart:clear': undefined;
  }
}

export function addToCart(sku: string, quantity = 1): void {
  if (!Number.isInteger(quantity) || quantity < 1) throw new RangeError(`数量必须是正整数：${quantity}`);
  emit('cart:add', { sku, quantity });
}

export function clearCart(): void {
  emit('cart:clear', undefined);
}
```
```ts file=toast.ts
import { emit, on } from './bus';

export type Tone = 'info' | 'error';

declare module './bus' {
  interface AppEvents {
    'toast:show': { message: string; tone: Tone };
  }
}

export function showToast(message: string, tone: Tone = 'info'): void {
  emit('toast:show', { message, tone });
}

/** 购物车的事件转换成提示；返回断开连接的函数 */
export function connectCartToasts(): () => void {
  const offAdd = on('cart:add', ({ sku, quantity }) => showToast(`已加入购物车：${sku} × ${quantity}`));
  const offClear = on('cart:clear', () => showToast('购物车已清空'));
  void offClear;
  return () => {
    offAdd();
  };
}
```
:::
