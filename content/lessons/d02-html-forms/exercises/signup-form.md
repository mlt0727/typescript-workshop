---
kind: task
title: 修好注册表单
---
起始的注册表单能显示，但几乎每个控件都有问题。修改 `index.html`，让它满足：

1. **邮箱**：标签文字是“邮箱”，检查邮箱格式，必填，`name` 是 `email`；
2. **密码**：标签文字是“密码”，输入内容被遮住，至少 8 个字符，必填，`name` 是 `password`；
3. **学习方向**：一组名为“学习方向”的单选按钮：“前端”（值 `frontend`）和“全栈”（值 `fullstack`），`name` 都是 `track`，默认选中“前端”；
4. **同意协议**：一个复选框，标签文字是“我已阅读并同意用户协议”，必须勾选，`name` 是 `agree`，值是 `yes`；
5. “注册”是这个表单的提交按钮。

只用 HTML 属性完成验证，不需要写 TypeScript。测试会模拟用户填写并提交表单，检查浏览器收集到的表单数据。

:::files{role=starter}
```html file=index.html
<!doctype html>
<html lang="zh-CN">
  <body>
    <form id="signup">
      <p><input type="text" placeholder="邮箱" /></p>
      <p>密码 <input type="text" /></p>
      <p>
        学习方向：
        <input type="radio" name="track1" value="frontend" /> 前端
        <input type="radio" name="track2" value="fullstack" /> 全栈
      </p>
      <p><input type="checkbox" /> 我已阅读并同意用户协议</p>
      <div class="button">注册</div>
    </form>
  </body>
</html>
```
:::

:::files{role=solution}
```html file=index.html
<!doctype html>
<html lang="zh-CN">
  <body>
    <form id="signup">
      <p>
        <label for="email">邮箱</label>
        <input id="email" type="email" name="email" required />
      </p>
      <p>
        <label for="password">密码</label>
        <input id="password" type="password" name="password" minlength="8" required />
      </p>
      <fieldset>
        <legend>学习方向</legend>
        <label><input type="radio" name="track" value="frontend" checked /> 前端</label>
        <label><input type="radio" name="track" value="fullstack" /> 全栈</label>
      </fieldset>
      <p>
        <label><input type="checkbox" name="agree" value="yes" required /> 我已阅读并同意用户协议</label>
      </p>
      <button type="submit">注册</button>
    </form>
  </body>
</html>
```
:::

:::files{role=tests}
```ts file=form.test.ts
import { expect, test } from 'vitest';
import { screen, within } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';

function theForm(): HTMLFormElement {
  const form = document.querySelector('form');
  if (!(form instanceof HTMLFormElement)) throw new Error('找不到表单');
  return form;
}

function inputLabelled(label: string): HTMLInputElement {
  const el = screen.getByLabelText(label);
  if (!(el instanceof HTMLInputElement)) throw new Error(`“${label}”不是 <input>`);
  return el;
}

test('邮箱：有标签、必填、检查格式', async () => {
  const user = userEvent.setup();
  const email = inputLabelled('邮箱');
  expect(email).toHaveAttribute('name', 'email');
  expect(email).toBeRequired();
  expect(email).toBeInvalid();
  await user.type(email, 'abc');
  expect(email.validity.typeMismatch).toBe(true);
  await user.clear(email);
  await user.type(email, 'ada@example.com');
  expect(email).toBeValid();
});

test('密码：内容被遮住，至少 8 个字符，必填', () => {
  const password = inputLabelled('密码');
  expect(password).toHaveAttribute('type', 'password');
  expect(password).toHaveAttribute('name', 'password');
  expect(password).toHaveAttribute('minlength', '8');
  expect(password).toBeRequired();
});

test('学习方向：一组单选按钮，默认选中前端，只能选一个', async () => {
  const user = userEvent.setup();
  const group = screen.getByRole('group', { name: '学习方向' });
  const frontend = within(group).getByRole('radio', { name: '前端' });
  const fullstack = within(group).getByRole('radio', { name: '全栈' });
  expect(frontend).toBeChecked();
  await user.click(fullstack);
  expect(fullstack).toBeChecked();
  expect(frontend).not.toBeChecked();
});

test('同意协议：必须勾选的复选框', () => {
  const agree = screen.getByRole('checkbox', { name: '我已阅读并同意用户协议' });
  expect(agree).toBeRequired();
  expect(agree).toHaveAttribute('name', 'agree');
});

test('“注册”提交表单；必填项没填时浏览器不提交', async () => {
  const user = userEvent.setup();
  const submissions: Record<string, FormDataEntryValue>[] = [];
  const form = theForm();
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    submissions.push(Object.fromEntries(new FormData(form)));
  });
  const button = screen.getByRole('button', { name: '注册' });
  expect(form).toContainElement(button);

  await user.click(button);
  expect(submissions).toHaveLength(0);

  await user.type(inputLabelled('邮箱'), 'ada@example.com');
  await user.type(inputLabelled('密码'), 'correct-horse');
  await user.click(screen.getByRole('radio', { name: '全栈' }));
  await user.click(screen.getByRole('checkbox', { name: '我已阅读并同意用户协议' }));
  await user.click(button);
  expect(submissions).toEqual([{ email: 'ada@example.com', password: 'correct-horse', track: 'fullstack', agree: 'yes' }]);
});
```
:::

