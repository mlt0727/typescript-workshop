---
kind: task
title: 为注册流程写流程测试
grading: tests
---
`signup.ts`（只读）是一个三步的注册向导，页面（`index.html`、`main.ts`）把它放在 `#app` 中：

1. **第 1 步**（标题 `第 1 步，共 3 步：填写邮箱`）：标签为“邮箱”的输入框。点击“下一步”时去掉首尾空白，格式不对时显示 `role="alert"` 的“请输入有效的邮箱”，留在这一步；
2. **第 2 步**（`第 2 步，共 3 步：选择套餐`）：“免费版”“专业版”两个单选框，默认免费版；有“上一步”“下一步”；
3. **第 3 步**（`第 3 步，共 3 步：确认`）：列出邮箱和套餐的名字；有“上一步”“确认注册”；
4. 确认之后，`role="status"` 中显示 `注册成功：邮箱（套餐）`；
5. 每次换步骤，焦点移到新的标题上；“上一步”回到前一步时，之前填写的邮箱和选择的套餐都保留。

在 `signup.test.ts` 中像端到端测试一样写流程测试：从第一步走到最后，检查每一步用户看到的内容。平台准备了六个错误的版本，你的测试要发现每一个。
:::files{role=support}
```html file=index.html readonly
<!doctype html>
<html lang="zh-CN">
  <body>
    <main id="app"></main>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```
```ts file=main.ts readonly
import { mountSignup } from './signup';

const app = document.getElementById('app');
if (!app) throw new Error('缺少 #app');
mountSignup(app);
```
```ts file=signup.ts readonly
type Plan = 'free' | 'pro';
const PLAN_NAMES: Record<Plan, string> = { free: '免费版', pro: '专业版' };
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** 三步的注册向导：邮箱 → 套餐 → 确认 */
export function mountSignup(root: HTMLElement): void {
  let step: 1 | 2 | 3 | 'done' = 1;
  let email = '';
  let plan: Plan = 'free';

  const heading = (text: string) => {
    const h2 = document.createElement('h2');
    h2.tabIndex = -1;
    h2.textContent = text;
    return h2;
  };
  const button = (text: string, onClick: () => void, type: 'button' | 'submit' = 'button') => {
    const b = document.createElement('button');
    b.type = type;
    b.textContent = text;
    if (type === 'button') b.addEventListener('click', onClick);
    return b;
  };
  const go = (next: typeof step) => {
    step = next;
    render();
    root.querySelector('h2')?.focus();
  };

  function render() {
    root.replaceChildren();
    if (step === 1) {
      const form = document.createElement('form');
      form.noValidate = true;
      const label = document.createElement('label');
      label.textContent = '邮箱 ';
      const input = document.createElement('input');
      input.type = 'email';
      input.value = email;
      label.append(input);
      const error = document.createElement('p');
      form.append(heading('第 1 步，共 3 步：填写邮箱'), label, error, button('下一步', () => {}, 'submit'));
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        const value = input.value.trim();
        if (!EMAIL.test(value)) {
          error.setAttribute('role', 'alert');
          error.textContent = '请输入有效的邮箱';
          input.setAttribute('aria-invalid', 'true');
          return;
        }
        email = value;
        go(2);
      });
      root.append(form);
    } else if (step === 2) {
      const fieldset = document.createElement('fieldset');
      const legend = document.createElement('legend');
      legend.textContent = '选择套餐';
      fieldset.append(legend);
      for (const value of ['free', 'pro'] as const) {
        const label = document.createElement('label');
        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'plan';
        radio.checked = plan === value;
        radio.addEventListener('change', () => {
          plan = value;
        });
        label.append(radio, ` ${PLAN_NAMES[value]}`);
        fieldset.append(label);
      }
      root.append(heading('第 2 步，共 3 步：选择套餐'), fieldset, button('上一步', () => go(1)), button('下一步', () => go(3)));
    } else if (step === 3) {
      const list = document.createElement('dl');
      for (const [term, value] of [['邮箱', email], ['套餐', PLAN_NAMES[plan]]]) {
        const dt = document.createElement('dt');
        dt.textContent = term ?? '';
        const dd = document.createElement('dd');
        dd.textContent = value ?? '';
        list.append(dt, dd);
      }
      root.append(heading('第 3 步，共 3 步：确认'), list, button('上一步', () => go(2)), button('确认注册', () => go('done')));
    } else {
      const status = document.createElement('p');
      status.setAttribute('role', 'status');
      status.textContent = `注册成功：${email}（${PLAN_NAMES[plan]}）`;
      root.append(heading('完成'), status);
    }
  }

  render();
}
```
:::

