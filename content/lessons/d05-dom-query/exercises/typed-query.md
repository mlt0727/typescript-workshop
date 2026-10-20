---
kind: challenge
title: 类型安全的查询函数
---
每次查询都写一遍 `instanceof` 检查有点啰嗦。实现两个通用的查询函数，让调用方一行就得到具体类型的元素：

```ts
const button = query('#save', HTMLButtonElement); // 类型是 HTMLButtonElement
const items = queryAll('li', HTMLLIElement, list); // 类型是 HTMLLIElement[]
```

- `query(selector, type, root?)`：在 `root`（默认是 `document`）里查找第一个匹配的元素。找不到时抛出 `Error`，消息包含选择器；找到的元素不是 `type` 的实例时，抛出 `TypeError`，消息包含选择器和期望的类型名（例如 `HTMLButtonElement`，可以用 `type.name` 取得）。
- `queryAll(selector, type, root?)`：返回所有匹配元素组成的**数组**（真正的数组，可以直接 `map`）；没有匹配时返回空数组；只要有一个元素不是 `type` 的实例，就抛出 `TypeError`，消息包含选择器。
- 返回类型由传入的 `type` 决定。

起始代码已经给出了类型 `ElementType<T>`，它需要一点解释。`HTMLButtonElement` 不只是类型名，它在运行时也是一个值（一个类），所以可以写在 `instanceof` 的右边（b07）。描述“一个能用 `new` 创建出 `T` 的值”的类型写作 `new (...args: never[]) => T`，叫**构造签名**。参数写成 `never[]`，表示“不关心它要什么参数”，这样任何构造函数都能赋值给它，又不用写 `any`。（这些元素类其实不能直接 `new`，会报“Illegal constructor”，要用 `document.createElement`；这里只用它们来做 `instanceof` 检查。）TypeScript 看到 `el instanceof type` 通过后，会把 `el` 收窄成 `T`。

:::files{role=support}
```html file=index.html readonly
<!doctype html>
<html lang="zh-CN">
  <body>
    <h1 id="title">待办</h1>
    <button type="button" id="save">保存</button>
    <ul id="list">
      <li>买牛奶</li>
      <li>写周报</li>
    </ul>
    <ul id="other">
      <li>别的列表</li>
    </ul>
    <div id="mixed"><p class="item">段落</p><span class="item">文字</span></div>
  </body>
</html>
```
:::

:::files{role=starter}
```ts file=query.ts
/** 元素的构造函数，例如 HTMLButtonElement */
export type ElementType<T extends Element> = new (...args: never[]) => T;

export function query<T extends Element>(selector: string, type: ElementType<T>, root: ParentNode = document): T {
  throw new Error('尚未实现');
}

export function queryAll<T extends Element>(selector: string, type: ElementType<T>, root: ParentNode = document): T[] {
  throw new Error('尚未实现');
}
```
:::

:::files{role=solution}
```ts file=query.ts
/** 元素的构造函数，例如 HTMLButtonElement */
export type ElementType<T extends Element> = new (...args: never[]) => T;

export function query<T extends Element>(selector: string, type: ElementType<T>, root: ParentNode = document): T {
  const el = root.querySelector(selector);
  if (el === null) {
    throw new Error(`找不到 ${selector}`);
  }
  if (!(el instanceof type)) {
    throw new TypeError(`${selector} 不是 ${type.name}，而是 <${el.tagName.toLowerCase()}>`);
  }
  return el;
}

export function queryAll<T extends Element>(selector: string, type: ElementType<T>, root: ParentNode = document): T[] {
  const result: T[] = [];
  for (const el of root.querySelectorAll(selector)) {
    if (!(el instanceof type)) {
      throw new TypeError(`${selector} 匹配到的 <${el.tagName.toLowerCase()}> 不是 ${type.name}`);
    }
    result.push(el);
  }
  return result;
}
```
:::

