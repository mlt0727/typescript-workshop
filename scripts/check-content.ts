/**
 * 课程发布验收的静态检查（在 content:build 之后运行）：
 *   - 已发布课时必须有“与当前源文件一致”的浏览器验证记录，且全部通过（content/verification.json）；
 *   - 已发布课时：至少 1 个编程挑战、2–4 道测验、参考资料带检查日期；
 *     每个练习有方向提示与更具体提示、参考解解释、≥2 个错误解（或写明不适用的原因）、≥1 个替代正确解；
 *   - 非代表案例的已发布课时，先修课必须都已发布（主线连续）；
 *   - 草稿只给出提醒，不阻止构建。
 * 用法：tsx scripts/check-content.ts [--links]   （--links 额外检查参考链接是否可访问）
 */
import fs from 'node:fs';
import path from 'node:path';
import { TS_VERSION } from '../src/compiler/config.ts';
import type { Catalog, Lesson, VerifyData } from '../src/content/types.ts';
import { lessonSourceHash } from './content/source-hash.ts';

const root = path.resolve(import.meta.dirname, '..');
const gen = path.join(root, 'src', 'generated');
const contentDir = path.join(root, 'content');

const catalog = JSON.parse(fs.readFileSync(path.join(gen, 'catalog.json'), 'utf8')) as Catalog;
const verifyData = JSON.parse(fs.readFileSync(path.join(gen, 'verify.json'), 'utf8')) as VerifyData;
const reportFile = path.join(contentDir, 'verification.json');
const report = fs.existsSync(reportFile)
  ? (JSON.parse(fs.readFileSync(reportFile, 'utf8')) as {
      tsVersion: string;
      lessons: Record<string, { sourceHash: string; ok: boolean; verifiedAt: string }>;
    })
  : { tsVersion: TS_VERSION, lessons: {} };

const errors: string[] = [];
const warnings: string[] = [];

const all = catalog.stages.flatMap((s) => s.lessons);
const status = new Map(all.map((l) => [l.id, l.status]));

for (const meta of all) {
  if (meta.status === 'planned') continue;
  const lesson = JSON.parse(fs.readFileSync(path.join(gen, 'lessons', `${meta.id}.json`), 'utf8')) as Lesson;
  const problems: string[] = [];

  const rec = report.lessons[meta.id];
  const hash = lessonSourceHash(contentDir, meta.id);
  if (!rec) problems.push('没有浏览器验证记录（运行 npm run content:verify）');
  else if (!rec.ok) problems.push('最近一次浏览器验证未全部通过');
  else if (rec.sourceHash !== hash) problems.push(`验证记录已过期：源文件已修改（记录 ${rec.sourceHash}，当前 ${hash}）`);
  if (report.tsVersion !== TS_VERSION) problems.push(`验证使用的 TypeScript ${report.tsVersion} 与当前 ${TS_VERSION} 不一致`);

  const exercises = Object.values(lesson.exercises);
  if (!exercises.some((e) => e.kind === 'challenge')) problems.push('缺少编程挑战');
  if (lesson.quiz.length < 2 || lesson.quiz.length > 4) problems.push(`测验应为 2–4 题，实际 ${lesson.quiz.length} 题`);
  if (lesson.references.length === 0) problems.push('缺少参考资料');
  if (lesson.blocks.filter((b) => b.kind === 'playground').length === 0) problems.push('没有可运行的示例');

  for (const ex of exercises) {
    const where = `练习 ${ex.id}`;
    if (!ex.hints.some((h) => h.level === 1)) problems.push(`${where} 缺少方向提示`);
    if (!ex.hints.some((h) => h.level === 2)) problems.push(`${where} 缺少更具体的提示`);
    if (!ex.explanationHtml) problems.push(`${where} 缺少参考解解释`);
    const v = verifyData.exercises.find((e) => e.lessonId === meta.id && e.exerciseId === ex.id);
    const wrong = v?.variants.filter((x) => x.kind === 'wrong').length ?? 0;
    const alt = v?.variants.filter((x) => x.kind === 'alt').length ?? 0;
    if (wrong < 2 && !v?.wrongNotApplicable) problems.push(`${where} 只有 ${wrong} 个错误解（至少 2 个，或写明 wrongNotApplicable）`);
    if (alt < 1) problems.push(`${where} 没有替代的正确解`);
    const starter = JSON.stringify(ex.starter.map((f) => f.content));
    const solution = JSON.stringify(ex.solution.map((f) => f.content));
    if (starter === solution) problems.push(`${where} 起始代码与参考解相同`);
  }

  if (meta.status === 'published' && !lesson.representative) {
    for (const p of meta.prerequisites) {
      if (status.get(p) !== 'published') problems.push(`先修课 ${p} 尚未发布（主线必须连续；提前编写的课请标记 representative）`);
    }
  }

  for (const p of problems) (meta.status === 'published' ? errors : warnings).push(`${meta.id}: ${p}`);
}

async function checkLinks() {
  const urls = new Set<string>();
  for (const meta of all) {
    if (meta.status === 'planned') continue;
    const lesson = JSON.parse(fs.readFileSync(path.join(gen, 'lessons', `${meta.id}.json`), 'utf8')) as Lesson;
    for (const r of lesson.references) urls.add(r.url);
  }
  for (const url of urls) {
    try {
      const res = await fetch(url, { method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(20_000) });
      if (!res.ok) errors.push(`参考链接不可访问（HTTP ${res.status}）：${url}`);
    } catch (err) {
      warnings.push(`无法检查参考链接（网络错误）：${url} ${err instanceof Error ? err.message : ''}`);
    }
  }
  console.log(`已检查 ${urls.size} 个参考链接`);
}

if (process.argv.includes('--links')) await checkLinks();

for (const w of warnings) console.log(`  ⚠ ${w}`);
for (const e of errors) console.error(`  ✗ ${e}`);
console.log(
  `课程检查：已发布 ${catalog.counts.published}、草稿 ${catalog.counts.draft}、规划 ${catalog.counts.planned}；错误 ${errors.length}，提醒 ${warnings.length}`,
);
if (errors.length > 0) process.exit(1);
