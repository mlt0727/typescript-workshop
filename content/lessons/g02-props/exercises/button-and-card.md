---
kind: challenge
title: 可复用的按钮与卡片
---
在 `ui.tsx` 中写两个可复用的组件。

**`Button`**：接受原生 `<button>` 的**所有**属性，另外还有一个可选的 `variant`：`'primary'`（默认）、`'secondary'` 或 `'danger'`。

- 渲染一个 `<button>`，使用者传入的属性（`onClick`、`disabled`、`aria-label`、`children`……）都要传给它；
- `class` 是 `btn btn-{variant}`，使用者也传了 `className` 时，接在后面：`btn btn-danger wide`；
- `type` 默认是 `"button"`，使用者可以改成别的值（例如 `"submit"`）。

**`Card`**：props 是 `title`（字符串，必填）、`footer`（可选，任何可以渲染的内容）和 `children`（必填）。

```html
<section class="card">
  <h2 class="card-title">标题</h2>
  <div class="card-body">children</div>
  <footer class="card-footer">footer</footer>   <!-- 没有 footer 时不渲染 -->
</section>
```

:::files{role=starter}
```tsx file=ui.tsx
import type { ComponentProps, ReactNode } from 'react';

// TODO：variant 可以是 'primary' | 'secondary' | 'danger'，其余属性与原生 <button> 相同
type ButtonProps = {
  children: ReactNode;
};

export function Button({ children }: ButtonProps) {
  return <button className="btn">{children}</button>;
}

// TODO：title、可选的 footer、children
type CardProps = {
  children: ReactNode;
};

export function Card({ children }: CardProps) {
  return <section className="card">{children}</section>;
}
```
:::

:::files{role=support}
```tsx file=main.tsx readonly
import { createRoot } from 'react-dom/client';
import { Button, Card } from './ui';

function App() {
  return (
    <Card
      title="删除项目"
      footer={
        <>
          <Button variant="secondary" onClick={() => console.log('取消')}>
            取消
          </Button>{' '}
          <Button variant="danger" onClick={() => console.log('删除')}>
            删除
          </Button>
        </>
      }
    >
      <p>删除之后无法恢复。确定要删除“周报”吗？</p>
    </Card>
  );
}

const container = document.getElementById('root');
if (!container) throw new Error('页面缺少 #root');
createRoot(container).render(<App />);
```
:::

:::files{role=solution}
```tsx file=ui.tsx
import type { ComponentProps, ReactNode } from 'react';

type ButtonProps = ComponentProps<'button'> & {
  variant?: 'primary' | 'secondary' | 'danger';
};

export function Button({ variant = 'primary', type = 'button', className, ...rest }: ButtonProps) {
  const classes = ['btn', `btn-${variant}`, className].filter(Boolean).join(' ');
  return <button type={type} {...rest} className={classes} />;
}

type CardProps = {
  title: string;
  footer?: ReactNode;
  children: ReactNode;
};

export function Card({ title, footer, children }: CardProps) {
  return (
    <section className="card">
      <h2 className="card-title">{title}</h2>
      <div className="card-body">{children}</div>
      {footer !== undefined && <footer className="card-footer">{footer}</footer>}
    </section>
  );
}
```
:::