:::files{role=tests}
```ts file=query.test.ts
import { describe, expect, test } from 'vitest';
import { query, queryAll } from './query';

describe('query', () => {
  test('返回第一个匹配的元素', () => {
    const button = query('#save', HTMLButtonElement);
    expect(button.textContent).toBe('保存');
    expect(query('li', HTMLLIElement).textContent).toBe('买牛奶');
  });

  test('找不到时抛出 Error，消息包含选择器', () => {
    expect(() => query('#missing', HTMLButtonElement)).toThrow('#missing');
  });

  test('类型不对时抛出 TypeError，消息包含选择器和类型名', () => {
    expect(() => query('#title', HTMLButtonElement)).toThrow(TypeError);
    expect(() => query('#title', HTMLButtonElement)).toThrow(/#title.*HTMLButtonElement|HTMLButtonElement.*#title/);
  });

  test('只在 root 里查找', () => {
    const other = query('#other', HTMLUListElement);
    expect(query('li', HTMLLIElement, other).textContent).toBe('别的列表');
    expect(() => query('#save', HTMLButtonElement, other)).toThrow('#save');
  });
});

describe('queryAll', () => {
  test('返回真正的数组', () => {
    const list = query('#list', HTMLUListElement);
    const items = queryAll('li', HTMLLIElement, list);
    expect(Array.isArray(items)).toBe(true);
    expect(items.map((li) => li.textContent)).toEqual(['买牛奶', '写周报']);
    expect(queryAll('li', HTMLLIElement)).toHaveLength(3);
  });

  test('没有匹配时返回空数组', () => {
    expect(queryAll('table', HTMLTableElement)).toEqual([]);
  });

  test('有元素类型不对时抛出 TypeError', () => {
    expect(() => queryAll('.item', HTMLParagraphElement)).toThrow(TypeError);
    expect(() => queryAll('.item', HTMLParagraphElement)).toThrow('.item');
    expect(queryAll('.item', HTMLElement)).toHaveLength(2);
  });
});
```
```ts file=query.test-d.ts
import { expectTypeOf } from 'vitest';
import { query, queryAll } from './query';

expectTypeOf(query('#save', HTMLButtonElement)).toEqualTypeOf<HTMLButtonElement>();
expectTypeOf(queryAll('li', HTMLLIElement)).toEqualTypeOf<HTMLLIElement[]>();
expectTypeOf(query('svg', SVGSVGElement, document.body)).toEqualTypeOf<SVGSVGElement>();

// @ts-expect-error 只能传入元素的构造函数
query('#save', String);
```
:::

:::hint{level=1}
`query`：先 `root.querySelector(selector)`，检查 `null`，再检查 `el instanceof type`。因为 `type` 的类型是 `ElementType<T>`，`instanceof` 检查通过后，TypeScript 就知道 `el` 是 `T`，可以直接返回，不需要任何断言。
:::

:::hint{level=2}
`queryAll`：遍历 `root.querySelectorAll(selector)`，每个元素都用 `instanceof type` 检查，不是就抛出 `TypeError`，是就放进 `const result: T[] = []`。不要用 `filter` 悄悄丢掉类型不对的元素：那会掩盖页面结构的问题。
:::

:::explanation
这道题结合了泛型（b14、b15）和收窄（b07）。关键是参数 `type: ElementType<T>`：调用 `query('#save', HTMLButtonElement)` 时，TypeScript 从 `HTMLButtonElement` 这个构造函数推断出 `T = HTMLButtonElement`；函数内部，`el instanceof type` 通过后，`el` 被收窄成 `T`。整个过程没有断言：返回的类型有运行时检查作保证。

对比泛型参数的写法 `document.querySelector<HTMLButtonElement>('#save')`：它只是声明“请把结果当作按钮”，没有检查；而 `query('#save', HTMLButtonElement)` 真的检查了。传入的构造函数同时起到两个作用：在编译期决定返回类型，在运行时用来检查。

`queryAll` 遇到类型不对的元素时选择抛出错误，而不是过滤掉：选择器匹配到了预料之外的元素，通常说明页面结构或选择器写错了，应该尽早暴露出来。

`ParentNode` 是 `Document`、`Element` 和 `DocumentFragment` 共有的接口，它们都有 `querySelector` 和 `querySelectorAll`，所以 `root` 可以是整个文档，也可以是某个元素。
:::

