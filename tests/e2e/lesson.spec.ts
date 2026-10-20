import { expect, test } from '@playwright/test';
import { A08, activeRuns, block, D07, G03, GET_CITY_CORRECT, GET_CITY_TYPE_ERROR_BUT_RUNS, setEditor, submit, waitTypecheck } from './helpers.ts';

test.describe('课内学习闭环', () => {
  test('改代码并运行，看到结果；改动后旧输出被标为过期', async ({ page }) => {
    await page.goto(A08);
    const pg = block(page, 'forms');
    await pg.scrollIntoViewIfNeeded();
    await pg.getByRole('button', { name: '运行' }).click();
    await expect(pg.locator('.console-status')).toContainText('运行结束');
    await expect(pg.locator('.console-lines')).toContainText('bobby');

    await setEditor(pg, 'console.log("hello", [1, 2]);\n');
    await expect(pg.locator('.stale-badge')).toBeVisible();
    await pg.getByRole('button', { name: '运行' }).click();
    await expect(pg.locator('.console-lines')).toHaveText("hello [ 1, 2 ]");
    await expect(pg.locator('.stale-badge')).toHaveCount(0);
  });

  test('查看 JS：显示擦除类型后的代码，并跟随编辑更新', async ({ page }) => {
    await page.goto(A08);
    const pg = block(page, 'forms');
    await pg.scrollIntoViewIfNeeded();
    await pg.getByRole('button', { name: '查看 JS' }).click();
    const preview = pg.locator('.js-preview pre');
    await expect(preview).toContainText("const ada = { name: 'Ada', tags: ['math'] };");
    await expect(preview).not.toContainText('type User');
    await expect(preview).not.toContainText('export {}');

    await setEditor(pg, 'const total: number = 1 + 2;\nconsole.log(total);\n');
    await expect(preview).toHaveText('const total = 1 + 2;\nconsole.log(total);');
    await pg.getByRole('button', { name: '隐藏 JS' }).click();
    await expect(pg.locator('.js-preview')).toHaveCount(0);
  });

  test('判题：起始代码不通过；能运行但有类型错误的答案不通过；正确答案通过；修改后结果失效；刷新后恢复', async ({ page }) => {
    await page.goto(A08);
    const ex = block(page, 'get-city');
    await ex.scrollIntoViewIfNeeded();
    await waitTypecheck(ex);

    await submit(ex);
    await expect(ex.locator('.result-head')).toContainText('还没有通过');

    // 行为正确、但有类型错误：不能通过
    await setEditor(ex, GET_CITY_TYPE_ERROR_BUT_RUNS);
    await submit(ex);
    await expect(ex.locator('.result-head')).toContainText('还没有通过');
    await expect(ex.locator('.result-section.fail', { hasText: '类型检查' })).toHaveCount(1);
    await expect(ex.locator('.result-section.ok', { hasText: '行为测试' })).toHaveCount(1);
    await expect(ex.locator('.result')).toContainText('TS2322');

    await setEditor(ex, GET_CITY_CORRECT);
    await submit(ex);
    await expect(ex.locator('.result-head')).toContainText('通过全部检查');
    await expect(ex.locator('.status-chips')).toContainText('当前代码通过验收');

    // 编辑后，旧的通过结果失效
    await setEditor(ex, `${GET_CITY_CORRECT}// 改了一点\n`);
    await expect(ex.locator('.status-chips')).toContainText('上次提交结果已过期');
    await expect(ex.locator('.result')).toContainText('已经过期');
    await expect(ex.locator('.status-chips')).toContainText('通过'); // 历史记录：曾通过

    // 刷新：草稿与历史状态都恢复
    await page.waitForTimeout(800); // 草稿写入数据库有 400ms 防抖
    await page.reload();
    const again = block(page, 'get-city');
    await again.scrollIntoViewIfNeeded();
    await expect(again.locator('.cm-content')).toContainText('// 改了一点');
    await expect(again.locator('.status-chips')).toContainText(/曾于 .* 通过/);
    await expect(again.locator('.result')).toContainText('已经过期');
  });

  test('提示逐级展开；查看答案需要确认并被记录', async ({ page }) => {
    await page.goto(A08);
    const ex = block(page, 'with-defaults');
    await ex.scrollIntoViewIfNeeded();
    await expect(ex.locator('.hint')).toHaveCount(0);
    await ex.getByRole('button', { name: '显示方向提示' }).click();
    await expect(ex.locator('.hint')).toHaveCount(1);
    await ex.getByRole('button', { name: '显示更具体的提示' }).click();
    await expect(ex.locator('.hint')).toHaveCount(2);
    await expect(ex.locator('.solution')).toHaveCount(0);
    page.once('dialog', (d) => d.accept());
    await ex.getByRole('button', { name: '查看参考答案' }).click();
    await expect(ex.locator('.solution')).toContainText('options.pageSize ?? 20');
    await expect(ex.locator('.status-chips')).toContainText('已查看答案');
  });

  test('测验：选错显示原因，可以重新作答，刷新后保留', async ({ page }) => {
    await page.goto(A08);
    const quiz = page.locator('[data-block="quiz"]');
    await quiz.scrollIntoViewIfNeeded();
    const q1 = quiz.locator('.quiz-question').first();
    await q1.getByRole('radio').nth(1).check();
    await q1.getByRole('button', { name: '提交答案' }).click();
    await expect(q1).toContainText('回答不正确');
    await expect(q1.locator('.quiz-option.wrong')).toContainText('只在左边为');
    await q1.getByRole('button', { name: '重新作答' }).click();
    await q1.getByRole('radio').first().check();
    await q1.getByRole('button', { name: '提交答案' }).click();
    await expect(q1).toContainText('回答正确');
    await page.reload();
    const q1b = page.locator('[data-block="quiz"] .quiz-question').first();
    await expect(q1b).toContainText('回答正确');
    await expect(q1b).toContainText('曾答对');
  });

  test('纯 TS 死循环可以停止；切换课时会清理运行中的沙箱', async ({ page }) => {
    await page.goto(A08);
    const pg = block(page, 'forms');
    await pg.scrollIntoViewIfNeeded();
    await setEditor(pg, 'console.log("start");\nwhile (true) {}\n');
    await pg.getByRole('button', { name: '运行' }).click();
    await expect(pg.locator('.console-lines')).toContainText('start');
    await expect(pg.locator('.console-status')).toContainText('运行中');
    await pg.getByRole('button', { name: '停止' }).click();
    await expect(pg.locator('.console-status')).toContainText('已停止');
    expect(await activeRuns(page)).toBe(0);

    // 再次运行死循环，然后直接切到别的课
    await pg.getByRole('button', { name: '运行' }).click();
    await expect(pg.locator('.console-status')).toContainText('运行中');
    expect(await activeRuns(page)).toBe(1);
    await page.getByRole('link', { name: /事件监听/ }).first().click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('事件监听');
    await expect.poll(() => activeRuns(page), { timeout: 5000 }).toBe(0);
  });
});

