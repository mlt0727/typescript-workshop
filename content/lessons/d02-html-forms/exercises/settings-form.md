---
kind: challenge
title: 推送设置表单
---
写一个“推送设置”表单（修改 `index.html`），包含下面的控件，所有控件都要有标签：

1. **推送频率**：下拉选择，选项依次是“每天”（`daily`）、“每周”（`weekly`）、“每月”（`monthly`），默认“每周”，`name` 是 `frequency`；
2. **每次最多推送**：数字输入框，必填，只能是 1 到 10 的整数，默认 5，`name` 是 `limit`；
3. **感兴趣的主题**：一组名为“感兴趣的主题”的复选框：“类型系统”（`types`）、“React”（`react`）、“测试”（`testing`），`name` 都是 `topics`，默认只勾选“类型系统”；
4. **备注**：多行文本框，最多 200 个字符，`name` 是 `note`；
5. 三个按钮：“保存”提交表单；“恢复默认”把所有控件恢复成默认值；“预览”现在什么都不做（以后会用脚本实现），但**绝不能提交表单**。

只用 HTML 完成，不需要写 TypeScript。

:::files{role=starter}
```html file=index.html
<!doctype html>
<html lang="zh-CN">
  <body>
    <form id="settings">
      <h1>推送设置</h1>
      <!-- 在这里写控件 -->
      <button>保存</button>
      <button>恢复默认</button>
      <button>预览</button>
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
    <form id="settings">
      <h1>推送设置</h1>
      <p>
        <label for="frequency">推送频率</label>
        <select id="frequency" name="frequency">
          <option value="daily">每天</option>
          <option value="weekly" selected>每周</option>
          <option value="monthly">每月</option>
        </select>
      </p>
      <p>
        <label for="limit">每次最多推送</label>
        <input id="limit" type="number" name="limit" min="1" max="10" step="1" value="5" required />
      </p>
      <fieldset>
        <legend>感兴趣的主题</legend>
        <label><input type="checkbox" name="topics" value="types" checked /> 类型系统</label>
        <label><input type="checkbox" name="topics" value="react" /> React</label>
        <label><input type="checkbox" name="topics" value="testing" /> 测试</label>
      </fieldset>
      <p>
        <label for="note">备注</label>
        <textarea id="note" name="note" maxlength="200"></textarea>
      </p>
      <button type="submit">保存</button>
      <button type="reset">恢复默认</button>
      <button type="button">预览</button>
    </form>
  </body>
</html>
```
:::

:::files{role=tests}
```ts file=settings.test.ts
import { expect, test } from 'vitest';
import { screen, within } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';

type Submission = { frequency: FormDataEntryValue | null; limit: FormDataEntryValue | null; topics: FormDataEntryValue[]; note: FormDataEntryValue | null };

function watchSubmissions(): Submission[] {
  const form = document.querySelector('form');
  if (!(form instanceof HTMLFormElement)) throw new Error('找不到表单');
  const submissions: Submission[] = [];
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(form);
    submissions.push({ frequency: data.get('frequency'), limit: data.get('limit'), topics: data.getAll('topics'), note: data.get('note') });
  });
  return submissions;
}

function limitInput(): HTMLInputElement {
  const el = screen.getByLabelText('每次最多推送');
  if (!(el instanceof HTMLInputElement)) throw new Error('“每次最多推送”不是 <input>');
  return el;
}

test('推送频率：下拉选择，默认每周', () => {
  const select = screen.getByLabelText('推送频率');
  expect(select.tagName).toBe('SELECT');
  expect(select).toHaveValue('weekly');
  const options = within(select).getAllByRole('option');
  expect(options.map((o) => [o.textContent, o.getAttribute('value')])).toEqual([
    ['每天', 'daily'],
    ['每周', 'weekly'],
    ['每月', 'monthly'],
  ]);
});

test('每次最多推送：1 到 10 的整数，默认 5，必填', async () => {
  const user = userEvent.setup();
  const limit = limitInput();
  expect(limit).toHaveAttribute('type', 'number');
  expect(limit).toHaveValue(5);
  expect(limit).toBeRequired();
  for (const [text, bad] of [
    ['11', 'rangeOverflow'],
    ['0', 'rangeUnderflow'],
    ['2.5', 'stepMismatch'],
  ] as const) {
    await user.clear(limit);
    await user.type(limit, text);
    expect(limit.validity[bad], `输入 ${text}`).toBe(true);
  }
  await user.clear(limit);
  await user.type(limit, '10');
  expect(limit).toBeValid();
});

test('感兴趣的主题：一组同名复选框，默认只勾选类型系统', () => {
  const group = screen.getByRole('group', { name: '感兴趣的主题' });
  const boxes = within(group).getAllByRole('checkbox');
  expect(boxes.map((b) => b.getAttribute('value'))).toEqual(['types', 'react', 'testing']);
  expect(boxes.every((b) => b.getAttribute('name') === 'topics')).toBe(true);
  expect(within(group).getByRole('checkbox', { name: '类型系统' })).toBeChecked();
  expect(within(group).getByRole('checkbox', { name: 'React' })).not.toBeChecked();
  expect(within(group).getByRole('checkbox', { name: '测试' })).not.toBeChecked();
});

test('备注：多行文本框，最多 200 个字符', () => {
  const note = screen.getByLabelText('备注');
  expect(note.tagName).toBe('TEXTAREA');
  expect(note).toHaveAttribute('maxlength', '200');
  expect(note).toHaveAttribute('name', 'note');
});

test('“预览”不提交表单，“保存”提交表单', async () => {
  const user = userEvent.setup();
  const submissions = watchSubmissions();
  await user.click(screen.getByRole('button', { name: '预览' }));
  expect(submissions).toHaveLength(0);

  await user.selectOptions(screen.getByLabelText('推送频率'), 'daily');
  await user.click(screen.getByRole('checkbox', { name: '测试' }));
  await user.type(screen.getByLabelText('备注'), '周末不要推送');
  await user.click(screen.getByRole('button', { name: '保存' }));
  expect(submissions).toEqual([{ frequency: 'daily', limit: '5', topics: ['types', 'testing'], note: '周末不要推送' }]);
});

test('“恢复默认”把所有控件恢复成默认值，不提交表单', async () => {
  const user = userEvent.setup();
  const submissions = watchSubmissions();
  await user.selectOptions(screen.getByLabelText('推送频率'), 'monthly');
  await user.clear(limitInput());
  await user.type(limitInput(), '8');
  await user.click(screen.getByRole('checkbox', { name: '类型系统' }));
  await user.click(screen.getByRole('checkbox', { name: 'React' }));
  await user.click(screen.getByRole('button', { name: '恢复默认' }));
  expect(screen.getByLabelText('推送频率')).toHaveValue('weekly');
  expect(limitInput()).toHaveValue(5);
  expect(screen.getByRole('checkbox', { name: '类型系统' })).toBeChecked();
  expect(screen.getByRole('checkbox', { name: 'React' })).not.toBeChecked();
  expect(submissions).toHaveLength(0);
});
```
:::