:::files{role=starter}
```ts file=signup.test.ts
import { screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { expect, test } from 'vitest';

test('用免费版完成注册', async () => {
  const user = userEvent.setup();
  await user.type(screen.getByRole('textbox', { name: '邮箱' }), 'ada@example.com');
  await user.click(screen.getByRole('button', { name: '下一步' }));
  await user.click(screen.getByRole('button', { name: '下一步' }));
  await user.click(screen.getByRole('button', { name: '确认注册' }));
  expect(screen.getByRole('status')).toHaveTextContent('注册成功');
});
```
:::

:::files{role=solution}
```ts file=signup.test.ts
import { screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { describe, expect, test } from 'vitest';

const next = () => screen.getByRole('button', { name: '下一步' });
const back = () => screen.getByRole('button', { name: '上一步' });

describe('注册流程', () => {
  test('选择专业版完成注册：每一步的标题获得焦点，确认页与结果正确', async () => {
    const user = userEvent.setup();
    await user.type(screen.getByRole('textbox', { name: '邮箱' }), ' ada@example.com ');
    await user.click(next());
    expect(screen.getByRole('heading', { name: '第 2 步，共 3 步：选择套餐' })).toHaveFocus();

    await user.click(screen.getByRole('radio', { name: '专业版' }));
    await user.click(next());
    expect(screen.getByRole('heading', { name: '第 3 步，共 3 步：确认' })).toHaveFocus();
    expect(screen.getByText('专业版')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '确认注册' }));
    expect(screen.getByRole('status')).toHaveTextContent('注册成功：ada@example.com（专业版）');
  });

  test('无效的邮箱不能进入下一步', async () => {
    const user = userEvent.setup();
    await user.type(screen.getByRole('textbox', { name: '邮箱' }), 'ada');
    await user.click(next());
    expect(screen.getByRole('alert')).toHaveTextContent('请输入有效的邮箱');
    expect(screen.getByRole('heading', { name: '第 1 步，共 3 步：填写邮箱' })).toBeInTheDocument();
  });

  test('“上一步”保留已经填写和选择的内容', async () => {
    const user = userEvent.setup();
    await user.type(screen.getByRole('textbox', { name: '邮箱' }), 'lin@example.com');
    await user.click(next());
    await user.click(screen.getByRole('radio', { name: '专业版' }));
    await user.click(next());

    await user.click(back());
    expect(screen.getByRole('radio', { name: '专业版' })).toBeChecked();
    await user.click(back());
    expect(screen.getByRole('textbox', { name: '邮箱' })).toHaveValue('lin@example.com');
  });
});
```
:::

