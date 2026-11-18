import { expect, test, type Page } from '@playwright/test';
import catalog from '../../src/generated/catalog.json' with { type: 'json' };
import { A08, block, GET_CITY_CORRECT, setEditor, submit, waitTypecheck } from './helpers.ts';

type CatalogLesson = (typeof catalog.stages)[number]['lessons'][number];
const lessons = catalog.stages.flatMap((s) => s.lessons);
const lessonById = (id: string) => {
  const l = lessons.find((x) => x.id === id);
  if (!l) throw new Error(`没有课时 ${id}`);
  return l;
};

/** 导入“做完了”的进度：全部练习通过过，测验全部答对过 */
async function importFinished(page: Page, list: CatalogLesson[], quizIds: Record<string, string[]>) {
  const state = {
    lessons: Object.fromEntries(
      list.map((l) => [
        l.id,
        {
          lessonId: l.id,
          lessonVersion: (l as { version?: number }).version ?? 1,
          readBlocks: [],
          exercises: Object.fromEntries(((l as { exerciseIds?: string[] }).exerciseIds ?? []).map((id) => [id, { passedAt: 1, updatedAt: 1 }])),
          quiz: Object.fromEntries((quizIds[l.id] ?? []).map((id) => [id, { selected: ['a'], correct: true, everCorrect: true, at: 1 }])),
          playgrounds: {},
          updatedAt: 1,
        },
      ]),
    ),
    drafts: {},
    meta: {},
  };
  await page.goto('/settings');
  const file = { format: 'typescript-workshop-progress', schemaVersion: 1, exportedAt: new Date().toISOString(), state };
  await page.locator('input[type="file"]').setInputFiles({ name: 'p.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(file)) });
  await expect(page.locator('.notice-ok')).toContainText('已合并导入');
}

test.describe('一节课怎么往下走', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('课页顶部列出本课要完成的内容，点击跳到那里；课末的小结列出还差什么，并给出下一课', async ({ page }) => {
    await page.goto(A08);
    const steps = page.locator('.lesson-steps li');
    await expect(steps).toHaveText([/小任务：安全地读取收货城市/, /小任务：不要吞掉用户的设置/, /编程挑战：生成用户资料摘要/, /小测验（0\/3 题）/]);

    await steps.nth(2).getByRole('button').click();
    await expect(block(page, 'format-profile')).toBeInViewport();
    await expect(block(page, 'format-profile')).toBeFocused();

    const finish = page.locator('.lesson-finish');
    await expect(finish.getByRole('heading')).toHaveText('这一课还差');
    await expect(finish.locator('.finish-remaining li')).toHaveCount(4);
    const next = finish.getByRole('link', { name: /下一课：条件与循环的快速迁移/ });
    await expect(next).not.toHaveClass(/btn-primary/);
    await finish.locator('.finish-remaining').getByRole('button', { name: /小测验/ }).click();
    await expect(page.locator('[data-block="quiz"]')).toBeInViewport();
  });

  test('练习通过之后，结果里有“继续”按钮，跳到下一个练习；顶部的清单和课末的小结跟着更新', async ({ page }) => {
    await page.goto(A08);
    const ex = block(page, 'get-city');
    await ex.scrollIntoViewIfNeeded();
    await waitTypecheck(ex);
    await setEditor(ex, GET_CITY_CORRECT);
    await submit(ex);
    await expect(ex.locator('.result-head')).toContainText('通过全部检查');
    await expect(page.locator('.lesson-steps li').first()).toHaveClass(/done/);
    await expect(page.locator('.lesson-finish .finish-remaining li')).toHaveCount(3);

    await ex.getByRole('button', { name: /继续：小任务“不要吞掉用户的设置”/ }).click();
    await expect(block(page, 'with-defaults')).toBeInViewport();

    // 改了代码之后结果过期：不再显示“继续”
    await setEditor(ex, `${GET_CITY_CORRECT}\n// 改动\n`);
    await expect(ex.getByRole('button', { name: /继续：/ })).toHaveCount(0);
  });

  test('全部做完的课：小结显示完成，下一课是主按钮；阶段的最后一课指向下一个阶段', async ({ page }) => {
    const a08 = lessonById('a08-optional-chaining-nullish');
    const b17 = lessonById('b17-enums-and-alternatives');
    await importFinished(page, [a08, b17], {
      [a08.id]: ['predict-or-nullish', 'which-trigger', 'short-circuit'],
      [b17.id]: ['enum-runtime', 'erasable', 'derived-type', 'string-enum-vs-union'],
    });
    await page.goto(A08);
    const finish = page.locator('.lesson-finish');
    await expect(finish).toHaveClass(/complete/);
    await expect(finish.getByRole('heading')).toHaveText('这一课完成了');
    await expect(page.locator('.lesson-steps li.done')).toHaveCount(4);
    const next = finish.getByRole('link', { name: /下一课：条件与循环的快速迁移/ });
    await expect(next).toHaveClass(/btn-primary/);
    await next.click();
    await expect(page).toHaveURL(/a09-control-flow/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('条件与循环的快速迁移');

    await page.goto('/learn/b17-enums-and-alternatives');
    await expect(page.locator('.lesson-finish').getByRole('link', { name: /进入 D 阶段：HTML 语义结构/ })).toBeVisible();
  });

  test('课文里提到的课时编号是链接，在应用内打开那一课', async ({ page }) => {
    await page.goto('/learn/a01-where-ts-runs');
    const ref = page.locator('a.lesson-ref', { hasText: 'a03' }).first();
    await expect(ref).toHaveAttribute('title', 'let/const、类型注解与类型推断');
    await page.evaluate(() => ((window as unknown as { __stay: boolean }).__stay = true));
    await ref.click();
    await expect(page).toHaveURL(/\/learn\/a03-let-const-inference$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('let/const、类型注解与类型推断');
    // 没有重新加载页面
    expect(await page.evaluate(() => (window as unknown as { __stay?: boolean }).__stay)).toBe(true);
  });
});

test.describe('学习顺序与目录', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('每节课的先修课都排在它前面；“下一课”按目录的顺序', async ({ page }) => {
    const position = new Map(lessons.map((l, i) => [l.id, i]));
    const late = lessons.flatMap((l) => l.prerequisites.filter((p) => (position.get(p) ?? -1) > (position.get(l.id) ?? 0)).map((p) => `${l.id} 的先修课 ${p}`));
    expect(late).toEqual([]);
    expect(catalog.stages.map((s) => s.id)).toEqual(['A', 'B', 'D', 'E', 'C', 'F', 'G', 'P1', 'P2', 'H', 'P3']);

    await page.goto('/learn/f03-tsconfig');
    await expect(page.locator('.lesson-finish').getByRole('link', { name: /下一课：模块与 \.d\.ts 基础/ })).toBeVisible();
  });

  test('目录默认只展开当前的阶段；换到另一个阶段的课，那个阶段展开，当前的课在目录中可见', async ({ page }) => {
    await page.goto('/learn/g03-events-state');
    const sidebar = page.locator('#sidebar');
    await expect(sidebar.locator('.toc-stage-toggle[aria-expanded="true"]')).toHaveText(/G\. React \+ TypeScript/);
    await expect(sidebar.locator('a.active')).toBeInViewport();
    await expect(sidebar.getByRole('link', { name: /TS、JS、浏览器与 Node\.js 的关系/ })).toHaveCount(0);

    // 展开最后一个阶段，点最后一课
    await sidebar.getByRole('button', { name: /P3\. 项目 3/ }).click();
    await sidebar.getByRole('link', { name: /部署服务端应用/ }).click();
    await expect(page).toHaveURL(/i03-deploy-server/);
    await expect(sidebar.locator('a.active')).toHaveText(/部署服务端应用/);
    await expect(sidebar.locator('a.active')).toBeInViewport();
    // 离开的阶段（没有手动展开过）收起
    await expect(sidebar.getByRole('link', { name: /事件与 state/ })).toHaveCount(0);
  });

  test('首页：阶段的进度是学习者完成的课时；默认展开要学的阶段，其他阶段可以展开', async ({ page }) => {
    const a01 = lessonById('a01-where-ts-runs');
    await importFinished(page, [a01], { [a01.id]: ['predict-concat', 'true-statements', 'document-in-worker'] });
    await page.goto('/');
    await expect(page.locator('.continue-card')).toContainText(`已完成 1 / ${catalog.counts.published} 节`);
    await expect(page.locator('.continue-card')).toContainText('编译期与运行期：类型擦除的边界');
    const stageA = page.locator('.roadmap-stage').first();
    await expect(stageA.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1');
    await expect(stageA.locator('.roadmap-lessons li.state-completed')).toHaveCount(1);
    const stageB = page.locator('.roadmap-stage').nth(1);
    await expect(stageB.locator('.roadmap-lessons')).toHaveCount(0);
    await stageB.getByRole('button').click();
    await expect(stageB.locator('.roadmap-lessons li')).toHaveCount(17);
  });
});