:::files{role=tests}
```tsx file=ui.test.tsx
import { describe, expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button, Card } from './ui';

describe('Button', () => {
  test('默认是 type="button" 的 primary 按钮', () => {
    render(<Button>保存</Button>);
    const button = screen.getByRole('button', { name: '保存' });
    expect(button).toHaveAttribute('type', 'button');
    expect(button.className).toBe('btn btn-primary');
  });

  test('variant 和使用者的 className 合并在一起', () => {
    render(
      <Button variant="danger" className="wide">
        删除
      </Button>,
    );
    expect(screen.getByRole('button', { name: '删除' }).className).toBe('btn btn-danger wide');
  });

  test('其余的属性都传给了原生按钮', async () => {
    const onClick = vi.fn();
    render(
      <>
        <Button onClick={onClick} aria-label="关闭对话框" title="关闭">
          ×
        </Button>
        <Button disabled>不可用</Button>
      </>,
    );
    const close = screen.getByRole('button', { name: '关闭对话框' });
    expect(close).toHaveAttribute('title', '关闭');
    await userEvent.setup().click(close);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: '不可用' })).toBeDisabled();
  });

  test('可以改成 submit 按钮', () => {
    render(<Button type="submit">提交</Button>);
    expect(screen.getByRole('button', { name: '提交' })).toHaveAttribute('type', 'submit');
  });
});

describe('Card', () => {
  test('标题、内容和底部', () => {
    const { container } = render(
      <Card title="删除项目" footer={<Button>确定</Button>}>
        <p>无法恢复</p>
      </Card>,
    );
    const card = container.querySelector('section.card');
    expect([...(card?.children ?? [])].map((el) => el.tagName)).toEqual(['H2', 'DIV', 'FOOTER']);
    expect(card?.querySelector('h2.card-title')).toHaveTextContent(/^删除项目$/);
    expect(card?.querySelector('.card-body > p')).toHaveTextContent('无法恢复');
    expect(card?.querySelector('footer.card-footer button')).toHaveTextContent('确定');
  });

  test('没有 footer 时不渲染底部；children 可以是文字', () => {
    const { container } = render(<Card title="提示">只是一段文字</Card>);
    expect(container.querySelector('footer')).toBeNull();
    expect(container.querySelector('.card-body')).toHaveTextContent(/^只是一段文字$/);
    expect(container.querySelector('section.card')?.children).toHaveLength(2);
  });
});
```
```tsx file=ui.test-d.tsx
import { Button, Card } from './ui';

// @ts-expect-error 没有 ghost 这种 variant
const badVariant = <Button variant="ghost">x</Button>;
// @ts-expect-error onClick 必须是函数
const badHandler = <Button onClick="go()">x</Button>;
// @ts-expect-error Card 必须有 title
const noTitle = <Card>内容</Card>;
// @ts-expect-error Card 必须有内容
const noChildren = <Card title="空" />;
const ok = (
  <Card title="t" footer="底部文字">
    <Button variant="secondary" aria-describedby="hint" form="f1">
      ok
    </Button>
  </Card>
);

console.log(badVariant, badHandler, noTitle, noChildren, ok);
```
:::

:::hint{level=1}
`Button` 的 props 类型：`ComponentProps<'button'> & { variant?: … }`。解构出 `variant`、`type`、`className` 并设置默认值，剩下的用 `...rest` 收集，再在 `<button>` 上 `{...rest}` 展开。`Card` 的 `footer` 和 `children` 都用 `ReactNode` 类型。
:::

:::hint{level=2}
注意属性的顺序：`<button type={type} {...rest} className={classes} />`。合并 className：`['btn', `btn-${variant}`, className].filter(Boolean).join(' ')`，`filter(Boolean)` 去掉了 `undefined`。`children` 也在 `rest` 里，展开时会一起传给 `<button>`。
:::

:::explanation
`ComponentProps<'button'>` 是原生 `<button>` 在 JSX 中接受的所有属性的类型（几百个）。用交叉类型加上 `variant`，`Button` 就成了一个“增强版”的 `<button>`：使用者会用的属性一个不少，类型检查也一个不少（类型测试中的 `onClick="go()"` 被拒绝了）。

`{...rest}` 的位置很重要。JSX 中后写的属性覆盖先写的：

- `type={type}` 写在前面。解构时已经把使用者传的 `type` 拿了出来（没传就是 `'button'`），所以 `rest` 里没有 `type`，写在哪里结果都一样；但如果不解构 `type`、只是写 `type="button" {...rest}`，也能做到“默认值可以被覆盖”；
- `className={classes}` 必须写在 `{...rest}` 后面。虽然 `className` 也被解构出来了，但把它放在最后，能保证 `class` 一定是合并后的结果。

`Card` 的 `footer` 是 `ReactNode`，所以使用者可以传一段文字，也可以传几个按钮组成的 Fragment（见预览）。判断有没有 footer 用的是 `footer !== undefined`。注意 `ReactNode` 也包括 `null` 和 `false`，传 `footer={null}` 时会渲染出一个空的 `<footer>`，如果想避免，可以改成 `footer != null && footer !== false` 这样的判断，题目没有要求。
:::

:::variant{kind=alt name=interface-extends}
```tsx file=ui.tsx
import type { ComponentPropsWithoutRef, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'danger';

interface ButtonProps extends ComponentPropsWithoutRef<'button'> {
  variant?: Variant;
}

export function Button(props: ButtonProps) {
  const { variant, className, ...rest } = props;
  const names = ['btn', `btn-${variant ?? 'primary'}`];
  if (className) names.push(className);
  return <button type="button" {...rest} className={names.join(' ')} />;
}

interface CardProps {
  title: string;
  footer?: ReactNode;
  children: ReactNode;
}

export function Card(props: CardProps) {
  const footer = props.footer === undefined ? null : <footer className="card-footer">{props.footer}</footer>;
  return (
    <section className="card">
      <h2 className="card-title">{props.title}</h2>
      <div className="card-body">{props.children}</div>
      {footer}
    </section>
  );
}
```
:::

