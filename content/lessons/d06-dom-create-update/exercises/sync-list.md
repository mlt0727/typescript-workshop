---
kind: challenge
title: 复用节点的列表更新
---
购物清单的每一项后面有一个备注输入框，用户可能正在里面打字。每次数据变化都清空重建整个列表，用户输入的备注就会丢失。

在 `sync.ts` 中实现 `syncList(list, items)`，把列表更新成和 `items` 一致，同时尽量**复用**已有的元素：

1. 每一项的结构是：

   ```html
   <li data-id="id"><span class="label">名称</span> <input class="note" aria-label="名称的备注" /></li>
   ```

2. `items` 中的 `id` 已经有对应的 `<li>`（按 `data-id` 判断）时，**复用这个元素**：只更新名称（以及输入框的 `aria-label`），不要重新创建，输入框中用户填写的内容因此得以保留；
3. 新的 `id` 创建新的 `<li>`；`items` 中已经没有的 `id`，把对应的 `<li>` 从页面上删除；
4. 更新之后，列表中 `<li>` 的顺序与 `items` 一致；
5. 只移动**位置不对**的元素。把一个元素从页面上移走再插回来，它里面的输入框会失去焦点，用户正在打字时就会被打断。

`items` 中的 `id` 互不相同。可以假设列表中只有由 `syncList` 创建的 `<li>`。

:::files{role=support}
```html file=index.html readonly
<!doctype html>
<html lang="zh-CN">
  <body>
    <h1>购物清单</h1>
    <ul id="list"></ul>
  </body>
</html>
```
:::

:::files{role=starter}
```ts file=sync.ts
export type Item = { id: string; label: string };

export function syncList(list: HTMLUListElement, items: readonly Item[]): void {
  list.replaceChildren();
  for (const item of items) {
    const li = document.createElement('li');
    li.dataset.id = item.id;
    const label = document.createElement('span');
    label.className = 'label';
    label.textContent = item.label;
    const note = document.createElement('input');
    note.className = 'note';
    note.setAttribute('aria-label', `${item.label}的备注`);
    li.append(label, ' ', note);
    list.append(li);
  }
}
```
:::

:::files{role=solution}
```ts file=sync.ts
export type Item = { id: string; label: string };

function createRow(id: string): HTMLLIElement {
  const li = document.createElement('li');
  li.dataset.id = id;
  const label = document.createElement('span');
  label.className = 'label';
  const note = document.createElement('input');
  note.className = 'note';
  li.append(label, ' ', note);
  return li;
}

function updateRow(li: HTMLLIElement, item: Item): void {
  const label = li.querySelector('.label');
  const note = li.querySelector('.note');
  if (label) label.textContent = item.label;
  note?.setAttribute('aria-label', `${item.label}的备注`);
}

export function syncList(list: HTMLUListElement, items: readonly Item[]): void {
  const existing = new Map<string, HTMLLIElement>();
  for (const li of list.querySelectorAll('li')) {
    const id = li.dataset.id;
    if (id !== undefined) existing.set(id, li);
  }

  // 先删除不再需要的项
  const wanted = new Set(items.map((item) => item.id));
  for (const [id, li] of existing) {
    if (!wanted.has(id)) li.remove();
  }

  // 再按顺序放好每一项：只移动位置不对的元素，正在输入的输入框不会失去焦点
  items.forEach((item, index) => {
    const li = existing.get(item.id) ?? createRow(item.id);
    updateRow(li, item);
    const current = list.children.item(index);
    if (current !== li) list.insertBefore(li, current);
  });
}
```
:::

