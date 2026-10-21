---
version: 1
mode: ts
estimatedMinutes: 55
review: self-reviewed
problem: h04 在服务端读取数据，这一课写入数据。在单页应用中，写入要先在服务器上写一个接口，再在浏览器中 fetch 它，再处理结果、刷新页面上的数据。Next.js 的 Server Function 把这些步骤合在一起：一个写了 'use server' 的 async 函数可以直接交给表单的 action，浏览器提交表单时它在服务器上运行，运行完之后页面上的数据在同一个响应中更新。方便的代价是：这个函数实际上是一个任何人都可以调用的 HTTP 接口，它收到的 FormData 什么都可能有。这一课在实测的 Next.js 16.4.2 项目中看清楚 Server Function 怎样被调用、Next.js 替你挡住了什么、没有挡住什么，然后写出校验 FormData 的代码和一个用 useActionState 显示错误的表单。
objectives:
  - 用 'use server' 写 Server Function，交给表单的 action，知道它在没有 JavaScript 时也能提交
  - 说出 Server Function 是一个公开的 POST 接口：Next.js 检查 Origin、限制请求体的大小，但认证、授权和校验必须在函数中自己做
  - 校验 FormData：get 与 getAll、文件、复选框、只取认识的字段
  - 用 useActionState 显示字段错误和提交中的状态，知道 React 在提交之后会重置表单
  - 写入之后用 updateTag、revalidatePath 让页面在同一个响应中显示新的数据
references:
  - title: Mutating Data — Next.js（16.4，随 next 包附带的文档）
    url: https://nextjs.org/docs/app/getting-started/mutating-data
    checked: 2026-10-21
    note: 以 Next.js 16.4.2（React 19.3.0）为准；课中的实测项目由 create-next-app 16.4.2 生成
  - title: Server Actions and Mutations（Security、Choosing a cache update）— Next.js
    url: https://nextjs.org/docs/app/guides/server-actions
    checked: 2026-10-21
  - title: Forms — Next.js
    url: https://nextjs.org/docs/app/guides/forms
    checked: 2026-10-21
  - title: useActionState — React
    url: https://react.dev/reference/react/useActionState
    checked: 2026-10-21
  - title: FormData — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/API/FormData
    checked: 2026-10-21
---

## 要做什么

这一课回答四个问题：

1. Server Function 是什么，怎样从表单调用它；
2. 它为什么是一个公开的接口，Next.js 挡住了什么，你自己要做什么；
3. 怎样校验它收到的 `FormData`；
4. 怎样把校验的结果显示在表单上，写入之后怎样更新页面。

下面的结果都来自 2026-10-21 在本机运行的 Next.js 16.4.2 项目（`next build` 和 `next start`）中的一个待办页面。两个练习在浏览器中实现其中可以移植的两部分：校验 `FormData`，用 `useActionState` 显示结果。

## Server Function

写了 `'use server'` 的 async 函数是一个 **Server Function**：它的代码只在服务器上运行，但可以在浏览器中“调用”。作为表单的 action（或者在 `startTransition` 中）调用的 Server Function，文档中也叫 **Server Action**，报错信息和配置项（`serverActions`）用的是这个名字。`'use server'` 可以写在函数体的开头，也可以写在文件的开头（这个文件导出的每个函数都是 Server Function）。实测项目中的 `app/h05/actions.ts`：

```ts
'use server';
import { revalidatePath } from 'next/cache';
import { addTodo } from './_lib/store';

export async function plainAdd(formData: FormData) {
  const raw = formData.get('title');
  const title = typeof raw === 'string' ? raw.trim() : '';
  if (title !== '') addTodo(title);
  revalidatePath('/h05');
}
```

把它交给服务端组件中的表单：

```tsx
<form action={plainAdd}>
  <input name="title" aria-label="标题" />
  <button>添加</button>
</form>
```

浏览器收到的 HTML 中，这个表单变成了：

```html
<form action="" encType="multipart/form-data" method="POST">
  <input type="hidden" name="$ACTION_ID_40a4327107378d0d0cd0dde4c7da72dcbf643f9615"/>
  <input aria-label="标题" name="title"/><button>添加</button>
</form>
```

函数的代码没有发给浏览器，发过去的只是一个**动作 ID**。提交表单就是向当前的地址发一个 POST 请求，带上这个 ID 和表单中的字段，服务器据此找到并运行对应的函数。所以它在**没有 JavaScript** 时也能工作：实测用 curl 按这个表单的格式提交（相当于浏览器关闭了 JavaScript），返回 200 和一个新的 HTML 页面，列表中已经有了新的待办。有 JavaScript 时，React 拦下提交，自己发出一个 POST 请求（格式不同，同样发到当前的地址），不刷新页面。

