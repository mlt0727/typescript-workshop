import { expect, test, type Page } from '@playwright/test';
import { SYNC_TEST_PASSWORD } from '../../playwright.sync.config.ts';
import { A08, block, GET_CITY_CORRECT, setEditor, submit } from '../e2e/helpers.ts';

async function enableSync(page: Page, password: string) {
  await page.goto('/settings');
  await page.getByLabel('同步密码').fill(password);
  await page.getByRole('button', { name: '开启同步' }).click();
}

test('错误的同步密码被拒绝，不会保存', async ({ page }) => {
  await enableSync(page, 'tsw-WRONG-PASSW-ORD00-00000-00000');
  await expect(page.getByRole('alert')).toContainText('同步密码不正确');
  await expect(page.getByRole('button', { name: '开启同步' })).toBeVisible();
});

test('两台“设备”用同一密码同步草稿与通过记录', async ({ browser }) => {
  // 设备 A：学习并开启同步
  const a = await browser.newContext();
  const pa = await a.newPage();
  await pa.goto(A08);
  const ex = block(pa, 'get-city');
  await ex.scrollIntoViewIfNeeded();
  await setEditor(ex, GET_CITY_CORRECT);
  await submit(ex);
  await expect(ex.locator('.result-head')).toContainText('通过全部检查');
  const pg = block(pa, 'forms');
  await pg.scrollIntoViewIfNeeded();
  await setEditor(pg, 'console.log("来自设备 A 的草稿");\n');
  await pa.waitForTimeout(800);
  await enableSync(pa, SYNC_TEST_PASSWORD);
  await expect(pa.locator('.settings-section', { hasText: '跨设备同步' })).toContainText('已同步');

  // 设备 B：全新的浏览器上下文（独立的 IndexedDB），输入同一密码
  const b = await browser.newContext();
  const pb = await b.newPage();
  await enableSync(pb, SYNC_TEST_PASSWORD);
  await expect(pb.locator('.settings-section', { hasText: '跨设备同步' })).toContainText('已同步');
  await pb.goto(A08);
  const exB = block(pb, 'get-city');
  await exB.scrollIntoViewIfNeeded();
  await expect(exB.locator('.status-chips')).toContainText(/曾于 .* 通过/);
  const pgB = block(pb, 'forms');
  await pgB.scrollIntoViewIfNeeded();
  await expect(pgB.locator('.cm-content')).toContainText('来自设备 A 的草稿');

  // 设备 B 做的修改，A 在重新同步后也能看到
  await setEditor(pgB, 'console.log("设备 B 改过");\n');
  await pb.waitForTimeout(800);
  await pb.goto('/settings');
  await pb.getByRole('button', { name: '立即同步' }).click();
  await expect(pb.locator('.settings-section', { hasText: '跨设备同步' })).toContainText('已同步');

  await pa.goto('/settings');
  await pa.getByRole('button', { name: '立即同步' }).click();
  await expect(pa.locator('.settings-section', { hasText: '跨设备同步' })).toContainText('已同步');
  await pa.goto(A08);
  await block(pa, 'forms').scrollIntoViewIfNeeded();
  await expect(block(pa, 'forms').locator('.cm-content')).toContainText('设备 B 改过');

  await a.close();
  await b.close();
});