:::mutant{name=skips-validation hint="没有检查邮箱的格式：输入“ada”也能进入下一步。需要测试无效的邮箱"}
```ts file=signup.ts
type Plan = 'free' | 'pro';
const PLAN_NAMES: Record<Plan, string> = { free: '免费版', pro: '专业版' };
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** 三步的注册向导：邮箱 → 套餐 → 确认 */
export function mountSignup(root: HTMLElement): void {
  let step: 1 | 2 | 3 | 'done' = 1;
  let email = '';
  let plan: Plan = 'free';

  const heading = (text: string) => {
    const h2 = document.createElement('h2');
    h2.tabIndex = -1;
    h2.textContent = text;
    return h2;
  };
  const button = (text: string, onClick: () => void, type: 'button' | 'submit' = 'button') => {
    const b = document.createElement('button');
    b.type = type;
    b.textContent = text;
    if (type === 'button') b.addEventListener('click', onClick);
    return b;
  };
  const go = (next: typeof step) => {
    step = next;
    render();
    root.querySelector('h2')?.focus();
  };

  function render() {
    root.replaceChildren();
    if (step === 1) {
      const form = document.createElement('form');
      form.noValidate = true;
      const label = document.createElement('label');
      label.textContent = '邮箱 ';
      const input = document.createElement('input');
      input.type = 'email';
      input.value = email;
      label.append(input);
      const error = document.createElement('p');
      form.append(heading('第 1 步，共 3 步：填写邮箱'), label, error, button('下一步', () => {}, 'submit'));
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        const value = input.value.trim();
        if (value === '') {
          error.setAttribute('role', 'alert');
          error.textContent = '请输入有效的邮箱';
          input.setAttribute('aria-invalid', 'true');
          return;
        }
        email = value;
        go(2);
      });
      root.append(form);
    } else if (step === 2) {
      const fieldset = document.createElement('fieldset');
      const legend = document.createElement('legend');
      legend.textContent = '选择套餐';
      fieldset.append(legend);
      for (const value of ['free', 'pro'] as const) {
        const label = document.createElement('label');
        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'plan';
        radio.checked = plan === value;
        radio.addEventListener('change', () => {
          plan = value;
        });
        label.append(radio, ` ${PLAN_NAMES[value]}`);
        fieldset.append(label);
      }
      root.append(heading('第 2 步，共 3 步：选择套餐'), fieldset, button('上一步', () => go(1)), button('下一步', () => go(3)));
    } else if (step === 3) {
      const list = document.createElement('dl');
      for (const [term, value] of [['邮箱', email], ['套餐', PLAN_NAMES[plan]]]) {
        const dt = document.createElement('dt');
        dt.textContent = term ?? '';
        const dd = document.createElement('dd');
        dd.textContent = value ?? '';
        list.append(dt, dd);
      }
      root.append(heading('第 3 步，共 3 步：确认'), list, button('上一步', () => go(2)), button('确认注册', () => go('done')));
    } else {
      const status = document.createElement('p');
      status.setAttribute('role', 'status');
      status.textContent = `注册成功：${email}（${PLAN_NAMES[plan]}）`;
      root.append(heading('完成'), status);
    }
  }

  render();
}
```
:::

