---
version: 1
mode: dom
estimatedMinutes: 50
review: self-reviewed
problem: 上一个里程碑写好了任务板的模型：解析输入的函数和状态更新函数。这一个里程碑把它显示到页面上，并能添加任务：三列分别是带标题的区域，每列一个任务列表，任务的标题和标签要按文字显示（用户输入的内容不能被当成 HTML），添加时要验证输入，失败时把原因告诉用户（包括使用屏幕阅读器的用户），成功后清空输入框、让焦点留在原处，方便继续添加。
objectives:
  - 用“状态 → 渲染”的方式组织原生 DOM 应用：每次状态变化都从状态重新生成界面（d10）
  - 写一个类型安全的创建元素的小工具，用文字节点显示用户输入（e12）
  - 用区域、标题和列表组织任务板的结构，让屏幕阅读器用户也能浏览
  - 表单验证失败时用 aria-invalid、aria-describedby 和文字说明原因，成功后用 role="status" 播报结果（d09、e07）
references:
  - title: Document.createElement() — MDN
    url: https://developer.mozilla.org/zh-CN/docs/Web/API/Document/createElement
    checked: 2026-10-20
  - title: Element.replaceChildren() — MDN
    url: https://developer.mozilla.org/zh-CN/docs/Web/API/Element/replaceChildren
    checked: 2026-10-20
  - title: aria-invalid — MDN
    url: https://developer.mozilla.org/zh-CN/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-invalid
    checked: 2026-10-20
  - title: Region role — MDN
    url: https://developer.mozilla.org/zh-CN/docs/Web/Accessibility/ARIA/Reference/Roles/region_role
    checked: 2026-10-20
---

## 从状态渲染

d10 的做法在这里继续使用：整个应用只有一份状态（`Board`），任何操作都是“计算出新的状态，再从新的状态重新渲染”。渲染函数只读状态、不改状态；事件处理函数只产生动作、不直接改页面。这样，页面上显示的永远是状态的样子。

每次都重新生成整个任务板，会不会太慢？对几十、几百个任务来说完全没有问题。真正的代价是：重新生成之后，原来的元素被替换，焦点、输入框中没有提交的文字都会丢失。所以表单不在被替换的区域中，下一个里程碑处理改名时，也要专门处理焦点。

## 一个创建元素的小工具

`document.createElement` 加上一连串 `setAttribute`、`append` 写起来很长。项目中用一个小函数把它们合在一起：

:::playground{#el-helper}
```html file=index.html
<!doctype html>
<html lang="zh-CN">
  <body>
    <div id="app"></div>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```
```ts file=dom.ts
/** 创建一个元素：设置属性，按顺序加入子节点（字符串会成为文字节点，不会被当成 HTML） */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Readonly<Record<string, string>> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
  node.append(...children);
  return node;
}
```
```ts file=main.ts
import { el } from './dom';

const tasks = [
  { id: 't1', title: '写周报', tags: ['工作'] },
  { id: 't2', title: '<img src=x onerror=alert(1)>', tags: [] },
];

const app = document.querySelector('#app');
if (!(app instanceof HTMLElement)) throw new Error('页面缺少 #app');

const list = el(
  'ul',
  {},
  ...tasks.map((task) =>
    el('li', { 'data-id': task.id }, el('span', { class: 'title' }, task.title), ...task.tags.map((tag) => el('span', { class: 'tag' }, ` #${tag}`))),
  ),
);
app.replaceChildren(el('h2', { id: 'col-todo' }, '待办 ', el('span', { class: 'count' }, String(tasks.length))), list);

console.log(list.querySelector('img'));
console.log(app.querySelector('h2')?.textContent);
```
- `dom.ts` 第 2–6 行：`K extends keyof HTMLElementTagNameMap` 把标签名限制为已知的 HTML 标签，返回值的类型随标签变化（b15）：`el('ul')` 的类型是 `HTMLUListElement`，`el('input')` 是 `HTMLInputElement`。把 `'ul'` 改成 `'ull'` 试试。
- 第二个任务的标题是一段 HTML，但它通过 `append` 加入，成为一个**文字节点**：页面上显示的是这段文字，控制台打印的 `null` 说明并没有生成 `<img>`（e12）。
- `replaceChildren` 一次替换掉 `#app` 中原来的所有内容：同一个渲染函数可以反复调用，不会越加越多。
:::

## 任务板的结构

用屏幕阅读器的用户也要能“看懂”任务板：一共有几列、每列叫什么、有几个任务。所以每一列是一个 `<section>`，用 `aria-labelledby` 指向它的标题 `<h2>`，这样它就成为一个有名字的**区域**（`role="region"`），读屏软件可以在区域之间跳转；任务放在列表 `<ul>` 中，读屏软件会读出“列表，3 项”。标签也是一个小列表，用 `aria-label="标签"` 说明它是什么。

## 告诉用户发生了什么

添加任务的表单按 d09 的方式给出反馈：

- 输入不合法时，在输入框下面显示原因，给输入框加上 `aria-invalid="true"`；输入框的 `aria-describedby` 指向这段说明，读屏软件在输入框获得焦点时会读出它；焦点留在输入框中，用户可以直接修改。不过提交时焦点本来就在输入框中，描述不会被重新读出，所以这段说明放在一个 `role="alert"` 的元素中：它一出现，读屏软件就会立刻读出；
- 添加成功后清空输入框，焦点仍然留在输入框中（连续添加几个任务时不用再点一次），在一个 `role="status"` 的区域中写一句“已添加：写周报”，读屏软件会读出它（e07）；
- 用户开始修改输入框时，错误提示就可以消失了：隐藏它，并且清空它的文字（隐藏的说明仍然会通过 `aria-describedby` 被读出）。

::exercise{#render-board}

## 编程挑战

::exercise{#add-task}

::quiz

## 常见错误

- **用 `innerHTML` 拼接用户输入**：标题中的 HTML 会被执行（e12）。用文字节点。
- **重新渲染时只追加不清空**：每渲染一次，任务就多一遍。用 `replaceChildren`。
- **把表单放进每次都被替换的区域**：输入框被替换，焦点和没有提交的文字都丢了。
- **只用红色边框表示错误**：读屏软件和色盲用户都看不到。写出文字说明，用 `aria-invalid` 和 `aria-describedby` 关联起来。
- **添加之后把焦点移走**：用户要再点一次输入框才能继续添加。

## 下一步

下一个里程碑给每个任务加上“左移、右移、改名、删除”：用一个事件监听器处理所有任务上的按钮（事件委托），改名时管理好焦点。
