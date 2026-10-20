---
version: 1
mode: react
estimatedMinutes: 40
review: self-reviewed
problem: 上一课的组件每次显示的内容都一样；要显示不同的数据，只能写一个返回 JSX 的普通函数。props 让组件像函数一样接收参数：`<UserCard name="韩梅梅" online />`。这一课讲怎样用 TypeScript 描述组件接受的 props（必填、可选与默认值、children、事件回调），以及怎样写一个“包装”原生元素、透传其余属性的组件。
objectives:
  - 用对象类型描述 props，在参数中解构，给可选的 props 设置默认值
  - 正确地传递 props：字符串、表达式、布尔值的简写、展开
  - 用 children（类型为 ReactNode）写包装组件，用 onXxx 形式的回调把事件交给父组件
  - 用 ComponentProps<'button'> 扩展原生元素的属性，并把其余属性透传下去
references:
  - title: Passing Props to a Component — React
    url: https://react.dev/learn/passing-props-to-a-component
    checked: 2026-10-20
  - title: Keeping Components Pure — React
    url: https://react.dev/learn/keeping-components-pure
    checked: 2026-10-20
  - title: Using TypeScript — React
    url: https://react.dev/learn/typescript
    checked: 2026-10-20
  - title: Responding to Events（Passing event handlers as props）— React
    url: https://react.dev/learn/responding-to-events
    checked: 2026-10-20
    note: 本平台使用 React 19.3 与 @types/react 19.3
---

## props 就是组件的参数

组件是一个函数，**props** 就是它的参数。React 把你写在标签上的所有属性收集成**一个对象**，作为第一个参数传给组件：

```tsx
<UserCard name="韩梅梅" role="设计师" />
// React 调用：UserCard({ name: '韩梅梅', role: '设计师' })
```

在 TypeScript 中，用一个对象类型描述这个参数，通常就叫 `组件名Props`。习惯的写法是在参数位置直接解构（a12）：