:::hint{level=1}
每个输入框都需要一个关联的 `<label>`（`for` 指向 `id`，或者把输入框放进 `<label>` 里）。两个单选按钮要用**同一个** `name` 才是一组；整组放进 `<fieldset>`，用 `<legend>学习方向</legend>` 命名。
:::

:::hint{level=2}
邮箱用 `type="email" required`；密码用 `type="password" minlength="8" required`；默认选中用 `checked`；复选框写上 `name="agree" value="yes" required`。最后把 `<div class="button">` 换成 `<button type="submit">注册</button>`（写不写 `type="submit"` 都可以，这是默认值）。
:::

:::explanation
修改之后，大部分规则都由浏览器负责：

- 空的必填项、格式不对的邮箱、太短的密码、没勾选的协议，都会让浏览器拒绝提交，并提示用户；
- 同名的单选按钮自动互斥，`fieldset` 和 `legend` 让屏幕阅读器读出“学习方向，组”；
- `label` 让每个控件有了名字，测试中的 `getByLabelText` 和 `getByRole(…, { name })` 也因此能找到它们。

最后一个测试展示了提交时浏览器收集的数据：每个控件的 `name` 是键，`value` 是值。复选框如果不写 `value`，勾选后提交的是 `"on"`。

注意密码的“至少 8 个字符”：浏览器只在用户亲手输入之后才按 `minlength` 报告“太短”，用脚本给 `value` 赋值不算，所以测试只检查了这个属性。
:::

:::variant{kind=alt name=wrapping-labels-and-input-submit}
```html file=index.html
<!doctype html>
<html lang="zh-CN">
  <body>
    <form id="signup">
      <label>邮箱 <input type="email" name="email" required autocomplete="email" /></label>
      <label>密码 <input type="password" name="password" minlength="8" required autocomplete="new-password" /></label>
      <fieldset>
        <legend>学习方向</legend>
        <label><input type="radio" name="track" value="frontend" checked /> 前端</label>
        <label><input type="radio" name="track" value="fullstack" /> 全栈</label>
      </fieldset>
      <input id="agree" type="checkbox" name="agree" value="yes" required />
      <label for="agree">我已阅读并同意用户协议</label>
      <input type="submit" value="注册" />
    </form>
  </body>
</html>
```
:::

:::variant{kind=wrong name=placeholder-as-label fails=tests reason="邮箱只有 placeholder，没有标签"}
```html file=index.html
<!doctype html>
<html lang="zh-CN">
  <body>
    <form id="signup">
      <p><input type="email" name="email" placeholder="邮箱" required /></p>
      <p>
        <label for="password">密码</label>
        <input id="password" type="password" name="password" minlength="8" required />
      </p>
      <fieldset>
        <legend>学习方向</legend>
        <label><input type="radio" name="track" value="frontend" checked /> 前端</label>
        <label><input type="radio" name="track" value="fullstack" /> 全栈</label>
      </fieldset>
      <p>
        <label><input type="checkbox" name="agree" value="yes" required /> 我已阅读并同意用户协议</label>
      </p>
      <button type="submit">注册</button>
    </form>
  </body>
</html>
```
:::

