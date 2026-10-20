---
kind: challenge
title: 修复订阅卡片的可访问性问题
---
这张订阅卡片看起来没什么问题，但对很多用户来说并不好用。修改 `index.html` 和 `style.css`，满足：

1. 说明文字（“每周一封邮件……”）与背景的**对比度至少 4.5:1**；
2. 用键盘操作时，两个按钮获得焦点后都有清晰的轮廓：`outline` 不是 `none`，宽度**至少 2px**；
3. 关闭按钮的可访问名称是“**关闭通知**”，可点击区域至少 **24×24** 像素；
4. 邮箱输入框有标签“**邮箱**”；
5. 邮箱填写有误时**不只用红色**表示：输入框标记为 `aria-invalid="true"`，并通过 `aria-describedby` 关联一段可见的文字说明“**请输入有效的邮箱地址**”。

测试会计算实际显示的颜色的对比度，用模拟的 Tab 键移动焦点，并按角色和名称查找元素。

:::files{role=starter}
```html file=index.html
<!doctype html>
<html lang="zh-CN">
  <head>
    <link rel="stylesheet" href="./style.css" />
  </head>
  <body>
    <section class="notice" aria-labelledby="notice-title">
      <button type="button" class="close">×</button>
      <h2 id="notice-title">订阅每周更新</h2>
      <p class="hint">每周一封邮件，随时可以退订。</p>
      <form>
        <input type="email" name="email" class="invalid" placeholder="邮箱" value="ada@" />
        <button type="submit" class="subscribe">订阅</button>
      </form>
    </section>
  </body>
</html>
```
```css file=style.css
body { font-family: system-ui, sans-serif; background: #fff; }
.notice { position: relative; max-width: 420px; padding: 16px; border: 1px solid #ddd; border-radius: 8px; }
.close { position: absolute; top: 4px; right: 4px; width: 16px; height: 16px; padding: 0; border: 0; background: none; font-size: 12px; line-height: 1; }
.hint { color: #aaa; }
.invalid { border: 2px solid #d00; }
.subscribe { padding: 4px 12px; }
button:focus { outline: none; }
```
:::

:::files{role=solution}
```html file=index.html
<!doctype html>
<html lang="zh-CN">
  <head>
    <link rel="stylesheet" href="./style.css" />
  </head>
  <body>
    <section class="notice" aria-labelledby="notice-title">
      <button type="button" class="close" aria-label="关闭通知">×</button>
      <h2 id="notice-title">订阅每周更新</h2>
      <p class="hint">每周一封邮件，随时可以退订。</p>
      <form>
        <label for="email">邮箱</label>
        <input
          id="email"
          type="email"
          name="email"
          class="invalid"
          value="ada@"
          aria-invalid="true"
          aria-describedby="email-error"
        />
        <p id="email-error" class="error-text">请输入有效的邮箱地址</p>
        <button type="submit" class="subscribe">订阅</button>
      </form>
    </section>
  </body>
</html>
```
```css file=style.css
body { font-family: system-ui, sans-serif; background: #fff; }
.notice { position: relative; max-width: 420px; padding: 16px; border: 1px solid #ddd; border-radius: 8px; }
.close { position: absolute; top: 4px; right: 4px; width: 32px; height: 32px; padding: 0; border: 0; background: none; font-size: 20px; line-height: 1; }
.hint { color: #595959; }
.invalid { border: 2px solid #d00; }
.error-text { color: #b00020; margin: 4px 0; }
.subscribe { padding: 4px 12px; }
button:focus-visible { outline: 3px solid #0a6cff; outline-offset: 2px; }
```
:::

:::files{role=tests}
```ts file=a11y.test.ts
import { expect, test } from 'vitest';
import { screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';

function luminance(color: string): number {
  const [r = 0, g = 0, b = 0] = (color.match(/\d+(\.\d+)?/g) ?? []).slice(0, 3).map((part) => {
    const c = Number(part) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** 向上找第一个不透明的背景色；都没有时是白色 */
function backgroundOf(el: Element): string {
  for (let e: Element | null = el; e; e = e.parentElement) {
    const bg = getComputedStyle(e).backgroundColor;
    if (bg !== 'transparent' && !/rgba\(.*,\s*0\)$/.test(bg)) return bg;
  }
  return 'rgb(255, 255, 255)';
}

test('说明文字的对比度至少 4.5:1', () => {
  const hint = screen.getByText('每周一封邮件，随时可以退订。');
  const ratio = contrast(getComputedStyle(hint).color, backgroundOf(hint));
  expect(ratio, `对比度 ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
});

test.each([['关闭通知'], ['订阅']])('用键盘聚焦“%s”按钮时有清晰的轮廓', async (name) => {
  const user = userEvent.setup();
  const button = screen.getByRole('button', { name });
  for (let i = 0; i < 8 && document.activeElement !== button; i++) {
    await user.tab();
  }
  expect(button).toHaveFocus();
  const style = getComputedStyle(button);
  expect(style.outlineStyle).not.toBe('none');
  expect(Number.parseFloat(style.outlineWidth)).toBeGreaterThanOrEqual(2);
});