:::mutant{name=forgets-email hint="从第 2 步回到第 1 步时，邮箱被清空了：需要测试“上一步”之后输入框中的值"}
```ts file=signup.ts
type Plan = 'free' | 'pro';
const PLAN_NAMES: Record<Plan, string> = { free: '免费版', pro: '专业版' };
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** 三步的注册向导：邮箱 → 套餐 → 确认 */
export function mountSignup(root: HTMLElement): void {
  let step: 1 | 2 | 3 | 'done' = 1;
  let email = '';
  let plan: Plan = 'free';

  const heading = (text: string) => {
    const h2 = document.createElement('h2');
    h2.tabIndex = -1;
    h2.textContent = text;
    return h2;
  };
  const button = (text: string, onClick: () => void, type: 'button' | 'submit' = 'button') => {
    const b = document.createElement('button');
    b.type = type;
    b.textContent = text;
    if (type === 'button') b.addEventListener('click', onClick);
    return b;
  };
  const go = (next: typeof step) => {
    step = next;
    render();
    root.querySelector('h2')?.focus();
  };

  function render() {
    root.replaceChildren();
    if (step === 1) {
      const form = document.createElement('form');
      form.noValidate = true;
      const label = document.createElement('label');
      label.textContent = '邮箱 ';
      const input = document.createElement('input');
      input.type = 'email';
      label.append(input);
      const error = document.createElement('p');
      form.append(heading('第 1 步，共 3 步：填写邮箱'), label, error, button('下一步', () => {}, 'submit'));
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        const value = input.value.trim();
        if (!EMAIL.test(value)) {
          error.setAttribute('role', 'alert');
          error.textContent = '请输入有效的邮箱';
          input.setAttribute('aria-invalid', 'true');
          return;
        }
        email = value;
        go(2);
      });
      root.append(form);
    } else if (step === 2) {
      const fieldset = document.createElement('fieldset');
      const legend = document.createElement('legend');
      legend.textContent = '选择套餐';
      fieldset.append(legend);
      for (const value of ['free', 'pro'] as const) {
        const label = document.createElement('label');
        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'plan';
        radio.checked = plan === value;
        radio.addEventListener('change', () => {
          plan = value;
        });
        label.append(radio, ` ${PLAN_NAMES[value]}`);
        fieldset.append(label);
      }
      root.append(heading('第 2 步，共 3 步：选择套餐'), fieldset, button('上一步', () => go(1)), button('下一步', () => go(3)));
    } else if (step === 3) {
      const list = document.createElement('dl');
      for (const [term, value] of [['邮箱', email], ['套餐', PLAN_NAMES[plan]]]) {
        const dt = document.createElement('dt');
        dt.textContent = term ?? '';
        const dd = document.createElement('dd');
        dd.textContent = value ?? '';
        list.append(dt, dd);
      }
      root.append(heading('第 3 步，共 3 步：确认'), list, button('上一步', () => go(2)), button('确认注册', () => go('done')));
    } else {
      const status = document.createElement('p');
      status.setAttribute('role', 'status');
      status.textContent = `注册成功：${email}（${PLAN_NAMES[plan]}）`;
      root.append(heading('完成'), status);
    }
  }

  render();
}
```
:::

:::mutant{name=forgets-plan hint="从第 3 步回到第 2 步时，选择的套餐变回了免费版"}
```ts file=signup.ts
type Plan = 'free' | 'pro';
const PLAN_NAMES: Record<Plan, string> = { free: '免费版', pro: '专业版' };
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** 三步的注册向导：邮箱 → 套餐 → 确认 */
export function mountSignup(root: HTMLElement): void {
  let step: 1 | 2 | 3 | 'done' = 1;
  let email = '';
  let plan: Plan = 'free';

  const heading = (text: string) => {
    const h2 = document.createElement('h2');
    h2.tabIndex = -1;
    h2.textContent = text;
    return h2;
  };
  const button = (text: string, onClick: () => void, type: 'button' | 'submit' = 'button') => {
    const b = document.createElement('button');
    b.type = type;
    b.textContent = text;
    if (type === 'button') b.addEventListener('click', onClick);
    return b;
  };
  const go = (next: typeof step) => {
    step = next;
    render();
    root.querySelector('h2')?.focus();
  };

  function render() {
    root.replaceChildren();
    if (step === 1) {
      const form = document.createElement('form');
      form.noValidate = true;
      const label = document.createElement('label');
      label.textContent = '邮箱 ';
      const input = document.createElement('input');
      input.type = 'email';
      input.value = email;
      label.append(input);
      const error = document.createElement('p');
      form.append(heading('第 1 步，共 3 步：填写邮箱'), label, error, button('下一步', () => {}, 'submit'));
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        const value = input.value.trim();
        if (!EMAIL.test(value)) {
          error.setAttribute('role', 'alert');
          error.textContent = '请输入有效的邮箱';
          input.setAttribute('aria-invalid', 'true');
          return;
        }
        email = value;
        go(2);
      });
      root.append(form);
    } else if (step === 2) {
      plan = 'free';
      const fieldset = document.createElement('fieldset');
      const legend = document.createElement('legend');
      legend.textContent = '选择套餐';
      fieldset.append(legend);
      for (const value of ['free', 'pro'] as const) {
        const label = document.createElement('label');
        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'plan';
        radio.checked = plan === value;
        radio.addEventListener('change', () => {
          plan = value;
        });
        label.append(radio, ` ${PLAN_NAMES[value]}`);
        fieldset.append(label);
      }
      root.append(heading('第 2 步，共 3 步：选择套餐'), fieldset, button('上一步', () => go(1)), button('下一步', () => go(3)));
    } else if (step === 3) {
      const list = document.createElement('dl');
      for (const [term, value] of [['邮箱', email], ['套餐', PLAN_NAMES[plan]]]) {
        const dt = document.createElement('dt');
        dt.textContent = term ?? '';
        const dd = document.createElement('dd');
        dd.textContent = value ?? '';
        list.append(dt, dd);
      }
      root.append(heading('第 3 步，共 3 步：确认'), list, button('上一步', () => go(2)), button('确认注册', () => go('done')));
    } else {
      const status = document.createElement('p');
      status.setAttribute('role', 'status');
      status.textContent = `注册成功：${email}（${PLAN_NAMES[plan]}）`;
      root.append(heading('完成'), status);
    }
  }

  render();
}
```
:::

