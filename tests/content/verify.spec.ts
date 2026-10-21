/**
 * 课程内容验证：对每个草稿/已发布课时，在真实浏览器中运行全部示例与练习变体。
 * 结果写入 content/verification.json（提交到仓库），content:check 据此检查已发布课时是否通过验证。
 * 只验证部分课时：CONTENT_LESSONS=a08-optional-chaining-nullish,g03-events-state npm run content:verify
 * 打印每一项的详情（例如示例的输出）：CONTENT_VERBOSE=1
 */
import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import type {} from '../../src/verify/main.ts';
import { lessonSourceHash } from '../../scripts/content/source-hash.ts';

const root = path.resolve(import.meta.dirname, '../..');
const reportFile = path.join(root, 'content', 'verification.json');

interface Report {
  tsVersion: string;
  lessons: Record<string, { verifiedAt: string; sourceHash: string; ok: boolean; checks: { target: string; ok: boolean; detail: string }[] }>;
}

test('课程内容在真实浏览器中通过验证', async ({ page }, info) => {
  // 验证记录（content/verification.json）以 Chromium 的结果为准；其他浏览器只报告失败项
  const writeReport = info.project.name === 'content';
  page.setDefaultTimeout(120_000);
  await page.goto('/verify.html');
  await page.waitForFunction(() => window.__tsw_verify_ready === true);
  const all = await page.evaluate(() => window.__tsw_verify.listLessonIds());
  const only = process.env.CONTENT_LESSONS?.split(',').map((s) => s.trim()).filter(Boolean);
  const ids = only ? all.filter((id) => only.includes(id)) : all;
  expect(ids.length).toBeGreaterThan(0);

  const report: Report = fs.existsSync(reportFile) ? JSON.parse(fs.readFileSync(reportFile, 'utf8')) : { tsVersion: '6.0.3', lessons: {} };
  const failures: string[] = [];
  for (const id of ids) {
    const checks = await page.evaluate((lessonId) => window.__tsw_verify.verifyLesson(lessonId), id);
    const ok = checks.every((c) => c.ok);
    report.lessons[id] = { verifiedAt: new Date().toISOString(), sourceHash: lessonSourceHash(path.join(root, 'content'), id), ok, checks: checks.map(({ target, ok, detail }) => ({ target, ok, detail })) };
    const bad = checks.filter((c) => !c.ok);
    console.log(`${ok ? '✓' : '✗'} ${id}：${checks.length - bad.length}/${checks.length} 项通过`);
    // CONTENT_VERBOSE=1：打印每一项的详情（例如在 WebKit 中查看示例的输出）
    if (process.env.CONTENT_VERBOSE) for (const c of checks.filter((c) => c.ok)) console.log(`    ✓ ${c.target}：${c.detail}`);
    for (const b of bad) {
      console.log(`    ✗ ${b.target}：${b.detail}`);
      failures.push(`${id} ${b.target}`);
    }
  }
  // 删除已不存在的课时记录
  for (const id of Object.keys(report.lessons)) if (!all.includes(id)) delete report.lessons[id];
  report.lessons = Object.fromEntries(Object.entries(report.lessons).sort(([a], [b]) => a.localeCompare(b)));
  if (writeReport) fs.writeFileSync(reportFile, `${JSON.stringify(report, null, 2)}\n`);
  expect(failures).toEqual([]);
});