:::playground{#props-basics}
```tsx file=App.tsx
type UserCardProps = {
  name: string;
  role?: string;
  online?: boolean;
};

function UserCard({ name, role = '成员', online = false }: UserCardProps) {
  return (
    <article className="user-card">
      <h3>{name}</h3>
      <p>
        {role} · {online ? '在线' : '离线'}
      </p>
    </article>
  );
}

export function App() {
  const team = { lead: '李雷', leadRole: '组长' };
  return (
    <>
      <UserCard name="韩梅梅" role="设计师" online={true} />
      <UserCard name={team.lead} role={team.leadRole} online />
      <UserCard name="王五" />
    </>
  );
}
```
```tsx file=main.tsx readonly
import { createRoot } from 'react-dom/client';
import { App } from './App';

const container = document.getElementById('root');
if (!container) throw new Error('页面缺少 #root');
createRoot(container).render(<App />);
```
- 第 1–5 行：`name` 必填；`role` 和 `online` 带 `?`，可以不传。
- 第 7 行：解构时用 `=` 给可选的 props 设置**默认值**，函数体里它们的类型就不再包含 `undefined`。把鼠标停在 `role` 上看看。
- 第 22–23 行：字符串用引号；其他任何值（变量、数字、布尔值、对象）用花括号。第 23 行只写属性名 `online`，等于 `online={true}`。
- 把第 24 行的 `name="王五"` 删掉：TypeScript 报错，因为缺少必填的 `name`。再给它加一个不存在的属性 `age={3}`，同样会报错。
:::

几条规则：

- **props 是只读的**。组件不应该修改收到的 props（也不应该修改其他外部的变量），而是根据它们算出要显示的 JSX：同样的 props 总是得到同样的界面。React 把这叫作组件的**纯粹性**。需要“变化”的数据是 state（下一课）；
- `key` 不会作为 props 传给组件，它有特殊用途（g05）；`ref` 在 React 19 中可以像普通的 prop 一样传给函数组件（g09）。

## children：包装其他内容的组件

写在组件标签**之间**的内容，会作为一个名叫 `children` 的 prop 传进去。它的类型通常写成 `ReactNode`：任何能渲染的东西，包括 JSX、字符串、数字、`null`，以及它们组成的数组。

用 `children` 可以写出卡片、对话框、布局这类“容器”组件，容器只负责外框，里面放什么由使用者决定。

## 把事件交给父组件

组件内部发生的事（按钮被点击、选中了某一项），常常要由**使用它的组件**来决定怎么处理。做法是接收一个函数类型的 prop，按习惯命名为 `onXxx`，例如 `onSelect`、`onClose`：

:::playground{#children-and-callbacks}
```tsx file=App.tsx
import type { ReactNode } from 'react';

type PanelProps = {
  title: string;
  children: ReactNode;
  onClose?: () => void;
};

function Panel({ title, children, onClose }: PanelProps) {
  return (
    <section className="panel">
      <header>
        <h2>{title}</h2>
        {onClose !== undefined && (
          <button type="button" aria-label={`关闭“${title}”`} onClick={onClose}>
            ×
          </button>
        )}
      </header>
      <div className="panel-body">{children}</div>
    </section>
  );
}

export function App() {
  return (
    <>
      <Panel title="公告" onClose={() => console.log('父组件决定：关闭公告')}>
        <p>本周五下午系统维护。</p>
        <p>
          维护期间<strong>无法提交作业</strong>。
        </p>
      </Panel>
      <Panel title="帮助">没有关闭按钮的面板，内容也可以只是一段文字。</Panel>
    </>
  );
}
```
```tsx file=main.tsx readonly
import { createRoot } from 'react-dom/client';
import { App } from './App';

const container = document.getElementById('root');
if (!container) throw new Error('页面缺少 #root');
createRoot(container).render(<App />);
```
- 第 5 行：`children` 是必填的。试着写一个 `<Panel title="空" />`，TypeScript 会报告缺少 `children`。
- 第 6、14–15 行：`onClose` 是可选的回调。父组件传了它，面板才显示关闭按钮；按钮被点击时，面板只是调用它，真正做什么由父组件决定。
- `onClick={onClose}` 把函数本身交给按钮（不是调用它的结果，下一课详讲）。React 调用点击处理函数时会传入一个**事件对象**；这里 `onClose` 不需要参数，所以可以直接传。如果回调需要别的参数（例如名字），就要包一层箭头函数：`onClick={() => onSelect(name)}`。
- 第 28–33 行：标签之间的内容就是 `children`，可以是多个元素；第 34 行的 `children` 只是一段文字。
:::

## 扩展原生元素的属性

写一个自己的 `Button` 时，通常希望它接受原生 `<button>` 的**所有**属性（`onClick`、`disabled`、`aria-label`……），再加上自己的几个。逐个声明太麻烦，用 `ComponentProps<'button'>` 直接得到原生 `<button>` 的属性类型，再用交叉类型（`&`）加上自己的：

```tsx
import type { ComponentProps } from 'react';

type ButtonProps = ComponentProps<'button'> & {
  variant?: 'primary' | 'secondary';
};

function Button({ variant = 'primary', type = 'button', className, ...rest }: ButtonProps) {
  const classes = ['btn', `btn-${variant}`, className].filter(Boolean).join(' ');
  return <button type={type} {...rest} className={classes} />;
}
```

- 解构时用 `...rest` 收集其余的属性（a12），再用 `{...rest}` **展开**到 `<button>` 上，使用者传的 `onClick`、`disabled`、`children` 都原样传了下去；
- 展开的**位置**决定了谁覆盖谁：写在后面的属性覆盖前面的。例如不解构 `type`，直接写 `<button type="button" {...rest}>`，`'button'` 就成了一个可以被使用者覆盖的默认值；而写成 `<button {...rest} type="button">`，使用者传的 `type` 永远不起作用。上面的代码把 `type` 和 `className` 都从 `rest` 中解构了出来，`rest` 里没有它们，位置也就不再影响结果；但把 `className={classes}` 写在最后，能保证 `class` 一定是合并后的结果；
- 原生 `<button>` 的 `type` 默认是 `submit`，在表单里会意外地提交表单（d09）。组件把默认值改成 `'button'`，需要提交时再显式写 `type="submit"`。

挑战题会完整地实现这个组件。

::exercise{#user-card}

## 编程挑战

::exercise{#button-and-card}

::quiz

## 常见错误

- **在组件里修改 props**：`props.items.push(x)`、`user.name = …`。props 是只读的，要变化的数据用 state。
- **可选的 props 不处理 `undefined`**：用解构的默认值，或者在使用前检查。
- **children 的类型写成 `React.JSX.Element`**：这样就不能传字符串、数字或多个元素了。一般用 `ReactNode`。（`@types/react` 19 中已经没有全局的 `JSX` 命名空间，旧资料中的 `JSX.Element` 要写成 `React.JSX.Element`。）
- **包装组件丢掉了其余的属性**：没有 `{...rest}`，使用者传的 `onClick`、`aria-label` 都会悄悄失效。
- **展开的顺序写反**：`{...rest}` 写在最后，会覆盖组件自己设置的属性。

## 下一步

下一课讲事件与 state：让组件记住用户的操作，并在数据变化时更新界面。
