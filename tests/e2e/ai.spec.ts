import { expect, type Page } from '@playwright/test';
import { test } from '@playwright/test';
import { A08, D07, block, setEditor } from './helpers.ts';

const MODELS = [
  { id: 'claude-haiku-5-5', label: 'Haiku 5.5', description: '最快、最便宜' },
  { id: 'claude-sonnet-5-5', label: 'Sonnet 5.5', description: '速度与质量平衡' },
  { id: 'claude-opus-5-5', label: 'Opus 5.5', description: '最强，较慢' },
];

interface AskBody {
  model?: string;
  question: string;
  blockTitle?: string;
  context?: string;
  files: Record<string, string>;
  history?: { role: string; content: string }[];
}

/** 模拟已配置的 AI 与同步：不调用真实的模型，回答是“回答 n：模型” */
async function mockAi(page: Page): Promise<AskBody[]> {
  const asked: AskBody[] = [];
  await page.addInitScript(() => localStorage.setItem('tsw:sync', JSON.stringify({ password: 'tsw-e2e-fake-password', revision: 0 })));
  await page.route('**/api/sync', (route) =>
    route.fulfill(
      route.request().method() === 'PUT'
        ? { json: { revision: 1, epoch: 'e2etest0001', updatedAt: new Date().toISOString() } }
        : { json: { revision: 0, epoch: null, state: null, updatedAt: null } },
    ),
  );
  await page.route('**/api/ai/status', (route) => route.fulfill({ json: { configured: true, model: 'claude-sonnet-5-5', models: MODELS } }));
  await page.route('**/api/ai', async (route) => {
    const body = route.request().postDataJSON() as AskBody;
    asked.push(body);
    await route.fulfill({ contentType: 'text/plain; charset=utf-8', body: `回答 ${asked.length}：${body.model}` });
  });
  return asked;
}

const dock = (page: Page) => page.getByRole('complementary', { name: 'AI 问答' });

async function ask(page: Page, question: string) {
  await dock(page).getByLabel('你的问题').fill(question);
  await dock(page).getByLabel('你的问题').press('Enter');
}

