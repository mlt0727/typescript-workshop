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
import { parse as parseYaml } from 'yaml';
import { findRawHtml } from './content/markdown.ts';
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

/** 正文、练习说明、测验中没有放进反引号的 HTML 标签（例如 `<T>`、`<input>`）会被当成文字显示，应该写成行内代码 */
function rawHtmlIn(lessonId: string): string[] {
  const dir = path.join(contentDir, 'lessons', lessonId);
  const sources: { where: string; text: string }[] = [];
  const stripFrontmatter = (text: string) => text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '');
  sources.push({ where: 'lesson.md', text: stripFrontmatter(fs.readFileSync(path.join(dir, 'lesson.md'), 'utf8')) });
  const exDir = path.join(dir, 'exercises');
  if (fs.existsSync(exDir)) {
    for (const f of fs.readdirSync(exDir)) sources.push({ where: `exercises/${f}`, text: stripFrontmatter(fs.readFileSync(path.join(exDir, f), 'utf8')) });
  }
  const quizFile = path.join(dir, 'quiz.yaml');
  if (fs.existsSync(quizFile)) {
    const quiz = parseYaml(fs.readFileSync(quizFile, 'utf8')) as { id: string; prompt: string; explain?: string; options: { text: string; explain: string }[] }[];
    for (const q of quiz) {
      for (const t of [q.prompt, q.explain ?? '', ...q.options.flatMap((o) => [o.text, o.explain])]) sources.push({ where: `quiz.yaml（${q.id}）`, text: String(t) });
    }
  }
  return sources.flatMap(({ where, text }) =>
    findRawHtml(text).map((html) => `${where} 中出现了原始 HTML ${JSON.stringify(html)}：它会被当成文字显示，请用反引号写成行内代码`),
  );
}

/**
 * 只有大小写不同的文件名（去掉扩展名后比较）：沙箱的虚拟文件系统区分大小写，
 * 但 Windows、macOS 默认不区分。例如同时有 catalog.ts 和 Catalog.tsx 时，下载到本机后 `./Catalog` 会解析到 catalog.ts。
 */
function caseCollisions(paths: readonly string[]): string[] {
  const byKey = new Map<string, Set<string>>();
  for (const p of paths) {
    const key = p.replace(/\.[^./]+$/, '').toLowerCase();
    byKey.set(key, (byKey.get(key) ?? new Set()).add(p.replace(/\.[^./]+$/, '')));
  }
  return [...byKey.values()].filter((stems) => stems.size > 1).map((stems) => [...stems].join('、'));
}

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
    const paths = [...ex.starter, ...ex.support, ...ex.tests, ...ex.solution].map((f) => f.path);
    for (const c of caseCollisions(paths)) errors.push(`${meta.id}: ${where} 的文件名只有大小写不同（${c}）：在不区分大小写的文件系统上会互相冲突`);
  }
  for (const b of lesson.blocks) {
    if (b.kind !== 'playground') continue;
    for (const c of caseCollisions(b.files.map((f) => f.path))) errors.push(`${meta.id}: 示例 ${b.id} 的文件名只有大小写不同（${c}）：在不区分大小写的文件系统上会互相冲突`);
  }

  for (const issue of rawHtmlIn(meta.id)) problems.push(issue);

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