:::mutant{name=summary-plan hint="确认页总是显示“免费版”（最后的结果是对的）：需要选择专业版，检查确认页上列出的套餐"}
```ts file=signup.ts
type Plan = 'free' | 'pro';
const PLAN_NAMES: Record<Plan, string> = { free: '免费版', pro: '专业版' };
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** 三步的注册向导：邮箱 → 套餐 → 确认 */
export function mountSignup(root: HTMLElement): void {
  let step: 1 | 2 | 3 | 'done' = 1;
  let email = '';
  let plan: Plan = 'free';

  const heading = (text: string) => {
    const h2 = document.createElement('h2');
    h2.tabIndex = -1;
    h2.textContent = text;
    return h2;
  };
  const button = (text: string, onClick: () => void, type: 'button' | 'submit' = 'button') => {
    const b = document.createElement('button');
    b.type = type;
    b.textContent = text;
    if (type === 'button') b.addEventListener('click', onClick);
    return b;
  };
  const go = (next: typeof step) => {
    step = next;
    render();
    root.querySelector('h2')?.focus();
  };

  function render() {
    root.replaceChildren();
    if (step === 1) {
      const form = document.createElement('form');
      form.noValidate = true;
      const label = document.createElement('label');
      label.textContent = '邮箱 ';
      const input = document.createElement('input');
      input.type = 'email';
      input.value = email;
      label.append(input);
      const error = document.createElement('p');
      form.append(heading('第 1 步，共 3 步：填写邮箱'), label, error, button('下一步', () => {}, 'submit'));
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        const value = input.value.trim();
        if (!EMAIL.test(value)) {
          error.setAttribute('role', 'alert');
          error.textContent = '请输入有效的邮箱';
          input.setAttribute('aria-invalid', 'true');
          return;
        }
        email = value;
        go(2);
      });
      root.append(form);
    } else if (step === 2) {
      const fieldset = document.createElement('fieldset');
      const legend = document.createElement('legend');
      legend.textContent = '选择套餐';
      fieldset.append(legend);
      for (const value of ['free', 'pro'] as const) {
        const label = document.createElement('label');
        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'plan';
        radio.checked = plan === value;
        radio.addEventListener('change', () => {
          plan = value;
        });
        label.append(radio, ` ${PLAN_NAMES[value]}`);
        fieldset.append(label);
      }
      root.append(heading('第 2 步，共 3 步：选择套餐'), fieldset, button('上一步', () => go(1)), button('下一步', () => go(3)));
    } else if (step === 3) {
      const list = document.createElement('dl');
      for (const [term, value] of [['邮箱', email], ['套餐', PLAN_NAMES.free]]) {
        const dt = document.createElement('dt');
        dt.textContent = term ?? '';
        const dd = document.createElement('dd');
        dd.textContent = value ?? '';
        list.append(dt, dd);
      }
      root.append(heading('第 3 步，共 3 步：确认'), list, button('上一步', () => go(2)), button('确认注册', () => go('done')));
    } else {
      const status = document.createElement('p');
      status.setAttribute('role', 'status');
      status.textContent = `注册成功：${email}（${PLAN_NAMES[plan]}）`;
      root.append(heading('完成'), status);
    }
  }

  render();
}
```
:::

