---
version: 1
mode: dom
estimatedMinutes: 45
review: self-reviewed
problem: 浏览器自带的表单验证（d02）能处理“必填”“格式”这类简单规则，但真实的表单还需要更多：两次输入的密码要一致、年龄要转换成数字、错误提示要用自己的文案显示在合适的位置。这一课用 TypeScript 接管表单：把 FormData 中类型不确定的值解析成明确的类型，把“成功或失败”表示成可辨识联合，再把错误以可访问的方式显示出来。
objectives:
  - 从 FormData 读取值，处理 FormDataEntryValue（string | File）和 null
  - 把表单解析成“成功的数据或错误列表”的可辨识联合，而不是到处传递可能不合法的值
  - 使用约束验证 API：validity、setCustomValidity、checkValidity
  - 用 novalidate 接管错误显示：aria-invalid、aria-describedby、聚焦第一个错误、状态提示
references:
  - title: FormData — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/API/FormData
    checked: 2026-10-20
  - title: Client-side form validation（Validating forms using JavaScript）— MDN Learn web development
    url: https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Forms/Form_validation
    checked: 2026-10-20
  - title: HTMLInputElement.setCustomValidity() — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/setCustomValidity
    checked: 2026-10-20
  - title: aria-invalid — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-invalid
    checked: 2026-10-20
---

## 从 FormData 读取值

`new FormData(form)` 收集表单中所有带 `name` 的控件（d02）。读取时：

- `data.get(name)` 的类型是 `FormDataEntryValue | null`，其中 `FormDataEntryValue` 是 `string | File`（文件上传控件的值是 `File`）；没有这个名字时是 `null`；
- `data.getAll(name)` 返回数组，用于同名的多个复选框；
- 所有值都是**字符串**（或文件）：数字输入框的值也是字符串 `"18"`，没填时是空字符串 `""`。

所以从表单拿到的值，类型上要先确认是 `string`，再转换、再检查。可以写一个小函数统一处理：

