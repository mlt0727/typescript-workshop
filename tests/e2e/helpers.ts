import { expect, type Locator, type Page } from '@playwright/test';

export const A08 = '/learn/a08-optional-chaining-nullish';
export const D07 = '/learn/d07-events';
export const G03 = '/learn/g03-events-state';

/** 用整段文本替换一个代码块编辑器中当前文件的内容（insertText 不触发自动补全括号） */
export async function setEditor(block: Locator, code: string) {
  const content = block.locator('.cm-content').first();
  await content.click();
  await block.page().keyboard.press('ControlOrMeta+A');
  await block.page().keyboard.insertText(code);
}

export function block(page: Page, id: string): Locator {
  return page.locator(`[data-block="${id}"]`);
}

export async function waitTypecheck(b: Locator) {
  await expect(b.locator('.diagnostics-summary')).toBeVisible({ timeout: 30_000 });
  await expect(b.locator('.diagnostics-summary')).not.toContainText('正在类型检查', { timeout: 30_000 });
}

export async function submit(b: Locator) {
  await b.getByRole('button', { name: /提交检查/ }).click();
  await expect(b.getByRole('button', { name: /提交检查/ })).toBeEnabled({ timeout: 30_000 });
  await expect(b.locator('.result')).toBeVisible({ timeout: 30_000 });
}

export async function activeRuns(page: Page): Promise<number> {
  return page.evaluate(() => (window as unknown as { __tsw_debug: { activeRunCount(): number } }).__tsw_debug.activeRunCount());
}

export const GET_CITY_TYPE_ERROR_BUT_RUNS = `export type Order = {
  id: number;
  customer?: { name: string; address?: { city: string } };
};

export function getCity(order: Order): string | undefined {
  const city: string = order.customer?.address?.city;
  return city;
}
`;

export const GET_CITY_CORRECT = `export type Order = {
  id: number;
  customer?: { name: string; address?: { city: string } };
};

export function getCity(order: Order): string | undefined {
  return order.customer?.address?.city;
}
`;