test.describe('网页与 React 预览', () => {
  test('DOM：预览中的按钮确实改变页面', async ({ page }) => {
    await page.goto(D07);
    const pg = block(page, 'first-listener');
    await pg.scrollIntoViewIfNeeded();
    await pg.getByRole('button', { name: '运行' }).click();
    const frame = pg.frameLocator('iframe.sandbox-frame');
    await frame.getByRole('button', { name: /点赞/ }).click();
    await frame.getByRole('button', { name: /点赞/ }).click();
    await expect(frame.locator('#count')).toHaveText('2');
    await expect(pg.locator('.console-lines')).toContainText('第 2 次点击');
  });

  test('React：预览中的 state 更新确实发生', async ({ page }) => {
    await page.goto(G03);
    const pg = block(page, 'snapshot');
    await pg.scrollIntoViewIfNeeded();
    await pg.getByRole('button', { name: '运行' }).click();
    const frame = pg.frameLocator('iframe.sandbox-frame');
    await frame.getByRole('button', { name: '+3（更新函数）' }).click();
    await expect(frame.getByText('count = 3')).toBeVisible();
    await frame.getByRole('button', { name: '+3（直接用 count）' }).click();
    await expect(frame.getByText('count = 4')).toBeVisible();
    await expect(pg.locator('.console-lines')).toContainText('处理函数里读到的 count： 3');
  });

  test('React 挑战：错误实现被拒绝，正确实现通过', async ({ page }) => {
    await page.goto(G03);
    const ex = block(page, 'like-button');
    await ex.scrollIntoViewIfNeeded();
    await submit(ex);
    await expect(ex.locator('.result-head')).toContainText('还没有通过');
    await setEditor(
      ex,
      `import { useState } from 'react';

type LikeButtonProps = { initialCount: number };

export function LikeButton({ initialCount }: LikeButtonProps) {
  const [liked, setLiked] = useState(false);
  return (
    <button type="button" aria-pressed={liked} onClick={() => setLiked(!liked)}>
      {liked ? '已赞' : '赞'} {initialCount + (liked ? 1 : 0)}
    </button>
  );
}
`,
    );
    await submit(ex);
    await expect(ex.locator('.result-head')).toContainText('通过全部检查');
  });
});