:::playground{#formdata}
```html file=index.html
<!doctype html>
<html lang="zh-CN">
  <body>
    <form id="profile">
      <p><label>昵称 <input name="name" value="  Ada  " /></label></p>
      <p><label>年龄 <input name="age" type="number" value="36" /></label></p>
      <p><label>头像 <input name="avatar" type="file" /></label></p>
      <button type="submit">提交</button>
    </form>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```
```ts file=main.ts
function text(data: FormData, name: string): string {
  const value = data.get(name);
  return typeof value === 'string' ? value.trim() : '';
}

const form = document.querySelector('#profile');
if (!(form instanceof HTMLFormElement)) throw new Error('缺少 #profile');

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const data = new FormData(form);
  console.log('age 的原始值：', data.get('age'), typeof data.get('age'));
  console.log('avatar 的原始值是 File 吗？', data.get('avatar') instanceof File);
  console.log('不存在的字段：', data.get('nickname'));

  const age = Number(text(data, 'age'));
  console.log('昵称：', JSON.stringify(text(data, 'name')), '年龄：', age);
});
```
- 点击“提交”：`age` 是字符串 `'36'`；没有选择文件时，`avatar` 的值是一个空的 `File` 对象，而不是 `null`。
- 第 1–4 行：`text` 把 `FormDataEntryValue | null` 统一变成去掉首尾空白的字符串，文件和缺失的字段都当作空字符串。
- 把年龄清空再提交：`Number('')` 是 `0`，而不是“没填”。转换数字之前要先检查空字符串，挑战题会处理这个问题。
- 再在年龄框里输入 `1e`（不是合法的数字）：`type="number"` 的输入框此时的值同样是空字符串 `""`。只看值无法区分“没填”和“填错”，需要时读取 `input.validity.badInput`。
:::

## 解析的结果：成功的数据，或者错误

不要把可能不合法的值一路传下去，再在各处检查。更好的做法是一个**解析函数**：输入是 `FormData`，输出要么是类型明确、已经验证过的数据，要么是每个字段的错误信息。用可辨识联合（b09）表示：

```ts
type SignupData = { name: string; email: string; age: number };
type Field = keyof SignupData;

type ParseResult =
  | { ok: true; value: SignupData }
  | { ok: false; errors: Partial<Record<Field, string>> };
```

调用方检查 `result.ok` 之后，TypeScript 就知道该读 `value` 还是 `errors`。`Partial<Record<Field, string>>` 表示“每个字段最多一条错误消息”（`Record` 见 b01，`Partial` 见 b03：合起来就是“键是这些字段、值是字符串、每个键都可以没有”）。

解析函数不碰 DOM，只处理数据，所以很容易测试：小任务就是写这样一个函数。

## 约束验证 API

HTML 属性的验证结果也可以在 TypeScript 中读取和扩展：

- `input.validity`：一组布尔值，例如 `valueMissing`、`typeMismatch`、`tooShort`、`rangeOverflow`、`customError`，以及总的 `valid`；
- `input.validationMessage`：浏览器生成的错误提示（语言取决于浏览器）；
- `input.setCustomValidity(消息)`：设置自定义错误，控件随之变为不合格；传空字符串 `''` 清除；
- `form.checkValidity()`：检查全部控件，返回布尔值；`form.reportValidity()` 还会显示浏览器的提示气泡。

`setCustomValidity` 适合 HTML 属性表达不了的规则，例如“两次密码一致”：

:::playground{#custom-validity}
```html file=index.html
<!doctype html>
<html lang="zh-CN">
  <body>
    <form id="password-form">
      <p><label>密码 <input id="password" type="password" minlength="8" required /></label></p>
      <p><label>确认密码 <input id="confirm" type="password" required /></label></p>
      <button type="submit">修改密码</button>
    </form>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```
```ts file=main.ts
const form = document.querySelector('#password-form');
const password = document.querySelector('#password');
const again = document.querySelector('#confirm');
if (!(form instanceof HTMLFormElement) || !(password instanceof HTMLInputElement) || !(again instanceof HTMLInputElement)) {
  throw new Error('页面结构不完整');
}

const checkMatch = (): void => {
  again.setCustomValidity(again.value === password.value ? '' : '两次输入的密码不一致');
};

password.addEventListener('input', checkMatch);
again.addEventListener('input', checkMatch);

form.addEventListener('submit', (event) => {
  event.preventDefault();
  console.log('提交成功');
});
```
- 两个框分别输入 `abcdefgh` 和 `abcdefgx`，点“修改密码”：浏览器拦下提交，在确认框旁显示“两次输入的密码不一致”。改成一致后再提交，输出“提交成功”。
- 第 8 行用箭头函数定义 `checkMatch`：它是一个函数**表达式**，在第 4 行的检查之后创建，可以直接使用已经收窄的 `again` 和 `password`。如果改用 `function checkMatch() { … }` **声明**，TypeScript 会认为它们仍是检查之前的 `Element | null`，报告“可能是 null”以及“`Element` 上没有 `value`”：函数声明会被提升到文件开头，可能在检查之前就被调用，所以 TypeScript 不把检查的结果带进去。
:::

## 接管错误显示

浏览器的提示气泡样式无法定制，位置和措辞也不一定合适。在 `<form>` 上加 `novalidate`，浏览器就不再拦截提交、不显示气泡（`validity` 仍然照常计算），由你自己决定怎么显示错误。自己显示错误时，要让所有用户都能感知（d04）：

- 错误文字显示在对应控件旁边，并用 `aria-describedby` 关联到控件；
- 不合格的控件设置 `aria-invalid="true"`，改正后移除；
- 提交失败后，把焦点移到**第一个**有错误的控件上，键盘和屏幕阅读器用户能立刻知道问题在哪；
- 提交成功等状态消息放在 `role="status"` 的元素里，屏幕阅读器会在内容变化时读出它，而不需要移动焦点。这个元素要在内容变化**之前**就已经在页面上（可以先是空的）；另外，连续两次设置相同的文字，屏幕阅读器可能不会重复朗读。

::exercise{#parse-signup}

## 编程挑战

::exercise{#signup-errors}

::quiz

## 常见错误

- **把 `data.get(…)` 的结果直接当字符串用**：它可能是 `File` 或 `null`。
- **`Number('')` 得到 0**：空输入要单独判断，否则“没填”会被当作 0。
- **到处传递未经验证的值**：在边界处解析一次，之后只使用解析得到的、类型明确的数据。
- **`setCustomValidity` 之后忘了清除**：控件会一直不合格。条件满足时要 `setCustomValidity('')`。
- **错误只用颜色表示、没有关联到控件**：用 `aria-invalid` 和 `aria-describedby`，并把焦点移到第一个错误上。

## 下一步

下一课把状态和界面分开：用一个状态对象描述界面应该是什么样，用一个渲染函数把状态画到页面上。