test.describe('AI 问答栏', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('宽屏默认展开；示例的“问 AI”附加代码块，每次发送带上当时的代码和所选的模型；对话按课保存', async ({ page }) => {
    const asked = await mockAi(page);
    await page.goto(A08);
    await expect(dock(page)).toBeVisible();
    const pg = block(page, 'forms');
    await pg.scrollIntoViewIfNeeded();
    await setEditor(pg, 'console.log("第一版");\n');
    await pg.getByRole('button', { name: '问 AI' }).click();
    await expect(dock(page).locator('.ai-attachment')).toContainText('示例 · main.ts');
    await expect(dock(page).getByLabel('你的问题')).toBeFocused();

    await ask(page, '这段代码输出什么？');
    await expect(dock(page).locator('.ai-assistant').last()).toContainText('回答 1：claude-sonnet-5-5');
    expect(asked[0]?.model).toBe('claude-sonnet-5-5');
    expect(asked[0]?.blockTitle).toBe('示例');
    expect(asked[0]?.files['main.ts']).toContain('第一版');

    // 改了代码、换了模型再问：带上新的代码和模型，以及之前的对话
    await setEditor(pg, 'console.log("第二版");\n');
    await dock(page).getByLabel('模型').selectOption('claude-haiku-5-5');
    await ask(page, '那现在呢？');
    await expect(dock(page).locator('.ai-assistant').last()).toContainText('回答 2：claude-haiku-5-5');
    expect(asked[1]?.files['main.ts']).toContain('第二版');
    expect(asked[1]?.history?.map((h) => h.role)).toEqual(['user', 'assistant']);
    await expect(dock(page).locator('.ai-turn-model').last()).toHaveText('Haiku 5.5');

    // 刷新之后：对话和模型都还在
    await page.reload();
    await expect(dock(page).locator('.ai-assistant')).toHaveCount(2);
    await expect(dock(page).locator('.ai-user').first()).toContainText('附：示例 · main.ts');
    await expect(dock(page).getByLabel('模型')).toHaveValue('claude-haiku-5-5');

    // 每节课一个对话
    await page.goto(D07);
    await expect(dock(page).locator('.ai-turn')).toHaveCount(0);
    await page.goto(A08);
    await expect(dock(page).locator('.ai-assistant')).toHaveCount(2);
    await dock(page).getByRole('button', { name: '新对话' }).click();
    await expect(dock(page).locator('.ai-turn')).toHaveCount(0);
    await page.reload();
    await expect(dock(page).locator('.ai-turn')).toHaveCount(0);
  });

  test('没有附加代码块时，问题带上本课的课文；移除附加之后也是', async ({ page }) => {
    const asked = await mockAi(page);
    await page.goto(A08);
    await ask(page, '这一课讲什么？');
    await expect(dock(page).locator('.ai-assistant')).toHaveCount(1);
    expect(asked[0]?.files).toEqual({});
    expect(asked[0]?.context?.length ?? 0).toBeGreaterThan(200);

    await block(page, 'get-city').getByRole('button', { name: '问 AI' }).click();
    await expect(dock(page).locator('.ai-attachment')).toContainText('“');
    await dock(page).getByRole('button', { name: '移除附加的代码块' }).click();
    await expect(dock(page).locator('.ai-attachment')).toHaveCount(0);
    await ask(page, '还有呢？');
    await expect(dock(page).locator('.ai-assistant')).toHaveCount(2);
    expect(asked[1]?.files).toEqual({});
  });

  test('拖动分隔线调整宽度并记住；方向键也能调整；顶栏的按钮收起和展开', async ({ page }) => {
    await mockAi(page);
    await page.goto(A08);
    const splitter = page.getByRole('separator', { name: /AI 问答栏的宽度/ });
    const before = (await dock(page).boundingBox())?.width ?? 0;
    const box = await splitter.boundingBox();
    if (!box) throw new Error('没有分隔线');
    await page.mouse.move(box.x + box.width / 2, box.y + 200);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 - 150, box.y + 200, { steps: 5 });
    await page.mouse.up();
    const after = (await dock(page).boundingBox())?.width ?? 0;
    expect(after - before).toBeGreaterThan(140);
    expect(after - before).toBeLessThan(160);

    await page.reload();
    expect(Math.abs(((await dock(page).boundingBox())?.width ?? 0) - after)).toBeLessThan(2);
    await splitter.focus();
    await page.keyboard.press('ArrowRight');
    expect(Math.round(((await dock(page).boundingBox())?.width ?? 0) - after)).toBe(-32);

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);

    const toggle = page.getByRole('banner').getByRole('button', { name: '问 AI' });
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await toggle.click();
    await expect(dock(page)).toHaveCount(0);
    await page.reload();
    await expect(dock(page)).toHaveCount(0);
    await page.getByRole('banner').getByRole('button', { name: '问 AI' }).click();
    await expect(dock(page)).toBeVisible();
  });

  test('窄屏：问答栏是抽屉，默认收起；示例的“问 AI”会打开它；Esc 关闭；换页后收起', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await mockAi(page);
    await page.goto(A08);
    await expect(dock(page)).toHaveCount(0);
    await page.getByRole('banner').getByRole('button', { name: '问 AI' }).click();
    await expect(dock(page)).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await dock(page).getByLabel('你的问题').press('Escape');
    await expect(dock(page)).toHaveCount(0);

    const pg = block(page, 'forms');
    await pg.scrollIntoViewIfNeeded();
    await pg.getByRole('button', { name: '问 AI' }).click();
    await expect(dock(page).locator('.ai-attachment')).toContainText('示例 · main.ts');
    await page.goto(D07);
    await expect(dock(page)).toHaveCount(0);
  });

  test('AI 没有配置时，课页没有问答栏，也没有“问 AI”按钮', async ({ page }) => {
    await page.route('**/api/ai/status', (route) => route.fulfill({ json: { configured: false, model: null, models: [] } }));
    await page.goto(A08);
    await expect(page.locator('.cm-content').first()).toBeVisible({ timeout: 30_000 });
    await expect(dock(page)).toHaveCount(0);
    await expect(page.getByRole('button', { name: '问 AI' })).toHaveCount(0);
  });
});
