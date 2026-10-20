---
kind: challenge
title: 通用的事件委托函数
---
每次写事件委托都要重复“收窄 target、`closest`、`contains`”这几步。把它封装成一个通用的函数：

```ts
const stop = delegate(list, 'click', 'button[data-action]', (event, button) => {
  // event 是 PointerEvent，button 是匹配选择器的那个元素
});
stop(); // 移除监听器
```

实现 `delegate(root, type, selector, handler)`：

1. 在 `root` 上监听 `type` 事件；
2. 事件发生时，从 `event.target` 开始向上找第一个匹配 `selector` 的元素。只有找到、并且它在 `root` **内部**（不是 `root` 本身，也不在 `root` 外面）时，才调用 `handler(event, 匹配的元素)`；
3. `handler` 的第一个参数是这种事件对应的类型：`'click'` 是 `PointerEvent`，`'keydown'` 是 `KeyboardEvent`，`'focusin'` 是 `FocusEvent`（提示：`HTMLElementEventMap[K]`，b15 的索引访问类型）；
4. 返回一个函数，调用它会移除这个监听器。

:::files{role=support}
```html file=index.html readonly
<!doctype html>
<html lang="zh-CN">
  <body>
    <section class="panel" id="outer-panel">
      <ul id="list">
        <li><button type="button" data-id="a"><span class="icon">★</span> 甲</button></li>
        <li><button type="button" data-id="b">乙</button></li>
        <li>没有按钮的一项</li>
      </ul>
    </section>
    <form id="form">
      <label>姓名 <input name="name" /></label>
      <label>邮箱 <input name="email" /></label>
    </form>
  </body>
</html>
```
:::

:::files{role=starter}
```ts file=delegate.ts
export function delegate<K extends keyof HTMLElementEventMap>(
  root: HTMLElement,
  type: K,
  selector: string,
  handler: (event: HTMLElementEventMap[K], matched: Element) => void,
): () => void {
  // 在这里实现
  return () => {};
}
```
:::

:::files{role=solution}
```ts file=delegate.ts
export function delegate<K extends keyof HTMLElementEventMap>(
  root: HTMLElement,
  type: K,
  selector: string,
  handler: (event: HTMLElementEventMap[K], matched: Element) => void,
): () => void {
  const controller = new AbortController();
  root.addEventListener(
    type,
    (event) => {
      if (!(event.target instanceof Element)) return;
      const matched = event.target.closest(selector);
      if (matched === null || matched === root || !root.contains(matched)) return;
      handler(event, matched);
    },
    { signal: controller.signal },
  );
  return () => controller.abort();
}
```
:::

:::files{role=tests}
```ts file=delegate.test.ts
import { expect, test, vi } from 'vitest';
import { screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { delegate } from './delegate';

function el(selector: string): HTMLElement {
  const found = document.querySelector(selector);
  if (!(found instanceof HTMLElement)) throw new Error(`缺少 ${selector}`);
  return found;
}

test('点击匹配的元素（包括它里面的子元素）时调用 handler', async () => {
  const user = userEvent.setup();
  const seen: (string | undefined)[] = [];
  delegate(el('#list'), 'click', 'button', (_event, button) => {
    seen.push(button instanceof HTMLElement ? button.dataset.id : '不是 HTMLElement');
  });
  await user.click(screen.getByRole('button', { name: '★ 甲' }));
  await user.click(el('.icon'));
  await user.click(screen.getByRole('button', { name: '乙' }));
  expect(seen).toEqual(['a', 'a', 'b']);
});

test('点击不匹配的地方不调用 handler', async () => {
  const user = userEvent.setup();
  const handler = vi.fn();
  delegate(el('#list'), 'click', 'button', handler);
  await user.click(screen.getByText('没有按钮的一项'));
  expect(handler).not.toHaveBeenCalled();
});

test('匹配的元素在 root 外面或者就是 root 时，不调用 handler', async () => {
  const user = userEvent.setup();
  const outside = vi.fn();
  delegate(el('#list'), 'click', '.panel', outside);
  await user.click(screen.getByText('没有按钮的一项'));
  expect(outside).not.toHaveBeenCalled();
  const self = vi.fn();
  delegate(el('#list'), 'click', 'ul', self);
  await user.click(screen.getByText('没有按钮的一项'));
  expect(self).not.toHaveBeenCalled();
});

test('之后动态添加的元素同样生效', async () => {
  const user = userEvent.setup();
  const handler = vi.fn();
  delegate(el('#list'), 'click', 'button', handler);
  const li = document.createElement('li');
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = '丙';
  li.append(button);
  el('#list').append(li);
  await user.click(button);
  expect(handler).toHaveBeenCalledTimes(1);
});

test('返回的函数移除监听器', async () => {
  const user = userEvent.setup();
  const handler = vi.fn();
  const stop = delegate(el('#list'), 'click', 'button', handler);
  await user.click(screen.getByRole('button', { name: '乙' }));
  stop();
  await user.click(screen.getByRole('button', { name: '乙' }));
  expect(handler).toHaveBeenCalledTimes(1);
});

test('配合 focusin 委托焦点事件', async () => {
  const user = userEvent.setup();
  const names: (string | null)[] = [];
  delegate(el('#form'), 'focusin', 'input', (_event, input) => names.push(input.getAttribute('name')));
  await user.click(screen.getByLabelText('姓名'));
  await user.tab();
  expect(names).toEqual(['name', 'email']);
});
```
```ts file=delegate.test-d.ts
import { expectTypeOf } from 'vitest';
import { delegate } from './delegate';

declare const root: HTMLElement;

delegate(root, 'click', 'button', (event, matched) => {
  expectTypeOf(event).toEqualTypeOf<PointerEvent>();
  expectTypeOf(matched).toEqualTypeOf<Element>();
});
delegate(root, 'keydown', 'input', (event) => {
  expectTypeOf(event).toEqualTypeOf<KeyboardEvent>();
});
expectTypeOf(delegate(root, 'focusin', 'input', () => {})).toEqualTypeOf<() => void>();

// @ts-expect-error 不存在的事件名
delegate(root, 'clik', 'button', () => {});
```
:::