:::variant{kind=wrong name=email-as-text fails=tests reason="邮箱用了 type=text，不检查格式"}
```html file=index.html
<!doctype html>
<html lang="zh-CN">
  <body>
    <form id="signup">
      <p>
        <label for="email">邮箱</label>
        <input id="email" type="text" name="email" required />
      </p>
      <p>
        <label for="password">密码</label>
        <input id="password" type="password" name="password" minlength="8" required />
      </p>
      <fieldset>
        <legend>学习方向</legend>
        <label><input type="radio" name="track" value="frontend" checked /> 前端</label>
        <label><input type="radio" name="track" value="fullstack" /> 全栈</label>
      </fieldset>
      <p>
        <label><input type="checkbox" name="agree" value="yes" required /> 我已阅读并同意用户协议</label>
      </p>
      <button type="submit">注册</button>
    </form>
  </body>
</html>
```
:::

:::variant{kind=wrong name=separate-radio-names fails=tests reason="两个单选按钮的 name 不同，不是一组，可以同时选中"}
```html file=index.html
<!doctype html>
<html lang="zh-CN">
  <body>
    <form id="signup">
      <p>
        <label for="email">邮箱</label>
        <input id="email" type="email" name="email" required />
      </p>
      <p>
        <label for="password">密码</label>
        <input id="password" type="password" name="password" minlength="8" required />
      </p>
      <fieldset>
        <legend>学习方向</legend>
        <label><input type="radio" name="frontend" value="frontend" checked /> 前端</label>
        <label><input type="radio" name="fullstack" value="fullstack" /> 全栈</label>
      </fieldset>
      <p>
        <label><input type="checkbox" name="agree" value="yes" required /> 我已阅读并同意用户协议</label>
      </p>
      <button type="submit">注册</button>
    </form>
  </body>
</html>
```
:::

:::variant{kind=wrong name=button-not-submit fails=tests reason="“注册”写成了 type=button，不会提交表单"}
```html file=index.html
<!doctype html>
<html lang="zh-CN">
  <body>
    <form id="signup">
      <p>
        <label for="email">邮箱</label>
        <input id="email" type="email" name="email" required />
      </p>
      <p>
        <label for="password">密码</label>
        <input id="password" type="password" name="password" minlength="8" required />
      </p>
      <fieldset>
        <legend>学习方向</legend>
        <label><input type="radio" name="track" value="frontend" checked /> 前端</label>
        <label><input type="radio" name="track" value="fullstack" /> 全栈</label>
      </fieldset>
      <p>
        <label><input type="checkbox" name="agree" value="yes" required /> 我已阅读并同意用户协议</label>
      </p>
      <button type="button">注册</button>
    </form>
  </body>
</html>
```
:::

:::variant{kind=wrong name=checkbox-without-value fails=tests reason="复选框没有写 value，提交的值是 on"}
```html file=index.html
<!doctype html>
<html lang="zh-CN">
  <body>
    <form id="signup">
      <p>
        <label for="email">邮箱</label>
        <input id="email" type="email" name="email" required />
      </p>
      <p>
        <label for="password">密码</label>
        <input id="password" type="password" name="password" minlength="8" required />
      </p>
      <fieldset>
        <legend>学习方向</legend>
        <label><input type="radio" name="track" value="frontend" checked /> 前端</label>
        <label><input type="radio" name="track" value="fullstack" /> 全栈</label>
      </fieldset>
      <p>
        <label><input type="checkbox" name="agree" required /> 我已阅读并同意用户协议</label>
      </p>
      <button type="submit">注册</button>
    </form>
  </body>
</html>
```
:::