:::mutant{name=focus-not-moved hint="换步骤之后焦点没有移到标题上，键盘和读屏软件的用户不知道页面变了：需要检查标题的焦点"}
```ts file=signup.ts
type Plan = 'free' | 'pro';
const PLAN_NAMES: Record<Plan, string> = { free: '免费版', pro: '专业版' };
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** 三步的注册向导：邮箱 → 套餐 → 确认 */
export function mountSignup(root: HTMLElement): void {
  let step: 1 | 2 | 3 | 'done' = 1;
  let email = '';
  let plan: Plan = 'free';

  const heading = (text: string) => {
    const h2 = document.createElement('h2');
    h2.tabIndex = -1;
    h2.textContent = text;
    return h2;
  };
  const button = (text: string, onClick: () => void, type: 'button' | 'submit' = 'button') => {
    const b = document.createElement('button');
    b.type = type;
    b.textContent = text;
    if (type === 'button') b.addEventListener('click', onClick);
    return b;
  };
  const go = (next: typeof step) => {
    step = next;
    render();
  };

  function render() {
    root.replaceChildren();
    if (step === 1) {
      const form = document.createElement('form');
      form.noValidate = true;
      const label = document.createElement('label');
      label.textContent = '邮箱 ';
      const input = document.createElement('input');
      input.type = 'email';
      input.value = email;
      label.append(input);
      const error = document.createElement('p');
      form.append(heading('第 1 步，共 3 步：填写邮箱'), label, error, button('下一步', () => {}, 'submit'));
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        const value = input.value.trim();
        if (!EMAIL.test(value)) {
          error.setAttribute('role', 'alert');
          error.textContent = '请输入有效的邮箱';
          input.setAttribute('aria-invalid', 'true');
          return;
        }
        email = value;
        go(2);
      });
      root.append(form);
    } else if (step === 2) {
      const fieldset = document.createElement('fieldset');
      const legend = document.createElement('legend');
      legend.textContent = '选择套餐';
      fieldset.append(legend);
      for (const value of ['free', 'pro'] as const) {
        const label = document.createElement('label');
        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'plan';
        radio.checked = plan === value;
        radio.addEventListener('change', () => {
          plan = value;
        });
        label.append(radio, ` ${PLAN_NAMES[value]}`);
        fieldset.append(label);
      }
      root.append(heading('第 2 步，共 3 步：选择套餐'), fieldset, button('上一步', () => go(1)), button('下一步', () => go(3)));
    } else if (step === 3) {
      const list = document.createElement('dl');
      for (const [term, value] of [['邮箱', email], ['套餐', PLAN_NAMES[plan]]]) {
        const dt = document.createElement('dt');
        dt.textContent = term ?? '';
        const dd = document.createElement('dd');
        dd.textContent = value ?? '';
        list.append(dt, dd);
      }
      root.append(heading('第 3 步，共 3 步：确认'), list, button('上一步', () => go(2)), button('确认注册', () => go('done')));
    } else {
      const status = document.createElement('p');
      status.setAttribute('role', 'status');
      status.textContent = `注册成功：${email}（${PLAN_NAMES[plan]}）`;
      root.append(heading('完成'), status);
    }
  }

  render();
}
```
:::