客户端组件不能定义 Server Function，但可以从写了 `'use server'` 的文件中导入它，或者从 props 收到它（h03 中能传给客户端组件的函数只有 Server Function）。

## 它是一个公开的接口

“在浏览器中调用”的意思是：任何能发 HTTP 请求的程序都能调用它。实测：

| 请求 | 结果 |
| --- | --- |
| 带 `Origin: http://localhost:3004`（和页面同源，浏览器会自动带上） | 200，待办被添加 |
| **不带** `Origin`（curl、脚本） | 200，待办被添加；服务器只打印了一条警告：缺少 `origin` 请求头 |
| 带 `Origin: https://evil.example` | 500，函数没有运行；日志说 `origin` 和 `x-forwarded-host` 不一致，放弃了这个请求（Aborting the action），并报 `Invalid Server Actions request.` |

第三行是 Next.js 的 **CSRF 检查**：别的网站中的表单不能让访问者的浏览器替它提交（浏览器会带上那个网站的 `Origin`）。第二行说明这个检查挡不住直接发请求的程序。Next.js 在框架层面还做了这些：

- 请求体默认最大 1 MB（`serverActions.bodySizeLimit` 可以调整）；
- 动作 ID 在构建时加密，没有被使用的 Server Function 不会有对应的 ID；内联的 Server Function 捕获的变量在发给浏览器之前加密（不要只靠这种加密保护敏感的值；部署多个实例时要让它们共用同一个 `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`，h08）。

另外，浏览器中的 Next.js 一次只发出一个 Server Function 的请求，后面的排队，所以在浏览器中用 `Promise.all` 同时调用几个也不会并行。这是客户端的行为，**服务器并不排队**：直接发请求的程序可以同时发很多个。

剩下的是你的事，**每个** Server Function 中都要做：

- **认证和授权**：确认是谁在调用，他有没有权限做这件事。“只有登录的用户才能看到这个表单”不是保护：请求可以不经过表单发来（h09）；
- **校验输入**：`FormData`、参数中的每个值都可能是任何东西（练习一）；
- **不要相信客户端说的“是谁的”**：客户端可以告诉你“改哪一条”（一个 id），但“这一条属于谁”要用会话中的用户重新查，`ownerId` 这样的字段不能来自表单；
- **限制返回值**：返回值会发给浏览器，只返回界面需要的字段，不要把整条数据库记录返回出去；
- **上一次的状态也来自浏览器**：用 `useActionState` 时，Server Function 收到的第一个参数（上一次的状态）是浏览器随表单一起发来的（实测客户端组件中的表单有一个隐藏字段带着它）。它和 `FormData` 一样不可信，不要把用户的 id、权限这类东西放进状态里再拿来使用。

## 校验 FormData

`FormData` 有几个和普通对象不同的地方：

- `formData.get(name)` 的类型是 `string | File | null`：字段可能不存在，也可能是一个上传的文件（任何人都可以把一个文本字段换成文件发来）；
- 同名的字段可以有很多个（多选框、多个标签），`get` 只返回第一个，`getAll` 返回全部；
- 复选框选中时发送 `on`（或者它的 `value`），**没有选中时根本不发送**；
- 文本字段的值都是字符串：数字、日期都要自己解析和检查；
- 没有 JavaScript 时提交的表单中，还有 Next.js 自己的 `$ACTION_…` 字段：这也是“只取认识的字段”的一个理由。