:::variant{kind=alt name=array-from}
```ts file=query.ts
/** 元素的构造函数，例如 HTMLButtonElement */
export type ElementType<T extends Element> = new (...args: never[]) => T;

function check<T extends Element>(el: Element, selector: string, type: ElementType<T>): T {
  if (el instanceof type) return el;
  throw new TypeError(`期望 ${selector} 是 ${type.name}`);
}

export function query<T extends Element>(selector: string, type: ElementType<T>, root: ParentNode = document): T {
  const el = root.querySelector(selector);
  if (!el) throw new Error(`${selector} 不存在`);
  return check(el, selector, type);
}

export function queryAll<T extends Element>(selector: string, type: ElementType<T>, root: ParentNode = document): T[] {
  return Array.from(root.querySelectorAll(selector), (el) => check(el, selector, type));
}
```
:::

:::variant{kind=wrong name=filter-silently fails=tests reason="queryAll 悄悄过滤掉了类型不对的元素，没有报错"}
```ts file=query.ts
/** 元素的构造函数，例如 HTMLButtonElement */
export type ElementType<T extends Element> = new (...args: never[]) => T;

export function query<T extends Element>(selector: string, type: ElementType<T>, root: ParentNode = document): T {
  const el = root.querySelector(selector);
  if (el === null) throw new Error(`找不到 ${selector}`);
  if (!(el instanceof type)) throw new TypeError(`${selector} 不是 ${type.name}`);
  return el;
}

export function queryAll<T extends Element>(selector: string, type: ElementType<T>, root: ParentNode = document): T[] {
  return [...root.querySelectorAll(selector)].filter((el): el is T => el instanceof type);
}
```
:::

:::variant{kind=wrong name=null-check-only fails=types reason="只检查了 null，没有用 instanceof 收窄，返回的 Element 不能当作 T"}
```ts file=query.ts
/** 元素的构造函数，例如 HTMLButtonElement */
export type ElementType<T extends Element> = new (...args: never[]) => T;

export function query<T extends Element>(selector: string, type: ElementType<T>, root: ParentNode = document): T {
  const el = root.querySelector(selector);
  if (el === null) throw new Error(`找不到 ${selector}，期望 ${type.name}`);
  return el;
}

export function queryAll<T extends Element>(selector: string, type: ElementType<T>, root: ParentNode = document): T[] {
  return [...root.querySelectorAll(selector)].filter((el): el is T => el instanceof type);
}
```
:::

:::variant{kind=wrong name=ignore-root fails=tests reason="忽略了 root，总是在整个文档中查找"}
```ts file=query.ts
/** 元素的构造函数，例如 HTMLButtonElement */
export type ElementType<T extends Element> = new (...args: never[]) => T;

export function query<T extends Element>(selector: string, type: ElementType<T>, root: ParentNode = document): T {
  const el = document.querySelector(selector);
  if (el === null) throw new Error(`找不到 ${selector}`);
  if (!(el instanceof type)) throw new TypeError(`${selector} 不是 ${type.name}`);
  return el;
}

export function queryAll<T extends Element>(selector: string, type: ElementType<T>, root: ParentNode = document): T[] {
  const result: T[] = [];
  for (const el of document.querySelectorAll(selector)) {
    if (!(el instanceof type)) throw new TypeError(`${selector} 不是 ${type.name}`);
    result.push(el);
  }
  return result;
}
```
:::

:::variant{kind=wrong name=return-nodelist fails=types reason="queryAll 直接返回了 NodeList，不是数组，元素类型也没有检查"}
```ts file=query.ts
/** 元素的构造函数，例如 HTMLButtonElement */
export type ElementType<T extends Element> = new (...args: never[]) => T;

export function query<T extends Element>(selector: string, type: ElementType<T>, root: ParentNode = document): T {
  const el = root.querySelector(selector);
  if (el === null) throw new Error(`找不到 ${selector}`);
  if (!(el instanceof type)) throw new TypeError(`${selector} 不是 ${type.name}`);
  return el;
}

export function queryAll<T extends Element>(selector: string, type: ElementType<T>, root: ParentNode = document): T[] {
  return root.querySelectorAll(selector);
}
```
:::