:::hint{level=1}
默认值写在 HTML 属性里：`<option selected>`、`<input value="5">`、`<input type="checkbox" checked>`。“恢复默认”恢复的正是这些属性指定的值。三个按钮的区别全在 `type` 属性上。
:::

:::hint{level=2}
数字框用 `type="number" min="1" max="10" value="5" required`（`number` 的默认步长就是 1，所以小数会被判为不合格；写上 `step="1"` 更清楚）。复选框组放进 `<fieldset>`，用 `<legend>感兴趣的主题</legend>` 命名。按钮分别是 `type="submit"`、`type="reset"`、`type="button"`。
:::

:::explanation
这道题的关键在按钮：`<button>` 的 `type` 默认是 `submit`，起始代码中的三个按钮点击后都会提交表单。“预览”这样留给脚本的按钮必须写 `type="button"`；`type="reset"` 不需要任何代码，就能把表单恢复成 HTML 属性中写的初始值。

默认值写在属性里（`selected`、`value`、`checked`），而不是靠脚本在页面加载后设置：这样“恢复默认”自然就恢复到这些值，页面在脚本加载完成之前也已经显示了正确的状态。

数字框的范围和步长由浏览器检查：`11` 超出上限（`rangeOverflow`），`0` 低于下限（`rangeUnderflow`），`2.5` 不符合步长（`stepMismatch`）。同名的复选框在提交时会产生多个同名的项，所以测试用 `FormData` 的 `getAll('topics')` 读取它们。
:::

:::variant{kind=alt name=wrapping-labels}
```html file=index.html
<!doctype html>
<html lang="zh-CN">
  <body>
    <form id="settings">
      <h1>推送设置</h1>
      <label>
        推送频率
        <select name="frequency">
          <option value="daily">每天</option>
          <option value="weekly" selected>每周</option>
          <option value="monthly">每月</option>
        </select>
      </label>
      <label>每次最多推送 <input type="number" name="limit" min="1" max="10" value="5" required /></label>
      <fieldset>
        <legend>感兴趣的主题</legend>
        <label><input type="checkbox" name="topics" value="types" checked />类型系统</label>
        <label><input type="checkbox" name="topics" value="react" />React</label>
        <label><input type="checkbox" name="topics" value="testing" />测试</label>
      </fieldset>
      <label>备注 <textarea name="note" maxlength="200" rows="3"></textarea></label>
      <div>
        <button>保存</button>
        <button type="reset">恢复默认</button>
        <button type="button">预览</button>
      </div>
    </form>
  </body>
</html>
```
:::

