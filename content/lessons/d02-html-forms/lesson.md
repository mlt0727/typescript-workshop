---
version: 1
mode: dom
estimatedMinutes: 40
review: self-reviewed
problem: 登录、注册、搜索、设置——网页上的大部分输入都通过表单完成。HTML 已经为表单提供了大量现成的能力：点击文字就能聚焦输入框的 label、各种类型的输入控件、提交与重置按钮、不用写一行代码的格式验证。用对这些元素，表单就天然可以用键盘操作、能被屏幕阅读器理解，后面用 TypeScript 处理表单时也会简单得多。
objectives:
  - 用 label 为每个控件提供名字，知道 placeholder 不能代替 label
  - 选择合适的控件：text、email、password、number、checkbox、radio、select、textarea，并用 fieldset 和 legend 为一组控件命名
  - 区分按钮的三种 type：submit、reset、button
  - 使用浏览器自带的验证（required、minlength、min/max、pattern、type），知道提交时 name 和 value 如何组成表单数据
references:
  - title: Your first form — MDN Learn web development
    url: https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Forms/Your_first_form
    checked: 2026-10-20
  - title: "<input>: The HTML Input element — MDN"
    url: https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input
    checked: 2026-10-20
  - title: "<label>: The Label element — MDN"
    url: https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/label
    checked: 2026-10-20
  - title: Client-side form validation — MDN Learn web development
    url: https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Forms/Form_validation
    checked: 2026-10-20
  - title: FormData — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/API/FormData
    checked: 2026-10-20
---

## label：每个控件都要有名字

`<label>` 把一段文字和一个控件关联起来。关联的方式有两种：用 `for` 属性写出控件的 `id`，或者把控件直接放在 `<label>` 里面。关联之后：

- 点击标签文字，控件就获得焦点（复选框会被勾选），点击区域更大；
- 标签文字成为控件的**可访问名称**，屏幕阅读器会读出“邮箱，编辑框”；
- 测试可以用 `getByLabelText('邮箱')` 找到它。

`placeholder`（输入框里的浅色提示文字）**不能代替** label：用户一开始输入，它就消失了；它的颜色通常对比度很低；浏览器只在没有其他名字时，才把它当作最后的备选名字，各种屏幕阅读器的处理也不一致；Testing Library 的 `getByLabelText` 和 `getByRole(…, { name })` 则完全不认它。

