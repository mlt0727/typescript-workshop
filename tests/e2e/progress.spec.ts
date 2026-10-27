import fs from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import catalog from '../../src/generated/catalog.json' with { type: 'json' };
import { A08, D07 } from './helpers.ts';

type CatalogLesson = (typeof catalog.stages)[number]['lessons'][number];

/** 一节课“做完”的记录：全部练习通过过，测验全部答对过（不包括读到课末） */
function finished(l: CatalogLesson) {
  const ids = (l as { exerciseIds?: string[] }).exerciseIds ?? [];
  const quizCount = (l as { quizCount?: number }).quizCount ?? 0;
  return {
    lessonId: l.id,
    lessonVersion: (l as { version?: number }).version ?? 1,
    readBlocks: [],
    exercises: Object.fromEntries(ids.map((id) => [id, { passedAt: 1, updatedAt: 1 }])),
    quiz: Object.fromEntries(Array.from({ length: quizCount }, (_, i) => [`q${i}`, { selected: ['a'], correct: true, everCorrect: true, at: 1 }])),
    playgrounds: {},
    updatedAt: 1,
  };
}

async function importProgress(page: Page, lessons: CatalogLesson[]) {
  await page.goto('/settings');
  const file = {
    format: 'typescript-workshop-progress',
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    state: { lessons: Object.fromEntries(lessons.map((l) => [l.id, finished(l)])), drafts: {}, meta: {} },
  };
  await page.locator('input[type="file"]').setInputFiles({ name: 'p.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(file)) });
  await expect(page.locator('.notice-ok')).toContainText('已合并导入');
}

async function exportProgress(page: Page): Promise<{ lessons: Record<string, { finishedReadingAt?: number; readBlocks: string[] }> }> {
  await page.goto('/settings');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: /导出进度/ }).click();
  const path = await (await download).path();
  return (JSON.parse(fs.readFileSync(path, 'utf8')) as { state: { lessons: Record<string, { finishedReadingAt?: number; readBlocks: string[] }> } }).state;
}

test.describe('完成标记', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('练习全部通过、测验全部答对的课在左侧栏打勾；一个阶段的课全部完成，阶段标题也打勾', async ({ page }) => {
    // 课最少的阶段
    const stage = [...catalog.stages].sort((a, b) => a.lessons.length - b.lessons.length)[0];
    if (!stage) throw new Error('没有阶段');
    const [first] = stage.lessons;
    if (!first) throw new Error('阶段没有课');
    const section = page.locator('.toc-stage').filter({ hasText: stage.title });

    await importProgress(page, [first]);
    await expect(section.locator('.toc-stage-count')).toContainText(`1/${stage.lessons.length}`);
    await expect(section.locator(`a[href$="/learn/${first.id}"]`)).toContainText('（已完成）');
    await expect(section.locator('.toc-lesson.state-completed')).toHaveCount(1);
    await expect(section).not.toHaveClass(/stage-completed/);

    await importProgress(page, stage.lessons);
    await expect(section).toHaveClass(/stage-completed/);
    await expect(section.locator('.toc-stage-count')).toContainText(`${stage.lessons.length}/${stage.lessons.length}`);
    await expect(section.locator('.toc-stage-count')).toContainText('本阶段已全部完成');
    await expect(section.locator('.toc-lesson.state-completed')).toHaveCount(stage.lessons.length);
  });

  test('滚到课末会记下“读到课末”；在课之间切换后，同名的段落也会被记为已读', async ({ page }) => {
    const readAll = async () => {
      await expect(page.locator('.read-sentinel').first()).toBeAttached({ timeout: 30_000 });
      for (const s of await page.locator('.read-sentinel').all()) await s.scrollIntoViewIfNeeded();
      await page.waitForTimeout(400);
    };
    await page.goto(A08);
    await readAll();
    // 不刷新页面，用目录切换到另一课：两课都有 p1 这样的段落 id
    await page.locator('#sidebar').getByRole('link', { name: /事件监听/ }).click();
    await expect(page).toHaveURL(new RegExp(D07));
    await readAll();
    // 等进度写入 IndexedDB
    await page.waitForTimeout(800);
    const state = await exportProgress(page);
    expect(typeof state.lessons['a08-optional-chaining-nullish']?.finishedReadingAt).toBe('number');
    expect(typeof state.lessons['d07-events']?.finishedReadingAt).toBe('number');
    expect(state.lessons['d07-events']?.readBlocks).toContain('p1');
  });
});