:::mutant{name=result-wrong-plan hint="确认页是对的，最后的“注册成功”却总是写着免费版：需要选择专业版走到最后，检查注册成功的消息"}
```ts file=signup.ts
type Plan = 'free' | 'pro';
const PLAN_NAMES: Record<Plan, string> = { free: '免费版', pro: '专业版' };
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** 三步的注册向导：邮箱 → 套餐 → 确认 */
export function mountSignup(root: HTMLElement): void {
  let step: 1 | 2 | 3 | 'done' = 1;
  let email = '';
  let plan: Plan = 'free';

  const heading = (text: string) => {
    const h2 = document.createElement('h2');
    h2.tabIndex = -1;
    h2.textContent = text;
    return h2;
  };
  const button = (text: string, onClick: () => void, type: 'button' | 'submit' = 'button') => {
    const b = document.createElement('button');
    b.type = type;
    b.textContent = text;
    if (type === 'button') b.addEventListener('click', onClick);
    return b;
  };
  const go = (next: typeof step) => {
    step = next;
    render();
    root.querySelector('h2')?.focus();
  };

  function render() {
    root.replaceChildren();
    if (step === 1) {
      const form = document.createElement('form');
      form.noValidate = true;
      const label = document.createElement('label');
      label.textContent = '邮箱 ';
      const input = document.createElement('input');
      input.type = 'email';
      input.value = email;
      label.append(input);
      const error = document.createElement('p');
      form.append(heading('第 1 步，共 3 步：填写邮箱'), label, error, button('下一步', () => {}, 'submit'));
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        const value = input.value.trim();
        if (!EMAIL.test(value)) {
          error.setAttribute('role', 'alert');
          error.textContent = '请输入有效的邮箱';
          input.setAttribute('aria-invalid', 'true');
          return;
        }
        email = value;
        go(2);
      });
      root.append(form);
    } else if (step === 2) {
      const fieldset = document.createElement('fieldset');
      const legend = document.createElement('legend');
      legend.textContent = '选择套餐';
      fieldset.append(legend);
      for (const value of ['free', 'pro'] as const) {
        const label = document.createElement('label');
        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'plan';
        radio.checked = plan === value;
        radio.addEventListener('change', () => {
          plan = value;
        });
        label.append(radio, ` ${PLAN_NAMES[value]}`);
        fieldset.append(label);
      }
      root.append(heading('第 2 步，共 3 步：选择套餐'), fieldset, button('上一步', () => go(1)), button('下一步', () => go(3)));
    } else if (step === 3) {
      const list = document.createElement('dl');
      for (const [term, value] of [['邮箱', email], ['套餐', PLAN_NAMES[plan]]]) {
        const dt = document.createElement('dt');
        dt.textContent = term ?? '';
        const dd = document.createElement('dd');
        dd.textContent = value ?? '';
        list.append(dt, dd);
      }
      root.append(heading('第 3 步，共 3 步：确认'), list, button('上一步', () => go(2)), button('确认注册', () => go('done')));
    } else {
      const status = document.createElement('p');
      status.setAttribute('role', 'status');
      status.textContent = `注册成功：${email}（${PLAN_NAMES.free}）`;
      root.append(heading('完成'), status);
    }
  }

  render();
}
```
:::

:::hint{level=1}
起始代码只走了一遍“全部用默认值”的流程。再写几条：无效的邮箱（例如 `ada`）应该留在第 1 步并出现提示；选择“专业版”走完全程，检查确认页和最后的结果；在第 3 步按“上一步”两次，检查单选框和邮箱是否还在。
:::

:::hint{level=2}
找标题用 `screen.getByRole('heading', { name: '第 2 步，共 3 步：选择套餐' })`，检查焦点用 `toHaveFocus()`。单选框用 `getByRole('radio', { name: '专业版' })`，选中之后用 `toBeChecked()` 检查。每个 user-event 的操作都要 `await`。
:::

:::explanation
流程测试关心的是“一步一步接起来之后还对不对”。六个错误的版本中，没有一个会让单独某一步看起来坏掉：

- 不检查格式：第 1 步照样能进入第 2 步，只是放进了无效的数据；
- 返回时丢失数据：每一步单独看都是正常的，只有“前进再后退”时才出现；
- 确认页显示错误的套餐、最后的结果写错了套餐：只有选了非默认的选项、并且检查了这一页（或者走到最后）才看得出来；
- 焦点没有移动：页面看起来完全一样，键盘和读屏软件的用户却“迷路”了。

所以流程测试要刻意走“非默认”的路径：选不同的选项、来回切换、故意输入错误的数据。同样的测试在本机用 Playwright 写几乎一样：