:::files{role=tests}
```ts file=sync.test.ts
import { beforeEach, expect, test } from 'vitest';
import { within } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { syncList } from './sync';

let list: HTMLUListElement;

beforeEach(() => {
  const el = document.querySelector('#list');
  if (!(el instanceof HTMLUListElement)) throw new Error('缺少 #list');
  list = el;
});

function rows(): HTMLLIElement[] {
  return [...list.querySelectorAll('li')];
}

function byId(): Map<string | undefined, HTMLLIElement> {
  return new Map(rows().map((li) => [li.dataset.id, li]));
}

test('第一次渲染：结构、顺序与 data-id', () => {
  syncList(list, [
    { id: 'm', label: '牛奶' },
    { id: 'b', label: '面包' },
  ]);
  expect(rows().map((li) => li.dataset.id)).toEqual(['m', 'b']);
  expect(within(list).getByRole('textbox', { name: '牛奶的备注' })).toHaveClass('note');
  expect(list.querySelector('[data-id="b"] .label')).toHaveTextContent('面包');
});

test('复用已有的元素：保留用户输入的备注', async () => {
  const user = userEvent.setup();
  syncList(list, [
    { id: 'm', label: '牛奶' },
    { id: 'b', label: '面包' },
  ]);
  const before = byId();
  await user.type(within(list).getByRole('textbox', { name: '面包的备注' }), '要全麦的');

  syncList(list, [
    { id: 'b', label: '面包' },
    { id: 'm', label: '牛奶' },
  ]);
  const after = byId();
  expect(after.get('b')).toBe(before.get('b'));
  expect(after.get('m')).toBe(before.get('m'));
  expect(within(list).getByRole('textbox', { name: '面包的备注' })).toHaveValue('要全麦的');
});

test('新增、删除、重新排序', () => {
  syncList(list, [
    { id: 'a', label: '苹果' },
    { id: 'b', label: '面包' },
    { id: 'c', label: '奶酪' },
  ]);
  const before = byId();
  syncList(list, [
    { id: 'c', label: '奶酪' },
    { id: 'd', label: '鸡蛋' },
    { id: 'a', label: '苹果' },
  ]);
  expect(rows().map((li) => li.dataset.id)).toEqual(['c', 'd', 'a']);
  expect(byId().get('a')).toBe(before.get('a'));
  expect(byId().get('c')).toBe(before.get('c'));
  expect(before.get('b')?.isConnected).toBe(false);
  expect(list.querySelector('[data-id="d"] .label')).toHaveTextContent('鸡蛋');
});

test('名称变化时更新文字和 aria-label，元素仍然复用', () => {
  syncList(list, [{ id: 'm', label: '牛奶' }]);
  const before = byId().get('m');
  syncList(list, [{ id: 'm', label: '燕麦奶' }]);
  expect(byId().get('m')).toBe(before);
  expect(list.querySelector('[data-id="m"] .label')).toHaveTextContent('燕麦奶');
  expect(within(list).getByRole('textbox', { name: '燕麦奶的备注' })).toBeInTheDocument();
});

test('只在必要时移动元素：正在输入的输入框保持焦点', async () => {
  const user = userEvent.setup();
  syncList(list, [
    { id: 'm', label: '牛奶' },
    { id: 'b', label: '面包' },
  ]);
  const note = within(list).getByRole('textbox', { name: '面包的备注' });
  await user.type(note, '全麦');
  expect(note).toHaveFocus();
  syncList(list, [
    { id: 'm', label: '牛奶' },
    { id: 'b', label: '面包' },
    { id: 'e', label: '鸡蛋' },
  ]);
  expect(note).toHaveFocus();
  syncList(list, [
    { id: 'm', label: '燕麦奶' },
    { id: 'b', label: '面包' },
  ]);
  expect(note).toHaveFocus();
  expect(note).toHaveValue('全麦');
});

test('更新为空数组时清空列表', () => {
  syncList(list, [{ id: 'm', label: '牛奶' }]);
  syncList(list, []);
  expect(rows()).toHaveLength(0);
});
```
:::

:::hint{level=1}
先遍历列表中已有的 `<li>`，用 `Map` 记下“id → 元素”。然后对 `items` 中的每一项：Map 里有就复用，没有就新建；更新它的名称。这样得到一个按新顺序排列的元素数组。
:::

:::hint{level=2}
先删除不再需要的元素。然后按 `items` 的顺序逐个检查第 `index` 个位置：`list.children.item(index)` 已经是这个元素，就什么都不做；不是，就用 `list.insertBefore(li, 那个位置上的元素)` 把它放过来（新元素同样这样插入）。不要用 `replaceChildren(...全部元素)` 一次性重排：它会把每个元素都移走再插回来，焦点就丢了。`li.dataset.id` 的类型是 `string | undefined`，放进 Map 之前检查一下。
:::

:::explanation
这道题实现了一个最简单的“按 key 复用”的列表更新，React 等框架里的 `key` 做的就是这件事（G 阶段）：

1. 用 `Map` 按 `data-id` 索引已有的元素，删除不再需要的；
2. 按新数据的顺序，为每一项取出已有的元素或者创建新元素，并更新会变化的部分（名称和 `aria-label`）；
3. 只把位置不对的元素用 `insertBefore` 放到正确的位置。

元素被复用时，它的状态也跟着保留：输入框中的值是 `input.value` 这个 DOM 属性，只要元素对象还是同一个，它就还在。起始代码每次都 `replaceChildren()` 清空再新建，测试中用户刚输入的“要全麦的”就丢了。

焦点更脆弱一些：浏览器会让一个被移出页面的元素失去焦点，哪怕它马上又被插了回来。所以不能把所有元素都重新插入一遍（例如 `list.replaceChildren(...rows)`），只能移动确实需要移动的。较新的浏览器提供了 `moveBefore()` 方法，可以在移动时保留焦点等状态，但它还不是所有浏览器都支持。真实的框架在这一步做了更多优化，尽量减少移动的次数。
:::

:::variant{kind=alt name=cursor-walk}
```ts file=sync.ts
export type Item = { id: string; label: string };

export function syncList(list: HTMLUListElement, items: readonly Item[]): void {
  const byId = new Map<string, HTMLLIElement>();
  for (const li of list.querySelectorAll('li')) {
    if (li.dataset.id) byId.set(li.dataset.id, li);
  }
  const rows = items.map(({ id, label }) => {
    let li = byId.get(id);
    byId.delete(id);
    if (!li) {
      li = document.createElement('li');
      li.dataset.id = id;
      const span = document.createElement('span');
      span.className = 'label';
      const note = document.createElement('input');
      note.className = 'note';
      li.append(span, ' ', note);
    }
    const span = li.querySelector('.label');
    if (span) span.textContent = label;
    li.querySelector('.note')?.setAttribute('aria-label', `${label}的备注`);
    return li;
  });
  for (const stale of byId.values()) stale.remove();

  let cursor = list.firstElementChild;
  for (const row of rows) {
    if (row === cursor) {
      cursor = cursor.nextElementSibling;
    } else {
      list.insertBefore(row, cursor);
    }
  }
}
```
:::