:::playground{#form-data}
```ts file=main.ts
const form = new FormData();
form.append('title', '买牛奶');
form.append('tags', 'a');
form.append('tags', 'c');
form.append('avatar', new File(['...'], 'me.png', { type: 'image/png' }));

console.log(form.get('tags'), form.getAll('tags'));
console.log(form.get('done'), form.has('done'));

const avatar = form.get('avatar');
console.log(typeof avatar, avatar instanceof File);
console.log(String(avatar), String(form.get('missing')));
```
- 第 7 行：`get` 只得到第一个 `'a'`，`getAll` 得到 `['a', 'c']`；
- 第 8 行：没有选中的复选框就是没有这个字段：`null` 和 `false`；
- 第 11、12 行：文件的 `typeof` 是 `'object'`；用 `String()` 读字段，文件变成了 `'[object File]'`，缺少的字段变成了 `'null'`，两个都会被当成“有内容的文本”。
:::

真实的项目中常用 Zod 这样的库描述规则（e06 讲过运行时校验），但上面这些 `FormData` 的特点仍然要先处理好。

::exercise{#todo-form-data}

## 把结果告诉表单：useActionState

校验失败时，要把错误显示在表单上。表单所在的组件写成客户端组件，用 React 的 `useActionState`：

```tsx
'use client';
import { useActionState } from 'react';
import { addTodoAction, type FormState } from '../actions';

const initial: FormState = { status: 'idle', message: '', title: '' };

export function ClientForm() {
  const [state, formAction, pending] = useActionState(addTodoAction, initial);
  return (
    <form action={formAction}>
      <input name="title" aria-label="标题" defaultValue={state.title} />
      <input name="note" aria-label="备注" />
      <button disabled={pending}>{pending ? '保存中…' : '保存'}</button> {/* 练习二中改用 aria-disabled，原因见那里 */}
      <p role="status">{state.message}</p>
    </form>
  );
}
```

这时 Server Function 的签名变成 `(previousState, formData) => Promise<State>`：第一个参数是上一次返回的状态，返回的新状态就是下一次渲染时的 `state`。实测项目中，`addTodoAction` 在标题超过 20 个字时返回 `{ status: 'error', message: '标题最多 20 个字', title: 用户提交的标题 }`。在浏览器中输入一个太长的标题和一段备注，提交：

- 状态显示“标题最多 20 个字”；
- **备注被清空了**，标题还在。

原因是 React 19 在 action **成功完成**（没有抛出异常）之后会**重置表单**，不受控的输入框回到它的 `defaultValue`。这只发生在把函数交给 `<form action>` 的时候，用 `onSubmit` 自己处理提交不会。备注没有 `defaultValue`，回到了空的；标题的 `defaultValue` 是 action 返回的 `state.title`，所以保留了用户输入的内容。需要在出错之后保留的字段，都要让 action 把值放进返回的状态。

输入一个正常的标题再提交：状态显示“已添加：买牛奶”，标题被清空，下面的列表中多了这一条。浏览器的网络记录中只有这一个 POST 请求，没有再请求一次页面：`revalidatePath('/h05')` 让 Next.js 在同一个响应中带上了重新渲染的页面。

## 写入之后：让页面显示新的数据

h04 中缓存的数据，写入之后要失效。在 Server Function 中有几种选择：

| 调用 | 效果 | 当前页面在同一个响应中重新渲染 |
| --- | --- | --- |
| `updateTag(tag)` | 这个标签的缓存立刻过期，下一次读取等新的数据（读到自己的写入） | 是 |
| `revalidateTag(tag, 'max')` | 标记为变旧，之后的读取先拿到旧的、后台刷新 | **否** |
| `revalidatePath('/posts')` | 按地址失效 | 是 |
| `refresh()` | 不让缓存失效，只是重新渲染当前页面 | 是 |
| `redirect('/posts/1')` | 跳转到另一个页面 | 跳转并带上目标页面 |

`redirect` 从 `next/navigation` 导入，它是通过抛出一个特殊的异常实现的：它后面的代码不会运行，所以要失效的缓存写在 `redirect` 之前；也不要把它写在 `try` 中，否则这个异常会被 `catch` 接住（h06）。`updateTag` 和 `refresh` 只能在 Server Function 中调用（都从 `next/cache` 导入），`revalidateTag`、`revalidatePath` 在 Route Handler 中也可以。

还有一个部署时的问题：动作 ID 是构建的一部分，新的部署通常会生成新的 ID。用户的页面还停留在旧的版本时提交表单，会得到 “Failed to find Server Action” 的错误；界面上应该提示用户刷新，而不是直接失败。

## 编程挑战

::exercise{#action-form}

::quiz

## 常见错误

- **以为只有自己的页面会调用 Server Function**：它是一个公开的 POST 接口，实测不带 `Origin` 的请求照样能运行它。每个函数中都要认证、授权、校验。
- **用 `String(formData.get('x'))` 读取字段**：文件变成了 `'[object File]'`，缺少的字段变成了 `'null'`。
- **用 `get` 读取同名的多个字段**：只得到第一个，用 `getAll`。
- **把整个 `FormData` 交给数据库**：客户端多发的字段（`ownerId`、`role`）也被写了进去。
- **出错之后用户输入的内容不见了**：React 在提交之后重置了表单。让 action 返回需要显示的值，作为 `defaultValue`。
- **写入之后用 `revalidateTag` 期待页面马上更新**：它不会让当前页面在同一个响应中重新渲染，用 `updateTag` 或 `revalidatePath`。
- **在 `redirect` 之后失效缓存**：`redirect` 之后的代码不会运行。

## 下一步

h06 讲服务端的错误处理：Server Function 和 Route Handler 中的错误怎样变成用户能理解的结果，哪些错误信息不能发给浏览器。