```ts
test('选择专业版完成注册', async ({ page }) => {
  await page.goto('/signup');
  await page.getByRole('textbox', { name: '邮箱' }).fill('ada@example.com');
  await page.getByRole('button', { name: '下一步' }).click();
  await expect(page.getByRole('heading', { name: '第 2 步，共 3 步：选择套餐' })).toBeFocused();
  await page.getByRole('radio', { name: '专业版' }).check();
  await page.getByRole('button', { name: '下一步' }).click();
  await page.getByRole('button', { name: '确认注册' }).click();
  await expect(page.getByRole('status')).toHaveText('注册成功：ada@example.com（专业版）');
});
```

区别在于 Playwright 运行在真实打开的网站上（包括构建、路由、真实的焦点行为），并且每个断言都会自动重试。
:::

:::variant{kind=alt name=helper-and-roundtrip}
```ts file=signup.test.ts
import { screen, within } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { expect, test } from 'vitest';

async function fillEmail(user: ReturnType<typeof userEvent.setup>, email: string) {
  const input = screen.getByLabelText('邮箱');
  await user.clear(input);
  await user.type(input, email);
  await user.click(screen.getByRole('button', { name: '下一步' }));
}

test('完整的流程，包括来回切换', async () => {
  const user = userEvent.setup();
  await fillEmail(user, 'not-an-email');
  expect(screen.getByRole('alert')).toBeVisible();

  await fillEmail(user, 'bo@example.org');
  expect(document.activeElement).toBe(screen.getByRole('heading', { level: 2 }));
  await user.click(screen.getByLabelText('专业版'));
  await user.click(screen.getByRole('button', { name: '下一步' }));

  const summary = screen.getByText('套餐').closest('dl');
  if (!(summary instanceof HTMLElement)) throw new Error('没有确认信息');
  expect(within(summary).getByText('专业版')).toBeVisible();

  await user.click(screen.getByRole('button', { name: '上一步' }));
  expect(screen.getByLabelText('专业版')).toBeChecked();
  await user.click(screen.getByRole('button', { name: '上一步' }));
  expect(screen.getByLabelText('邮箱')).toHaveValue('bo@example.org');
  expect(screen.getByRole('heading', { level: 2 })).toHaveFocus();

  // 再走到最后：来回切换之后，结果仍然是专业版
  await user.click(screen.getByRole('button', { name: '下一步' }));
  await user.click(screen.getByRole('button', { name: '下一步' }));
  await user.click(screen.getByRole('button', { name: '确认注册' }));
  expect(screen.getByRole('status')).toHaveTextContent('注册成功：bo@example.org（专业版）');
});
```
:::

:::variant{kind=wrong name=straight-through fails=mutants misses=focus-not-moved,forgets-email,forgets-plan,skips-validation,summary-plan,result-wrong-plan reason="只走了一遍“全部默认”的流程：没有测试无效的输入、专业版、上一步，也没有检查焦点"}
```ts file=signup.test.ts
import { screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { expect, test } from 'vitest';

test('用免费版完成注册', async () => {
  const user = userEvent.setup();
  await user.type(screen.getByRole('textbox', { name: '邮箱' }), 'ada@example.com');
  await user.click(screen.getByRole('button', { name: '下一步' }));
  await user.click(screen.getByRole('button', { name: '下一步' }));
  await user.click(screen.getByRole('button', { name: '确认注册' }));
  expect(screen.getByRole('status')).toHaveTextContent('注册成功：ada@example.com（免费版）');
});
```
:::

:::variant{kind=wrong name=sync-after-action fails=tests reason="user-event 的操作没有 await：断言在点击完成之前就执行了，在正确的实现上也会失败"}
```ts file=signup.test.ts
import { screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { expect, test } from 'vitest';

test('进入第 2 步', async () => {
  const user = userEvent.setup();
  await user.type(screen.getByRole('textbox', { name: '邮箱' }), 'ada@example.com');
  void user.click(screen.getByRole('button', { name: '下一步' }));
  expect(screen.getByRole('heading', { name: '第 2 步，共 3 步：选择套餐' })).toHaveFocus();
});
```
:::