test('关闭按钮有名字，可点击区域至少 24×24 像素', () => {
  const close = screen.getByRole('button', { name: '关闭通知' });
  const rect = close.getBoundingClientRect();
  expect(rect.width).toBeGreaterThanOrEqual(24);
  expect(rect.height).toBeGreaterThanOrEqual(24);
});

test('邮箱输入框有标签', () => {
  expect(screen.getByLabelText('邮箱')).toHaveAttribute('type', 'email');
});

test('邮箱错误不只用颜色表示', () => {
  const input = screen.getByLabelText('邮箱');
  expect(input).toHaveAttribute('aria-invalid', 'true');
  const ids = (input.getAttribute('aria-describedby') ?? '').split(/\s+/).filter((id) => id !== '');
  const descriptions = ids.map((id) => document.getElementById(id));
  const text = descriptions.map((el) => el?.textContent ?? '').join(' ');
  expect(text).toContain('请输入有效的邮箱地址');
  for (const el of descriptions) {
    if (el) expect(el).toBeVisible();
  }
});
```
:::

:::hint{level=1}
逐条对应：说明文字换一个更深的灰色；删掉 `outline: none`，改用 `button:focus-visible` 写一个明显的轮廓；关闭按钮加 `aria-label` 并放大尺寸；给输入框加 `<label>`；在输入框后面加一段错误说明，并用 `aria-describedby` 指向它的 `id`。
:::

:::hint{level=2}
`.hint { color: #595959; }` 在白色背景上约 7:1。`button:focus-visible { outline: 3px solid #0a6cff; outline-offset: 2px; }`。`<button … aria-label="关闭通知">`，CSS 中把 `.close` 改成 32×32。错误说明：`<p id="email-error">请输入有效的邮箱地址</p>`，输入框加上 `aria-invalid="true" aria-describedby="email-error"`。
:::

:::explanation
起始代码里的五个问题都很常见，单看截图却完全发现不了：

- **对比度**：`#aaa` 配白色只有约 2.3:1，视力不好或者在阳光下看手机的人很难看清。`#595959` 约 7:1。
- **焦点样式**：`outline: none` 让键盘用户完全不知道焦点在哪里。`:focus-visible` 只在需要时（例如键盘操作）显示轮廓，用鼠标点击时不会出现，所以没有理由把焦点样式整个去掉。
- **图标按钮**：屏幕阅读器读不出“×”的含义，`aria-label` 提供了名字。16×16 的按钮在手机上也很难点中，WCAG 2.2 要求至少 24×24。
- **标签**：placeholder 不能代替 label（d02）。
- **只用颜色表示错误**：色觉障碍的用户可能看不出红边框。`aria-invalid="true"` 让屏幕阅读器读出“无效”，`aria-describedby` 关联的说明会在聚焦输入框时被读出来；页面上也显示了文字。

测试把这些要求变成了可以自动检查的条件。真实项目中还可以用 axe 这类自动化工具扫描常见问题，但它们只能发现一部分问题，键盘操作和屏幕阅读器的实际体验仍需要人工检查。
:::

:::variant{kind=alt name=visually-hidden-text}
```html file=index.html
<!doctype html>
<html lang="zh-CN">
  <head>
    <link rel="stylesheet" href="./style.css" />
  </head>
  <body>
    <section class="notice" aria-labelledby="notice-title">
      <button type="button" class="close">
        <span aria-hidden="true">×</span>
        <span class="visually-hidden">关闭通知</span>
      </button>
      <h2 id="notice-title">订阅每周更新</h2>
      <p class="hint">每周一封邮件，随时可以退订。</p>
      <form>
        <label>
          邮箱
          <input type="email" name="email" class="invalid" value="ada@" aria-invalid="true" aria-describedby="email-error email-help" />
        </label>
        <p id="email-error">⚠ 请输入有效的邮箱地址</p>
        <p id="email-help">我们不会把邮箱提供给第三方。</p>
        <button type="submit" class="subscribe">订阅</button>
      </form>
    </section>
  </body>
</html>
```
```css file=style.css
body { font-family: system-ui, sans-serif; background: #fff; }
.notice { position: relative; max-width: 420px; padding: 16px; border: 1px solid #ddd; border-radius: 8px; }
.close { position: absolute; top: 4px; right: 4px; min-width: 28px; min-height: 28px; border: 0; background: none; font-size: 18px; }
.hint { color: #333; }
.invalid { border: 2px solid #d00; }
.subscribe { padding: 4px 12px; }
button:focus { outline: 2px solid #000; outline-offset: 1px; }
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
```
:::

:::variant{kind=wrong name=contrast-still-low fails=tests reason="说明文字换成了 #888，对比度仍然不到 4.5:1"}
```html file=index.html
<!doctype html>
<html lang="zh-CN">
  <head>
    <link rel="stylesheet" href="./style.css" />
  </head>
  <body>
    <section class="notice" aria-labelledby="notice-title">
      <button type="button" class="close" aria-label="关闭通知">×</button>
      <h2 id="notice-title">订阅每周更新</h2>
      <p class="hint">每周一封邮件，随时可以退订。</p>
      <form>
        <label for="email">邮箱</label>
        <input id="email" type="email" name="email" class="invalid" value="ada@" aria-invalid="true" aria-describedby="email-error" />
        <p id="email-error">请输入有效的邮箱地址</p>
        <button type="submit" class="subscribe">订阅</button>
      </form>
    </section>
  </body>
</html>
```
```css file=style.css
body { font-family: system-ui, sans-serif; background: #fff; }
.notice { position: relative; max-width: 420px; padding: 16px; border: 1px solid #ddd; border-radius: 8px; }
.close { position: absolute; top: 4px; right: 4px; width: 32px; height: 32px; padding: 0; border: 0; background: none; font-size: 20px; line-height: 1; }
.hint { color: #888; }
.invalid { border: 2px solid #d00; }
.subscribe { padding: 4px 12px; }
button:focus-visible { outline: 3px solid #0a6cff; outline-offset: 2px; }
```
:::

:::variant{kind=wrong name=outline-removed fails=tests reason="保留了 outline: none，键盘用户看不到焦点"}
```html file=index.html
<!doctype html>
<html lang="zh-CN">
  <head>
    <link rel="stylesheet" href="./style.css" />
  </head>
  <body>
    <section class="notice" aria-labelledby="notice-title">
      <button type="button" class="close" aria-label="关闭通知">×</button>
      <h2 id="notice-title">订阅每周更新</h2>
      <p class="hint">每周一封邮件，随时可以退订。</p>
      <form>
        <label for="email">邮箱</label>
        <input id="email" type="email" name="email" class="invalid" value="ada@" aria-invalid="true" aria-describedby="email-error" />
        <p id="email-error">请输入有效的邮箱地址</p>
        <button type="submit" class="subscribe">订阅</button>
      </form>
    </section>
  </body>
</html>
```
```css file=style.css
body { font-family: system-ui, sans-serif; background: #fff; }
.notice { position: relative; max-width: 420px; padding: 16px; border: 1px solid #ddd; border-radius: 8px; }
.close { position: absolute; top: 4px; right: 4px; width: 32px; height: 32px; padding: 0; border: 0; background: none; font-size: 20px; line-height: 1; }
.hint { color: #595959; }
.invalid { border: 2px solid #d00; }
.subscribe { padding: 4px 12px; }
button:focus { outline: none; }
```
:::

:::variant{kind=wrong name=close-too-small fails=tests reason="关闭按钮有了名字，但仍然只有 16×16"}
```html file=index.html
<!doctype html>
<html lang="zh-CN">
  <head>
    <link rel="stylesheet" href="./style.css" />
  </head>
  <body>
    <section class="notice" aria-labelledby="notice-title">
      <button type="button" class="close" aria-label="关闭通知">×</button>
      <h2 id="notice-title">订阅每周更新</h2>
      <p class="hint">每周一封邮件，随时可以退订。</p>
      <form>
        <label for="email">邮箱</label>
        <input id="email" type="email" name="email" class="invalid" value="ada@" aria-invalid="true" aria-describedby="email-error" />
        <p id="email-error">请输入有效的邮箱地址</p>
        <button type="submit" class="subscribe">订阅</button>
      </form>
    </section>
  </body>
</html>
```
```css file=style.css
body { font-family: system-ui, sans-serif; background: #fff; }
.notice { position: relative; max-width: 420px; padding: 16px; border: 1px solid #ddd; border-radius: 8px; }
.close { position: absolute; top: 4px; right: 4px; width: 16px; height: 16px; padding: 0; border: 0; background: none; font-size: 12px; line-height: 1; }
.hint { color: #595959; }
.invalid { border: 2px solid #d00; }
.subscribe { padding: 4px 12px; }
button:focus-visible { outline: 3px solid #0a6cff; outline-offset: 2px; }
```
:::

:::variant{kind=wrong name=color-only-error fails=tests reason="错误仍然只用红色边框表示，没有关联文字说明"}
```html file=index.html
<!doctype html>
<html lang="zh-CN">
  <head>
    <link rel="stylesheet" href="./style.css" />
  </head>
  <body>
    <section class="notice" aria-labelledby="notice-title">
      <button type="button" class="close" aria-label="关闭通知">×</button>
      <h2 id="notice-title">订阅每周更新</h2>
      <p class="hint">每周一封邮件，随时可以退订。</p>
      <form>
        <label for="email">邮箱</label>
        <input id="email" type="email" name="email" class="invalid" value="ada@" />
        <button type="submit" class="subscribe">订阅</button>
      </form>
    </section>
  </body>
</html>
```
```css file=style.css
body { font-family: system-ui, sans-serif; background: #fff; }
.notice { position: relative; max-width: 420px; padding: 16px; border: 1px solid #ddd; border-radius: 8px; }
.close { position: absolute; top: 4px; right: 4px; width: 32px; height: 32px; padding: 0; border: 0; background: none; font-size: 20px; line-height: 1; }
.hint { color: #595959; }
.invalid { border: 2px solid #d00; }
.subscribe { padding: 4px 12px; }
button:focus-visible { outline: 3px solid #0a6cff; outline-offset: 2px; }
```
:::
