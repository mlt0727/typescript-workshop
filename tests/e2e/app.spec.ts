import { expect, test } from '@playwright/test';
import catalog from '../../src/generated/catalog.json' with { type: 'json' };
import { A08, block, D07, G03, setEditor } from './helpers.ts';

/** 随内容进度变化：取目录中最后一个仍在规划中的课时 */
const PLANNED = catalog.stages.flatMap((s) => s.lessons).filter((l) => l.status === 'planned').at(-1);

test.describe('路由与生产构建资源', () => {
  test('深层路由直接打开与刷新都可用；类型库与 Worker 正常加载', async ({ page }) => {
    await page.goto(G03);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('事件与 state');
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('事件与 state');
    const pg = block(page, 'typed-events');
    await pg.scrollIntoViewIfNeeded();
    // React 类型库加载成功：没有类型错误
    await expect(pg.locator('.diagnostics-summary')).toContainText('类型检查通过', { timeout: 30_000 });
  });

  test('规划中的课时显示为不可学习，不冒充已发布', async ({ page }) => {
    test.skip(PLANNED === undefined, '课程图谱中已经没有规划中的课时');
    await page.goto(`/learn/${PLANNED?.id}`);
    await expect(page.getByText('这节课还在规划中')).toBeVisible();
    await page.goto('/');
    await expect(page.locator('.continue-card')).toContainText(`规划共 ${catalog.counts.total} 节`);
  });

  test('首页和目录如实显示已发布的数量', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.sidebar-counts')).toContainText(`已发布 ${catalog.counts.published}`);
    const { planned, draft, total } = catalog.counts;
    await expect(page.locator('.continue-card')).toContainText(planned || draft ? `规划共 ${total} 节` : `课程图谱中的 ${total} 节已全部发布`);
  });

  test('目录搜索', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('searchbox', { name: '搜索课程' }).fill('target');
    const items = page.locator('.toc-lesson');
    await expect(items).toHaveCount(1);
    await expect(items.first()).toContainText('target 与 currentTarget');
  });

  test('继续学习：回到上次打开的课时', async ({ page }) => {
    await page.goto(D07);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('事件监听');
    await page.goto('/');
    await expect(page.locator('.continue-card')).toContainText('事件监听');
    await page.getByRole('link', { name: /回到上次的位置/ }).click();
    await expect(page).toHaveURL(/d07-events/);
  });
});

test.describe('进度导出与导入', () => {
  test('非法或更新版本的进度文件被拒绝，现有数据不受影响；合法文件可以合并导入', async ({ page }) => {
    await page.goto(A08);
    const pg = block(page, 'forms');
    await pg.scrollIntoViewIfNeeded();
    await setEditor(pg, 'console.log("我的草稿");\n');
    await page.waitForTimeout(800);

    await page.goto('/settings');
    const input = page.locator('input[type="file"]');
    await input.setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{not json') });
    await expect(page.locator('.notice-error')).toContainText('不是有效的 JSON');
    await input.setInputFiles({
      name: 'future.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({ format: 'typescript-workshop-progress', schemaVersion: 99, exportedAt: 'x', state: {} })),
    });
    await expect(page.locator('.notice-error')).toContainText('更新版本');
    await input.setInputFiles({
      name: 'evil.json',
      mimeType: 'application/json',
      buffer: Buffer.from(
        JSON.stringify({
          format: 'typescript-workshop-progress',
          schemaVersion: 1,
          exportedAt: 'x',
          state: { lessons: {}, drafts: { 'a::b': { key: 'a::b', lessonId: 'a', blockId: 'b', files: { '<img src=x onerror=alert(1)>': 'x' }, baseHash: 'h', updatedAt: 1 } }, meta: {} },
        }),
      ),
    });
    await expect(page.locator('.notice-error')).toContainText('数据结构不符合要求');

    // 现有草稿仍在
    await page.goto(A08);
    await block(page, 'forms').scrollIntoViewIfNeeded();
    await expect(block(page, 'forms').locator('.cm-content')).toContainText('我的草稿');

    // 合法文件合并导入：增加一个课时的记录，不覆盖现有草稿
    await page.goto('/settings');
    const valid = {
      format: 'typescript-workshop-progress',
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      state: {
        lessons: {
          'd07-events': { lessonId: 'd07-events', lessonVersion: 1, readBlocks: ['p1'], exercises: {}, quiz: {}, playgrounds: {}, updatedAt: 5 },
        },
        drafts: {},
        meta: {},
      },
    };
    await page.locator('input[type="file"]').setInputFiles({ name: 'ok.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(valid)) });
    await expect(page.locator('.notice-ok')).toContainText('已合并导入');
    await page.goto(A08);
    await block(page, 'forms').scrollIntoViewIfNeeded();
    await expect(block(page, 'forms').locator('.cm-content')).toContainText('我的草稿');
  });

  test('导出的文件可以下载', async ({ page }) => {
    await page.goto('/settings');
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: /导出进度/ }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/^typescript-workshop-progress-\d{4}-\d{2}-\d{2}\.json$/);
  });
});

test.describe('布局', () => {
  for (const viewport of [
    { name: '手机', width: 375, height: 812 },
    { name: '平板', width: 768, height: 1024 },
    { name: '桌面', width: 1440, height: 900 },
  ]) {
    test(`${viewport.name}：没有横向溢出，编辑器不为空，按钮可见`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      for (const url of ['/', A08, D07, G03, '/settings']) {
        await page.goto(url);
        await page.waitForTimeout(300);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow, `${url} 横向溢出 ${overflow}px`).toBeLessThanOrEqual(0);
      }
      await page.goto(A08);
      const pg = block(page, 'crash');
      await pg.scrollIntoViewIfNeeded();
      await expect(pg.locator('.cm-content')).toContainText('type User');
      await expect(pg.getByRole('button', { name: '运行' })).toBeVisible();
      const box = await pg.getByRole('button', { name: '运行' }).boundingBox();
      expect(box && box.x >= 0 && box.x + box.width <= viewport.width).toBeTruthy();
    });
  }

  test('窄屏：目录是可开关的抽屉', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await expect(page.locator('#sidebar')).toHaveCount(0);
    await page.getByRole('button', { name: /展开目录/ }).click();
    await expect(page.locator('#sidebar')).toBeVisible();
    await page.locator('#sidebar').getByRole('link', { name: /事件与 state/ }).click();
    await expect(page.locator('#sidebar')).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('事件与 state');
  });

  test('深色主题与字号设置生效并被记住', async ({ page }) => {
    await page.goto('/settings');
    await page.getByLabel('主题').selectOption('dark');
    await page.getByLabel('字号').selectOption('large');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.locator('html')).toHaveAttribute('data-font-size', 'large');
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).toBe('rgb(23, 24, 27)');
  });
});