:::variant{kind=wrong name=preview-submits fails=tests reason="“预览”没有写 type=button，点击会提交表单"}
```html file=index.html
<!doctype html>
<html lang="zh-CN">
  <body>
    <form id="settings">
      <h1>推送设置</h1>
      <p>
        <label for="frequency">推送频率</label>
        <select id="frequency" name="frequency">
          <option value="daily">每天</option>
          <option value="weekly" selected>每周</option>
          <option value="monthly">每月</option>
        </select>
      </p>
      <p>
        <label for="limit">每次最多推送</label>
        <input id="limit" type="number" name="limit" min="1" max="10" step="1" value="5" required />
      </p>
      <fieldset>
        <legend>感兴趣的主题</legend>
        <label><input type="checkbox" name="topics" value="types" checked /> 类型系统</label>
        <label><input type="checkbox" name="topics" value="react" /> React</label>
        <label><input type="checkbox" name="topics" value="testing" /> 测试</label>
      </fieldset>
      <p>
        <label for="note">备注</label>
        <textarea id="note" name="note" maxlength="200"></textarea>
      </p>
      <button type="submit">保存</button>
      <button type="reset">恢复默认</button>
      <button>预览</button>
    </form>
  </body>
</html>
```
:::

:::variant{kind=wrong name=reset-as-button fails=tests reason="“恢复默认”写成了 type=button，不会恢复默认值"}
```html file=index.html
<!doctype html>
<html lang="zh-CN">
  <body>
    <form id="settings">
      <h1>推送设置</h1>
      <p>
        <label for="frequency">推送频率</label>
        <select id="frequency" name="frequency">
          <option value="daily">每天</option>
          <option value="weekly" selected>每周</option>
          <option value="monthly">每月</option>
        </select>
      </p>
      <p>
        <label for="limit">每次最多推送</label>
        <input id="limit" type="number" name="limit" min="1" max="10" step="1" value="5" required />
      </p>
      <fieldset>
        <legend>感兴趣的主题</legend>
        <label><input type="checkbox" name="topics" value="types" checked /> 类型系统</label>
        <label><input type="checkbox" name="topics" value="react" /> React</label>
        <label><input type="checkbox" name="topics" value="testing" /> 测试</label>
      </fieldset>
      <p>
        <label for="note">备注</label>
        <textarea id="note" name="note" maxlength="200"></textarea>
      </p>
      <button type="submit">保存</button>
      <button type="button">恢复默认</button>
      <button type="button">预览</button>
    </form>
  </body>
</html>
```
:::

:::variant{kind=wrong name=no-range fails=tests reason="数字框没有限制范围"}
```html file=index.html
<!doctype html>
<html lang="zh-CN">
  <body>
    <form id="settings">
      <h1>推送设置</h1>
      <p>
        <label for="frequency">推送频率</label>
        <select id="frequency" name="frequency">
          <option value="daily">每天</option>
          <option value="weekly" selected>每周</option>
          <option value="monthly">每月</option>
        </select>
      </p>
      <p>
        <label for="limit">每次最多推送</label>
        <input id="limit" type="number" name="limit" value="5" required />
      </p>
      <fieldset>
        <legend>感兴趣的主题</legend>
        <label><input type="checkbox" name="topics" value="types" checked /> 类型系统</label>
        <label><input type="checkbox" name="topics" value="react" /> React</label>
        <label><input type="checkbox" name="topics" value="testing" /> 测试</label>
      </fieldset>
      <p>
        <label for="note">备注</label>
        <textarea id="note" name="note" maxlength="200"></textarea>
      </p>
      <button type="submit">保存</button>
      <button type="reset">恢复默认</button>
      <button type="button">预览</button>
    </form>
  </body>
</html>
```
:::

:::variant{kind=wrong name=default-by-text fails=tests reason="下拉选择没有写 selected，默认值是第一项“每天”"}
```html file=index.html
<!doctype html>
<html lang="zh-CN">
  <body>
    <form id="settings">
      <h1>推送设置</h1>
      <p>
        <label for="frequency">推送频率</label>
        <select id="frequency" name="frequency">
          <option value="daily">每天</option>
          <option value="weekly">每周</option>
          <option value="monthly">每月</option>
        </select>
      </p>
      <p>
        <label for="limit">每次最多推送</label>
        <input id="limit" type="number" name="limit" min="1" max="10" step="1" value="5" required />
      </p>
      <fieldset>
        <legend>感兴趣的主题</legend>
        <label><input type="checkbox" name="topics" value="types" checked /> 类型系统</label>
        <label><input type="checkbox" name="topics" value="react" /> React</label>
        <label><input type="checkbox" name="topics" value="testing" /> 测试</label>
      </fieldset>
      <p>
        <label for="note">备注</label>
        <textarea id="note" name="note" maxlength="200"></textarea>
      </p>
      <button type="submit">保存</button>
      <button type="reset">恢复默认</button>
      <button type="button">预览</button>
    </form>
  </body>
</html>
```
:::