:::hint{level=1}
`root.addEventListener(type, (event) => { … })`：因为 `type` 的类型是 `K`，TypeScript 推断出 `event` 的类型就是 `HTMLElementEventMap[K]`，可以直接传给 `handler`。监听器里按事件委托的三步检查：收窄 `event.target`、`closest(selector)`、确认在 `root` 内部。
:::

:::hint{level=2}
“在 `root` 内部”：`matched !== root && root.contains(matched)`（`contains` 对元素自身也返回 `true`，所以要单独排除 `root`）。移除监听器最简单的方式是创建一个 `AbortController`，把 `signal` 传给 `addEventListener`，返回 `() => controller.abort()`（d07）。
:::

:::explanation
类型部分：`K extends keyof HTMLElementEventMap` 把 `type` 限制为已知的事件名（拼错的事件名在编译期就会报错），`HTMLElementEventMap[K]` 根据事件名查出事件对象的类型——和 b15 的 `T[K]` 完全一样。`addEventListener` 本身也是这样声明的，所以监听器里的 `event` 自动就是正确的类型。

运行时部分是事件委托的三步：`event.target` 收窄成 `Element`；`closest` 从目标向上找匹配的元素（目标本身也算）；排除 `root` 自己和 `root` 外面的元素。第三步容易被忽略：`closest` 会一直找到文档的根，测试中的 `.panel` 是 `#list` 的祖先，点击列表内部时 `closest('.panel')` 会找到它。

`focus` 事件不冒泡，所以委托焦点事件要用 `focusin`。返回“取消函数”是一种常见的设计：调用方不需要知道内部用的是 `AbortController` 还是 `removeEventListener`。
:::

:::variant{kind=alt name=remove-event-listener}
```ts file=delegate.ts
export function delegate<K extends keyof HTMLElementEventMap>(
  root: HTMLElement,
  type: K,
  selector: string,
  handler: (event: HTMLElementEventMap[K], matched: Element) => void,
): () => void {
  function listener(event: HTMLElementEventMap[K]): void {
    const { target } = event;
    if (!(target instanceof Element)) return;
    for (let el: Element | null = target; el !== null && el !== root; el = el.parentElement) {
      if (el.matches(selector)) {
        handler(event, el);
        return;
      }
    }
  }
  root.addEventListener(type, listener);
  return () => root.removeEventListener(type, listener);
}
```
:::

:::variant{kind=wrong name=no-contains-check fails=tests reason="没有检查匹配的元素是否在 root 内部"}
```ts file=delegate.ts
export function delegate<K extends keyof HTMLElementEventMap>(
  root: HTMLElement,
  type: K,
  selector: string,
  handler: (event: HTMLElementEventMap[K], matched: Element) => void,
): () => void {
  const controller = new AbortController();
  root.addEventListener(
    type,
    (event) => {
      if (!(event.target instanceof Element)) return;
      const matched = event.target.closest(selector);
      if (matched !== null) handler(event, matched);
    },
    { signal: controller.signal },
  );
  return () => controller.abort();
}
```
:::

:::variant{kind=wrong name=matches-target-only fails=tests reason="只检查 event.target 本身是否匹配，点中子元素时不生效"}
```ts file=delegate.ts
export function delegate<K extends keyof HTMLElementEventMap>(
  root: HTMLElement,
  type: K,
  selector: string,
  handler: (event: HTMLElementEventMap[K], matched: Element) => void,
): () => void {
  const controller = new AbortController();
  root.addEventListener(
    type,
    (event) => {
      const { target } = event;
      if (target instanceof Element && target !== root && target.matches(selector)) handler(event, target);
    },
    { signal: controller.signal },
  );
  return () => controller.abort();
}
```
:::

:::variant{kind=wrong name=new-function-on-remove fails=tests reason="移除时传入了一个新的箭头函数，原来的监听器没有被移除"}
```ts file=delegate.ts
export function delegate<K extends keyof HTMLElementEventMap>(
  root: HTMLElement,
  type: K,
  selector: string,
  handler: (event: HTMLElementEventMap[K], matched: Element) => void,
): () => void {
  root.addEventListener(type, (event) => {
    if (!(event.target instanceof Element)) return;
    const matched = event.target.closest(selector);
    if (matched !== null && matched !== root && root.contains(matched)) handler(event, matched);
  });
  return () =>
    root.removeEventListener(type, (event) => {
      if (event.target instanceof Element) handler(event, event.target);
    });
}
```
:::

:::variant{kind=wrong name=string-event-type fails=types reason="事件名用了 string，事件对象只能是 Event，拼错的事件名也不会报错"}
```ts file=delegate.ts
export function delegate(
  root: HTMLElement,
  type: string,
  selector: string,
  handler: (event: Event, matched: Element) => void,
): () => void {
  const controller = new AbortController();
  root.addEventListener(
    type,
    (event) => {
      if (!(event.target instanceof Element)) return;
      const matched = event.target.closest(selector);
      if (matched === null || matched === root || !root.contains(matched)) return;
      handler(event, matched);
    },
    { signal: controller.signal },
  );
  return () => controller.abort();
}
```
:::