:::variant{kind=wrong name=no-rest fails=tests reason="只传了 children，onClick、disabled 等其余属性都丢了"}
```tsx file=ui.tsx
import type { ComponentProps, ReactNode } from 'react';

type ButtonProps = ComponentProps<'button'> & {
  variant?: 'primary' | 'secondary' | 'danger';
};

export function Button({ variant = 'primary', type = 'button', className, children }: ButtonProps) {
  const classes = ['btn', `btn-${variant}`, className].filter(Boolean).join(' ');
  return (
    <button type={type} className={classes}>
      {children}
    </button>
  );
}

type CardProps = {
  title: string;
  footer?: ReactNode;
  children: ReactNode;
};

export function Card({ title, footer, children }: CardProps) {
  return (
    <section className="card">
      <h2 className="card-title">{title}</h2>
      <div className="card-body">{children}</div>
      {footer !== undefined && <footer className="card-footer">{footer}</footer>}
    </section>
  );
}
```
:::

:::variant{kind=wrong name=rest-last fails=tests reason="{...rest} 写在最后，使用者的 className 覆盖了组件的 class"}
```tsx file=ui.tsx
import type { ComponentProps, ReactNode } from 'react';

type ButtonProps = ComponentProps<'button'> & {
  variant?: 'primary' | 'secondary' | 'danger';
};

export function Button({ variant = 'primary', ...rest }: ButtonProps) {
  return <button type="button" className={`btn btn-${variant}`} {...rest} />;
}

type CardProps = {
  title: string;
  footer?: ReactNode;
  children: ReactNode;
};

export function Card({ title, footer, children }: CardProps) {
  return (
    <section className="card">
      <h2 className="card-title">{title}</h2>
      <div className="card-body">{children}</div>
      {footer !== undefined && <footer className="card-footer">{footer}</footer>}
    </section>
  );
}
```
:::

:::variant{kind=wrong name=fixed-type fails=tests reason="type 固定为 button，使用者无法改成 submit"}
```tsx file=ui.tsx
import type { ComponentProps, ReactNode } from 'react';

type ButtonProps = ComponentProps<'button'> & {
  variant?: 'primary' | 'secondary' | 'danger';
};

export function Button({ variant = 'primary', className, ...rest }: ButtonProps) {
  const classes = ['btn', `btn-${variant}`, className].filter(Boolean).join(' ');
  return <button {...rest} type="button" className={classes} />;
}

type CardProps = {
  title: string;
  footer?: ReactNode;
  children: ReactNode;
};

export function Card({ title, footer, children }: CardProps) {
  return (
    <section className="card">
      <h2 className="card-title">{title}</h2>
      <div className="card-body">{children}</div>
      {footer !== undefined && <footer className="card-footer">{footer}</footer>}
    </section>
  );
}
```
:::

:::variant{kind=wrong name=loose-variant fails=types reason="variant 的类型写成了 string，拼错的值也能通过"}
```tsx file=ui.tsx
import type { ComponentProps, ReactNode } from 'react';

type ButtonProps = ComponentProps<'button'> & {
  variant?: string;
};

export function Button({ variant = 'primary', type = 'button', className, ...rest }: ButtonProps) {
  const classes = ['btn', `btn-${variant}`, className].filter(Boolean).join(' ');
  return <button type={type} {...rest} className={classes} />;
}

type CardProps = {
  title: string;
  footer?: ReactNode;
  children: ReactNode;
};

export function Card({ title, footer, children }: CardProps) {
  return (
    <section className="card">
      <h2 className="card-title">{title}</h2>
      <div className="card-body">{children}</div>
      {footer !== undefined && <footer className="card-footer">{footer}</footer>}
    </section>
  );
}
```
:::

:::variant{kind=wrong name=empty-footer fails=tests reason="没有 footer 时也渲染了一个空的 footer 元素"}
```tsx file=ui.tsx
import type { ComponentProps, ReactNode } from 'react';

type ButtonProps = ComponentProps<'button'> & {
  variant?: 'primary' | 'secondary' | 'danger';
};

export function Button({ variant = 'primary', type = 'button', className, ...rest }: ButtonProps) {
  const classes = ['btn', `btn-${variant}`, className].filter(Boolean).join(' ');
  return <button type={type} {...rest} className={classes} />;
}

type CardProps = {
  title: string;
  footer?: ReactNode;
  children: ReactNode;
};

export function Card({ title, footer, children }: CardProps) {
  return (
    <section className="card">
      <h2 className="card-title">{title}</h2>
      <div className="card-body">{children}</div>
      <footer className="card-footer">{footer}</footer>
    </section>
  );
}
```
:::