:::variant{kind=wrong name=reinsert-all fails=tests reason="复用了元素，但每次都把全部元素重新插入一遍，正在输入的输入框失去了焦点"}
```ts file=sync.ts
export type Item = { id: string; label: string };

function createRow(id: string): HTMLLIElement {
  const li = document.createElement('li');
  li.dataset.id = id;
  const label = document.createElement('span');
  label.className = 'label';
  const note = document.createElement('input');
  note.className = 'note';
  li.append(label, ' ', note);
  return li;
}

export function syncList(list: HTMLUListElement, items: readonly Item[]): void {
  const existing = new Map<string, HTMLLIElement>();
  for (const li of list.querySelectorAll('li')) {
    if (li.dataset.id !== undefined) existing.set(li.dataset.id, li);
  }
  const rows = items.map((item) => {
    const li = existing.get(item.id) ?? createRow(item.id);
    const label = li.querySelector('.label');
    if (label) label.textContent = item.label;
    li.querySelector('.note')?.setAttribute('aria-label', `${item.label}的备注`);
    return li;
  });
  list.replaceChildren(...rows);
}
```
:::

:::variant{kind=wrong name=rebuild-everything fails=tests reason="每次都重新创建所有元素，用户输入的备注丢失"}
```ts file=sync.ts
export type Item = { id: string; label: string };

export function syncList(list: HTMLUListElement, items: readonly Item[]): void {
  list.replaceChildren(
    ...items.map((item) => {
      const li = document.createElement('li');
      li.dataset.id = item.id;
      const label = document.createElement('span');
      label.className = 'label';
      label.textContent = item.label;
      const note = document.createElement('input');
      note.className = 'note';
      note.setAttribute('aria-label', `${item.label}的备注`);
      li.append(label, ' ', note);
      return li;
    }),
  );
}
```
:::

:::variant{kind=wrong name=match-by-index fails=tests reason="按位置而不是按 id 复用元素，重新排序后备注跑到了别的项上"}
```ts file=sync.ts
export type Item = { id: string; label: string };

export function syncList(list: HTMLUListElement, items: readonly Item[]): void {
  const old = [...list.querySelectorAll('li')];
  const rows = items.map((item, index) => {
    let li = old[index];
    if (!li) {
      li = document.createElement('li');
      const label = document.createElement('span');
      label.className = 'label';
      const note = document.createElement('input');
      note.className = 'note';
      li.append(label, ' ', note);
    }
    li.dataset.id = item.id;
    const label = li.querySelector('.label');
    if (label) label.textContent = item.label;
    li.querySelector('.note')?.setAttribute('aria-label', `${item.label}的备注`);
    return li;
  });
  list.replaceChildren(...rows);
}
```
:::

:::variant{kind=wrong name=keep-stale fails=tests reason="没有删除已经不在数据中的项"}
```ts file=sync.ts
export type Item = { id: string; label: string };

export function syncList(list: HTMLUListElement, items: readonly Item[]): void {
  const existing = new Map<string, HTMLLIElement>();
  for (const li of list.querySelectorAll('li')) {
    if (li.dataset.id !== undefined) existing.set(li.dataset.id, li);
  }
  for (const item of items) {
    let li = existing.get(item.id);
    if (!li) {
      li = document.createElement('li');
      li.dataset.id = item.id;
      const label = document.createElement('span');
      label.className = 'label';
      const note = document.createElement('input');
      note.className = 'note';
      li.append(label, ' ', note);
    }
    const label = li.querySelector('.label');
    if (label) label.textContent = item.label;
    li.querySelector('.note')?.setAttribute('aria-label', `${item.label}的备注`);
    list.append(li);
  }
}
```
:::

:::variant{kind=wrong name=no-label-update fails=tests reason="复用元素时没有更新名称"}
```ts file=sync.ts
export type Item = { id: string; label: string };

function createRow(item: Item): HTMLLIElement {
  const li = document.createElement('li');
  li.dataset.id = item.id;
  const label = document.createElement('span');
  label.className = 'label';
  label.textContent = item.label;
  const note = document.createElement('input');
  note.className = 'note';
  note.setAttribute('aria-label', `${item.label}的备注`);
  li.append(label, ' ', note);
  return li;
}

export function syncList(list: HTMLUListElement, items: readonly Item[]): void {
  const existing = new Map<string, HTMLLIElement>();
  for (const li of list.querySelectorAll('li')) {
    if (li.dataset.id !== undefined) existing.set(li.dataset.id, li);
  }
  list.replaceChildren(...items.map((item) => existing.get(item.id) ?? createRow(item)));
}
```
:::