:::playground{#labels}
```html file=index.html
<!doctype html>
<html lang="zh-CN">
  <head>
    <link rel="stylesheet" href="./style.css" />
  </head>
  <body>
    <form>
      <p>
        <label for="email">邮箱</label>
        <input id="email" type="email" name="email" />
      </p>
      <p>
        <label>
          昵称
          <input type="text" name="nickname" />
        </label>
      </p>
      <p>
        <input type="text" name="city" placeholder="城市" />
      </p>
      <p>
        <label>
          <input type="checkbox" name="newsletter" />
          订阅每周更新
        </label>
      </p>
    </form>
  </body>
</html>
```
```css file=style.css
label { cursor: pointer; }
input:focus { outline: 3px solid #0a6cff; }
```
- 点击“邮箱”或“昵称”这两个字，对应的输入框获得焦点；点击“订阅每周更新”，复选框切换勾选状态。
- `index.html` 第 19 行只有 `placeholder`：在框里输入一个字，提示就消失了，用户再也看不到这个框是填什么的。
:::

## 常用的控件

| 控件 | 写法 | 说明 |
| --- | --- | --- |
| 单行文字 | `<input type="text">` | 默认类型 |
| 邮箱、网址、电话 | `type="email"`、`"url"`、`"tel"` | 手机上会显示对应的键盘；`email` 和 `url` 还会检查格式 |
| 密码 | `type="password"` | 输入内容被遮住 |
| 数字 | `type="number"` | 可以用 `min`、`max`、`step` 限制 |
| 复选框 | `type="checkbox"` | 每个独立地勾选或不勾选 |
| 单选按钮 | `type="radio"` | **`name` 相同**的一组中只能选一个 |
| 下拉选择 | `<select>` 和 `<option>` | |
| 多行文字 | `<textarea>` | |

一组相关的控件（尤其是单选按钮和复选框）放在 `<fieldset>` 里，用 `<legend>` 给这一组起名字。屏幕阅读器会先读出组名，例如“学习方向，组；前端，单选按钮”。

每个控件的 `name` 属性决定了提交时这项数据的**键**，`value` 是值。单选按钮和复选框的 `value` 要自己写出来，否则勾选后提交的值是字符串 `"on"`。

收集用户个人信息的输入框，还应该写上 `autocomplete` 属性说明它的用途，例如 `autocomplete="email"`、`"name"`、`"new-password"`（注册时的新密码）、`"current-password"`（登录时的密码）。浏览器和密码管理器据此自动填写，这也是 WCAG 2.2 的要求之一。

:::playground{#controls}
```html file=index.html
<!doctype html>
<html lang="zh-CN">
  <body>
    <form id="profile">
      <p><label for="name">姓名</label> <input id="name" name="name" value="Ada" /></p>
      <fieldset>
        <legend>学习方向</legend>
        <label><input type="radio" name="track" value="frontend" checked /> 前端</label>
        <label><input type="radio" name="track" value="fullstack" /> 全栈</label>
      </fieldset>
      <fieldset>
        <legend>感兴趣的主题</legend>
        <label><input type="checkbox" name="topics" value="types" checked /> 类型系统</label>
        <label><input type="checkbox" name="topics" value="react" /> React</label>
        <label><input type="checkbox" name="topics" value="testing" checked /> 测试</label>
      </fieldset>
      <p>
        <label for="level">水平</label>
        <select id="level" name="level">
          <option value="beginner">入门</option>
          <option value="intermediate" selected>进阶</option>
        </select>
      </p>
      <p><label for="note">备注</label><br /><textarea id="note" name="note" rows="2"></textarea></p>
      <button>提交</button>
      <button type="reset">恢复默认</button>
    </form>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```
```ts file=main.ts
const form = document.querySelector('#profile');
if (!(form instanceof HTMLFormElement)) throw new Error('缺少 #profile 表单');

form.addEventListener('submit', (event) => {
  event.preventDefault();
  console.log('--- 提交的数据 ---');
  for (const [name, value] of new FormData(form)) {
    console.log(name, '=', value);
  }
});
```
- 点击“提交”，看输出：每一项都是“`name` = `value`”。两个勾选的复选框同名，所以 `topics` 出现了两次；没有勾选的复选框根本不会出现；而空着的“备注”会出现，值是空字符串（`note =`）。
- 改几个选项再提交一次。然后点击“恢复默认”：所有控件回到页面加载时的状态（`checked`、`selected`、`value` 属性指定的初始值）。
- `main.ts` 中的 `event.preventDefault()` 阻止了浏览器默认的提交行为（把数据发送出去并跳转页面）。处理表单事件的细节在 d09 讲。
:::

## 按钮的 type

`<button>` 有三种 `type`：

- `submit`：提交所在的表单。**这是默认值**：表单里没写 `type` 的按钮都是提交按钮；
- `reset`：把表单恢复成初始值；
- `button`：什么都不做，只用来配合脚本。

所以表单里“预览”“添加一行”这类按钮一定要写 `type="button"`，否则点击它就会提交表单。另外，在单行输入框里按 Enter，通常也会提交表单（相当于点击第一个提交按钮）。

## 浏览器自带的验证

不写任何代码，HTML 属性就能描述大部分输入规则：

| 属性 | 含义 |
| --- | --- |
| `required` | 必须填写（复选框必须勾选） |
| `minlength`、`maxlength` | 文字长度范围 |
| `min`、`max`、`step` | 数字（和日期）的范围与步长 |
| `pattern` | 整个值必须匹配这个正则表达式 |
| `type="email"`、`type="url"` | 值必须符合格式（空值除外，空值由 `required` 管） |

提交时，浏览器先检查所有控件。有不合格的，就**不会提交**（也不会触发 `submit` 事件），而是聚焦第一个不合格的控件并显示提示。CSS 可以用 `:invalid` 和 `:user-invalid` 选中不合格的控件（CSS 选择器的写法在 d03 讲）；后者只在用户修改过、或者尝试提交之后才生效，不会一打开页面就满屏红框。

:::playground{#validation}
```html file=index.html
<!doctype html>
<html lang="zh-CN">
  <head>
    <link rel="stylesheet" href="./style.css" />
  </head>
  <body>
    <form id="signup">
      <p><label for="email">邮箱</label> <input id="email" name="email" type="email" required /></p>
      <p><label for="age">年龄</label> <input id="age" name="age" type="number" min="12" max="120" /></p>
      <p>
        <label for="code">邀请码（4 位数字）</label>
        <input id="code" name="code" pattern="[0-9]{4}" />
      </p>
      <button>注册</button>
    </form>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```
```css file=style.css
input:user-invalid { border: 2px solid #c62828; }
```
```ts file=main.ts
const form = document.querySelector('#signup');
if (!(form instanceof HTMLFormElement)) throw new Error('缺少 #signup 表单');

form.addEventListener(
  'invalid',
  (event) => {
    if (event.target instanceof HTMLInputElement) {
      console.log(`${event.target.name} 不合格：${event.target.validationMessage}`);
    }
  },
  true,
);

form.addEventListener('submit', (event) => {
  event.preventDefault();
  console.log('通过验证，提交：', Object.fromEntries(new FormData(form)));
});
```
- 直接点“注册”：邮箱是必填的，表单没有提交，输出显示哪一项不合格以及浏览器给出的原因（提示文字的语言取决于浏览器）。
- 依次试试：邮箱填 `abc`；年龄填 `5`；邀请码填 `12a4`。最后填一组合格的值再提交。
- `main.ts` 第 4–12 行监听 `invalid` 事件。它不会冒泡，所以要在捕获阶段（第三个参数 `true`）监听，冒泡与捕获在 d08 讲。
:::

浏览器验证是为了**用户体验**：及时告诉用户哪里填错了。它不是安全措施：任何人都可以绕过网页直接发送请求，服务端必须重新验证所有数据（H 阶段）。

::exercise{#signup-form}

## 编程挑战

::exercise{#settings-form}

::quiz

## 常见错误

- **用 placeholder 代替 label**：输入后提示消失，也不能可靠地充当控件的名字。
- **表单里的普通按钮忘了写 `type="button"`**：点击就会提交表单。
- **单选按钮的 `name` 不一样**：它们就不是一组，可以同时选中多个。
- **控件没有 `name`**：提交时这一项不会出现在表单数据里。
- **只依赖浏览器验证**：它能被绕过，服务端必须再验证一次。

## 下一步

下一课讲 CSS 布局：Flexbox 与 Grid。
