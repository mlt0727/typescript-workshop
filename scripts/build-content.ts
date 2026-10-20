/**
 * 构建课程内容：content/ → src/generated/
 *   catalog.json            完整课程图谱（含规划中的课时）与计数
 *   lessons/<id>.json       每个草稿/已发布课时的完整内容（应用按需加载）
 *   verify.json             每个练习的全部变体（起始/参考解/替代解/错误解），供浏览器内课程验证使用
 * 同时重新生成 docs/CURRICULUM.md。
 *
 * 发生任何 schema 或结构错误都会以非零状态退出。
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { ContainerDirective, LeafDirective } from 'mdast-util-directive';
import type { Code, RootContent } from 'mdast';
import YAML from 'yaml';
import { OVERRIDABLE_OPTIONS, type CompilerOverrides, type OverridableOption, type RunMode } from '../src/compiler/config.ts';
import { ALL_RULES, type RuleId } from '../src/compiler/core/types.ts';
import type {
  Catalog,
  CatalogLesson,
  CompilerSettings,
  Exercise,
  ExerciseVariant,
  ExpectedDiagnostic,
  Hint,
  Lesson,
  LessonBlock,
  QuizQuestion,
  SourceFile,
  VerifyData,
  VerifyExercise,
} from '../src/content/types.ts';
import { initHighlighter, parseMarkdown, parseMeta, renderMarkdown, renderNodes } from './content/markdown.ts';
import {
  curriculumSchema,
  exerciseFrontmatterSchema,
  fixturesSchema,
  lessonFrontmatterSchema,
  quizSchema,
} from './content/schema.ts';

const root = path.resolve(import.meta.dirname, '..');
const contentDir = path.join(root, 'content');
const outDir = path.join(root, 'src', 'generated');

const errors: string[] = [];
const fail = (where: string, msg: string) => errors.push(`${where}: ${msg}`);

function firstLine(err: unknown): string {
  return (err instanceof Error ? err.message : String(err)).split(/\r?\n/)[0] ?? '';
}

function readText(file: string): string {
  return fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
}

function splitFrontmatter(source: string, where: string): { data: unknown; body: string } {
  const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(source);
  if (!m) {
    fail(where, '缺少 YAML frontmatter（文件开头的 --- 块）');
    return { data: {}, body: source };
  }
  try {
    return { data: YAML.parse(m[1]!), body: m[2]! };
  } catch (err) {
    fail(where, `frontmatter 不是合法的 YAML：${firstLine(err)}`);
    return { data: {}, body: m[2]! };
  }
}

function hashFiles(files: SourceFile[]): string {
  const canonical = JSON.stringify(files.map((f) => [f.path, f.content]).sort(([a], [b]) => String(a).localeCompare(String(b))));
  return crypto.createHash('sha256').update(canonical).digest('hex').slice(0, 16);
}

const FILE_NAME_RE = /^[A-Za-z0-9_\-./]+\.(ts|tsx|html|css|json)$/;

function codeToFile(node: Code, where: string): SourceFile | undefined {
  const meta = parseMeta(node.meta);
  const file = meta.file;
  if (typeof file !== 'string') {
    fail(where, `代码块缺少 file=…（语言 ${node.lang ?? '?'}）`);
    return undefined;
  }
  if (!FILE_NAME_RE.test(file) || file.includes('..') || file.startsWith('/')) {
    fail(where, `文件名不合法：${file}（只允许 ASCII 相对路径，扩展名 ts/tsx/html/css/json）`);
    return undefined;
  }
  return {
    path: file,
    content: node.value.endsWith('\n') ? node.value : `${node.value}\n`,
    ...(meta.hidden ? { hidden: true } : {}),
    ...(meta.readonly ? { readonly: true } : {}),
  };
}

function filesIn(nodes: RootContent[], where: string): SourceFile[] {
  const files: SourceFile[] = [];
  for (const n of nodes) {
    if (n.type === 'code') {
      const f = codeToFile(n, where);
      if (f) {
        if (files.some((x) => x.path === f.path)) fail(where, `重复的文件 ${f.path}`);
        files.push(f);
      }
    }
  }
  return files;
}

function parseExpect(value: string | undefined, where: string): ExpectedDiagnostic[] {
  if (!value) return [];
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .flatMap((s) => {
      const m = /^(\d+)@([\w\-./]+):(\d+)$/.exec(s);
      if (!m) {
        fail(where, `expect 格式应为 "诊断码@文件:行"，例如 2322@main.ts:3；实际为 ${s}`);
        return [];
      }
      return [{ code: Number(m[1]), file: m[2]!, line: Number(m[3]) }];
    });
}

function loadFixtures(lessonDir: string, name: string | undefined, where: string) {
  if (!name) return undefined;
  const file = path.join(lessonDir, 'fixtures', `${name}.json`);
  if (!fs.existsSync(file)) {
    fail(where, `找不到 fixtures/${name}.json`);
    return undefined;
  }
  const parsed = fixturesSchema.safeParse(JSON.parse(readText(file)));
  if (!parsed.success) {
    fail(where, `fixtures/${name}.json 格式错误：${parsed.error.message}`);
    return undefined;
  }
  return parsed.data;
}

const isOverridable = (name: string): name is OverridableOption => (OVERRIDABLE_OPTIONS as readonly string[]).includes(name);

/**
 * playground 可以单独覆盖编译选项（例如对比开启、关闭某个选项时的诊断）：
 * options="exactOptionalPropertyTypes=true, noUncheckedIndexedAccess=false"，并且必须用 note="…" 说明原因。
 */
function playgroundCompiler(base: CompilerSettings | undefined, options: string | null | undefined, note: string | null | undefined, where: string): CompilerSettings {
  if (!options) return base ?? {};
  const overrides: CompilerOverrides = { ...base?.overrides };
  for (const part of options.split(',').map((s) => s.trim()).filter(Boolean)) {
    const m = /^(\w+)=(true|false)$/.exec(part);
    const name = m?.[1];
    if (m === null || name === undefined || !isOverridable(name)) {
      fail(where, `options 的格式应为“选项=true|false”，选项只能是 ${OVERRIDABLE_OPTIONS.join(', ')}；实际为 ${part}`);
      continue;
    }
    overrides[name] = m[2] === 'true';
  }
  if (!note) fail(where, '覆盖编译选项时必须用 note="…" 说明原因（会显示给学习者）');
  return { overrides, note: note ?? undefined };
}

const isDirective = (n: RootContent): n is ContainerDirective | LeafDirective =>
  n.type === 'containerDirective' || n.type === 'leafDirective';

function defaultEntry(files: SourceFile[], mode: RunMode): string {
  const names = files.map((f) => f.path);
  for (const candidate of mode === 'react' ? ['main.tsx', 'App.tsx'] : ['main.ts', 'index.html']) {
    if (names.includes(candidate)) return candidate;
  }
  return files.find((f) => /\.tsx?$/.test(f.path))?.path ?? names[0] ?? 'main.ts';
}

function buildExercise(lessonId: string, lessonDir: string, exId: string, lessonMode: RunMode): { exercise: Exercise; verify: VerifyExercise } | undefined {
  const file = path.join(lessonDir, 'exercises', `${exId}.md`);
  const where = `${lessonId}/exercises/${exId}.md`;
  if (!fs.existsSync(file)) {
    fail(where, '文件不存在');
    return undefined;
  }
  const { data, body } = splitFrontmatter(readText(file), where);
  const fm = exerciseFrontmatterSchema.safeParse(data);
  if (!fm.success) {
    fail(where, `frontmatter 错误：${fm.error.message}`);
    return undefined;
  }
  const meta = fm.data;
  const mode = (meta.mode ?? lessonMode) as RunMode;
  const tree = parseMarkdown(body);
  const promptNodes: RootContent[] = [];
  let starter: SourceFile[] = [];
  let solution: SourceFile[] = [];
  let tests: SourceFile[] = [];
  let support: SourceFile[] = [];
  const hints: Hint[] = [];
  let explanationHtml = '';
  const variants: ExerciseVariant[] = [];

  for (const node of tree.children) {
    if (node.type !== 'containerDirective') {
      promptNodes.push(node);
      continue;
    }
    const attrs = node.attributes ?? {};
    switch (node.name) {
      case 'files': {
        const files = filesIn(node.children, where);
        const role = attrs.role;
        if (role === 'starter') starter = files;
        else if (role === 'solution') solution = files;
        else if (role === 'tests') tests = files;
        else if (role === 'support') support = files;
        else fail(where, `未知的 files role：${role ?? '(空)'}`);
        break;
      }
      case 'hint': {
        const level = Number(attrs.level);
        if (level !== 1 && level !== 2) fail(where, 'hint 的 level 只能是 1（方向提示）或 2（更具体提示）');
        else hints.push({ level, html: renderNodes(node.children) });
        break;
      }
      case 'explanation':
        explanationHtml = renderNodes(node.children);
        break;
      case 'variant': {
        const kind = attrs.kind;
        const name = attrs.name;
        if ((kind !== 'alt' && kind !== 'wrong') || !name) {
          fail(where, 'variant 需要 kind=alt|wrong 与 name');
          break;
        }
        const files = filesIn(node.children, where);
        const fails = attrs.fails;
        if (kind === 'wrong' && fails !== 'types' && fails !== 'tests' && fails !== 'rules') {
          fail(where, `wrong 变体 ${name} 需要 fails=types|tests|rules`);
        }
        variants.push({
          name,
          kind,
          files: Object.fromEntries(files.map((f) => [f.path, f.content])),
          fails: kind === 'wrong' ? (fails as ExerciseVariant['fails']) : undefined,
          reason: attrs.reason ?? undefined,
        });
        break;
      }
      default:
        fail(where, `未知指令 :::${node.name}`);
    }
  }

  if (starter.length === 0) fail(where, '缺少 :::files{role=starter}');
  if (solution.length === 0) fail(where, '缺少 :::files{role=solution}');
  if (tests.length === 0) fail(where, '缺少 :::files{role=tests}（至少一个 *.test.ts 或 *.test-d.ts）');
  const editable = new Set(starter.map((f) => f.path));
  for (const f of solution) if (!editable.has(f.path)) fail(where, `参考解中的 ${f.path} 不在起始文件中`);
  for (const v of variants) {
    for (const p of Object.keys(v.files)) if (!editable.has(p)) fail(where, `变体 ${v.name} 修改了非学生文件 ${p}`);
  }
  const hasRuntimeTests = tests.some((t) => /\.test\.tsx?$/.test(t.path));
  const runTests = meta.tests ?? hasRuntimeTests;
  if (runTests && !hasRuntimeTests) fail(where, 'tests: true 但没有 *.test.ts(x) 文件');

  const forbidDefault: RuleId[] = [...ALL_RULES];
  const forbid = ((meta.forbid as RuleId[] | undefined) ?? forbidDefault).filter((r) => !(meta.allow ?? []).includes(r));

  const solutionMap = Object.fromEntries(solution.map((f) => [f.path, f.content]));
  const starterMap = Object.fromEntries(starter.map((f) => [f.path, f.content]));
  const allVariants: ExerciseVariant[] = [
    { name: 'starter', kind: 'starter', files: starterMap },
    { name: 'solution', kind: 'solution', files: { ...starterMap, ...solutionMap } },
    ...variants.map((v) => ({ ...v, files: { ...starterMap, ...solutionMap, ...v.files } })),
  ];

  const exercise: Exercise = {
    id: exId,
    kind: meta.kind,
    title: meta.title,
    promptHtml: renderNodes(promptNodes),
    mode,
    entry: meta.entry ?? defaultEntry([...starter, ...support], mode),
    starter,
    solution: starter.map((f) => ({ ...f, content: solutionMap[f.path] ?? f.content })),
    support,
    tests,
    runTests,
    forbid,
    expectDiagnostics: parseExpect(meta.expect, where),
    hints: hints.sort((a, b) => a.level - b.level),
    explanationHtml,
    compiler: meta.compiler ?? {},
    fixtures: loadFixtures(lessonDir, meta.fixtures, where),
    timeoutMs: meta.timeoutMs ?? 8000,
    perTestTimeoutMs: meta.perTestTimeoutMs ?? 3000,
    baseHash: hashFiles(starter),
  };
  return { exercise, verify: { lessonId, exerciseId: exId, variants: allVariants, wrongNotApplicable: meta.wrongNotApplicable } };
}

function buildQuiz(lessonDir: string, where: string): QuizQuestion[] {
  const file = path.join(lessonDir, 'quiz.yaml');
  if (!fs.existsSync(file)) return [];
  let raw: unknown;
  try {
    raw = YAML.parse(readText(file));
  } catch (err) {
    fail(`${where}/quiz.yaml`, `不是合法的 YAML（含有冒号的文字需要加引号）：${firstLine(err)}`);
    return [];
  }
  const parsed = quizSchema.safeParse(raw);
  if (!parsed.success) {
    fail(`${where}/quiz.yaml`, parsed.error.message);
    return [];
  }
  return parsed.data.map((q) => {
    const correct = q.options.filter((o) => o.correct).length;
    if (correct === 0) fail(`${where}/quiz.yaml`, `${q.id} 没有正确选项`);
    if (q.type === 'single' && correct !== 1) fail(`${where}/quiz.yaml`, `${q.id} 是单选题，但有 ${correct} 个正确选项`);
    return {
      id: q.id,
      type: q.type,
      promptHtml: renderMarkdown(q.prompt),
      options: q.options.map((o, i) => ({ id: String.fromCharCode(97 + i), html: renderMarkdown(o.text), correct: o.correct, explainHtml: renderMarkdown(o.explain) })),
      explainHtml: q.explain ? renderMarkdown(q.explain) : undefined,
    };
  });
}

async function main() {
  await initHighlighter();
  const curriculum = curriculumSchema.parse(YAML.parse(readText(path.join(contentDir, 'curriculum.yaml'))));

  const allIds = new Map<string, { stage: string; title: string }>();
  for (const s of curriculum.stages) {
    for (const l of s.lessons) {
      if (allIds.has(l.id)) fail('curriculum.yaml', `重复的课时 id：${l.id}`);
      allIds.set(l.id, { stage: s.id, title: l.title });
    }
  }
  for (const s of curriculum.stages) {
    for (const l of s.lessons) {
      for (const p of l.prerequisites) if (!allIds.has(p)) fail('curriculum.yaml', `${l.id} 的先修 ${p} 不存在`);
    }
  }
  // 先修关系不能有环
  const prereqOf = new Map(curriculum.stages.flatMap((s) => s.lessons.map((l) => [l.id, l.prerequisites] as const)));
  const state = new Map<string, 1 | 2>();
  const dfs = (id: string, chain: string[]) => {
    if (state.get(id) === 2) return;
    if (state.get(id) === 1) {
      fail('curriculum.yaml', `先修关系存在环：${[...chain, id].join(' → ')}`);
      return;
    }
    state.set(id, 1);
    for (const p of prereqOf.get(id) ?? []) dfs(p, [...chain, id]);
    state.set(id, 2);
  };
  for (const id of prereqOf.keys()) dfs(id, []);

  const lessonsDir = path.join(contentDir, 'lessons');
  const folders = fs.existsSync(lessonsDir) ? fs.readdirSync(lessonsDir).filter((d) => fs.statSync(path.join(lessonsDir, d)).isDirectory()) : [];
  for (const f of folders) if (!allIds.has(f)) fail(`lessons/${f}`, '这个课时文件夹不在 curriculum.yaml 中');

  const ordered = curriculum.stages.flatMap((s) => s.lessons.map((l) => ({ ...l, stage: s.id, stageTitle: s.title })));
  const available = ordered.filter((l) => l.status !== 'planned');

  const lessons: Lesson[] = [];
  const verify: VerifyExercise[] = [];
  const catalogLessons = new Map<string, CatalogLesson>();

  for (const entry of ordered) {
    const base: CatalogLesson = { id: entry.id, title: entry.title, stage: entry.stage, status: entry.status, prerequisites: entry.prerequisites };
    catalogLessons.set(entry.id, base);
    if (entry.status === 'planned') continue;

    const dir = path.join(lessonsDir, entry.id);
    const where = `lessons/${entry.id}`;
    const lessonFile = path.join(dir, 'lesson.md');
    if (!fs.existsSync(lessonFile)) {
      fail(where, `状态为 ${entry.status}，但缺少 lesson.md`);
      continue;
    }
    const { data, body } = splitFrontmatter(readText(lessonFile), `${where}/lesson.md`);
    const fmResult = lessonFrontmatterSchema.safeParse(data);
    if (!fmResult.success) {
      fail(`${where}/lesson.md`, `frontmatter 错误：${fmResult.error.message}`);
      continue;
    }
    const fm = fmResult.data;
    const mode = fm.mode as RunMode;
    const tree = parseMarkdown(body);
    const blocks: LessonBlock[] = [];
    const exercises: Record<string, Exercise> = {};
    let prose: RootContent[] = [];
    let proseIndex = 0;
    let quizPlaced = false;
    const flush = () => {
      if (prose.length) blocks.push({ kind: 'prose', id: `p${++proseIndex}`, html: renderNodes(prose) });
      prose = [];
    };

    for (const node of tree.children) {
      if (!isDirective(node)) {
        prose.push(node);
        continue;
      }
      flush();
      const attrs = node.attributes ?? {};
      const id = attrs.id;
      if (node.name === 'playground' && node.type === 'containerDirective') {
        if (!id) {
          fail(where, ':::playground 需要 {#id}');
          continue;
        }
        const pgWhere = `${where}#${id}`;
        const files = filesIn(node.children, pgWhere);
        const rest = node.children.filter((c) => c.type !== 'code');
        const pgMode = (attrs.mode ?? mode) as RunMode;
        if (!['ts', 'dom', 'react'].includes(pgMode)) fail(pgWhere, `未知 mode ${pgMode}`);
        if (files.length === 0) fail(pgWhere, 'playground 至少需要一个文件');
        const run = attrs.run ?? 'ok';
        if (run !== 'ok' && run !== 'error' && run !== 'skip') fail(pgWhere, 'run 只能是 ok / error / skip');
        blocks.push({
          kind: 'playground',
          id,
          mode: pgMode,
          entry: attrs.entry ?? defaultEntry(files, pgMode),
          files,
          observeHtml: rest.length ? renderNodes(rest) : undefined,
          expectDiagnostics: parseExpect(attrs.expect ?? undefined, pgWhere),
          expectRun: run as 'ok' | 'error' | 'skip',
          compiler: playgroundCompiler(fm.compiler, attrs.options, attrs.note, pgWhere),
          fixtures: loadFixtures(dir, attrs.fixtures ?? undefined, pgWhere),
          timeoutMs: Number(attrs.timeout ?? 5000),
          baseHash: hashFiles(files),
        });
      } else if (node.name === 'exercise' && node.type === 'leafDirective') {
        if (!id) {
          fail(where, '::exercise 需要 {#id}');
          continue;
        }
        if (exercises[id]) fail(where, `练习 ${id} 被引用了两次`);
        const built = buildExercise(entry.id, dir, id, mode);
        if (built) {
          exercises[id] = built.exercise;
          verify.push(built.verify);
          blocks.push({ kind: 'exercise', id });
        }
      } else if (node.name === 'quiz' && node.type === 'leafDirective') {
        quizPlaced = true;
        blocks.push({ kind: 'quiz', id: 'quiz' });
      } else {
        fail(where, `未知指令 ${node.type === 'leafDirective' ? '::' : ':::'}${node.name}`);
      }
    }
    flush();

    const blockIds = blocks.map((b) => `${b.kind}:${b.id}`);
    if (new Set(blockIds).size !== blockIds.length) fail(where, '存在重复的块 id');
    const quiz = buildQuiz(dir, where);
    if (quiz.length > 0 && !quizPlaced) fail(where, '有 quiz.yaml 但正文中没有 ::quiz');
    if (quizPlaced && quiz.length === 0) fail(where, '正文中有 ::quiz 但缺少 quiz.yaml');

    const idx = available.findIndex((l) => l.id === entry.id);
    const prev = available[idx - 1];
    const next = available[idx + 1];
    const lesson: Lesson = {
      id: entry.id,
      version: fm.version,
      title: entry.title,
      stage: entry.stage,
      stageTitle: entry.stageTitle,
      status: entry.status,
      review: fm.review,
      prerequisites: entry.prerequisites,
      objectives: fm.objectives,
      problem: fm.problem,
      estimatedMinutes: fm.estimatedMinutes,
      mode,
      references: fm.references,
      blocks,
      exercises,
      quiz,
      representative: fm.representative,
      prev: prev ? { id: prev.id, title: prev.title } : undefined,
      next: next ? { id: next.id, title: next.title } : undefined,
    };
    lessons.push(lesson);
    Object.assign(base, {
      version: fm.version,
      objectives: fm.objectives,
      estimatedMinutes: fm.estimatedMinutes,
      review: fm.review,
      mode,
      exerciseIds: Object.keys(exercises),
      quizCount: quiz.length,
    });
  }

  if (errors.length > 0) {
    console.error(`课程内容有 ${errors.length} 个错误：`);
    for (const e of errors) console.error(`  ✗ ${e}`);
    process.exit(1);
  }

  const counts = { published: 0, draft: 0, planned: 0, total: 0 };
  for (const l of ordered) {
    counts[l.status]++;
    counts.total++;
  }
  const builtAt = new Date().toISOString();
  const catalog: Catalog = {
    version: curriculum.version,
    builtAt,
    stages: curriculum.stages.map((s) => ({ id: s.id, title: s.title, summary: s.summary, lessons: s.lessons.map((l) => catalogLessons.get(l.id)!) })),
    counts,
  };

  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(path.join(outDir, 'lessons'), { recursive: true });
  fs.writeFileSync(path.join(outDir, 'catalog.json'), JSON.stringify(catalog));
  for (const l of lessons) fs.writeFileSync(path.join(outDir, 'lessons', `${l.id}.json`), JSON.stringify(l));
  const verifyData: VerifyData = { builtAt, exercises: verify };
  fs.writeFileSync(path.join(outDir, 'verify.json'), JSON.stringify(verifyData));
  writeCurriculumDoc(catalog);

  console.log(`课程内容：已发布 ${counts.published} · 草稿 ${counts.draft} · 规划 ${counts.planned}（共 ${counts.total}）；练习 ${verify.length} 个`);
}

const STATUS_LABEL = { published: '✅ 已发布', draft: '📝 草稿', planned: '⬜ 规划中' } as const;

function writeCurriculumDoc(catalog: Catalog) {
  const lines = [
    '# 课程图谱',
    '',
    '> 本文件由 `npm run content:build` 根据 `content/curriculum.yaml` 自动生成，请勿手工编辑。',
    '> 状态：✅ 已发布（通过发布验收）· 📝 草稿（有内容但未通过全部验收，不计入已发布）· ⬜ 规划中（只有标题）。',
    '',
    `**已发布 ${catalog.counts.published} / 规划总数 ${catalog.counts.total}**（草稿 ${catalog.counts.draft}，规划中 ${catalog.counts.planned}）`,
    '',
  ];
  for (const s of catalog.stages) {
    const pub = s.lessons.filter((l) => l.status === 'published').length;
    lines.push(`## ${s.id}. ${s.title}（已发布 ${pub} / ${s.lessons.length}）`, '', s.summary, '', '| 课时 | 状态 | 先修 |', '|---|---|---|');
    for (const l of s.lessons) {
      lines.push(`| \`${l.id}\` ${l.title} | ${STATUS_LABEL[l.status]} | ${l.prerequisites.map((p) => `\`${p}\``).join('、') || '—'} |`);
    }
    lines.push('');
  }
  fs.writeFileSync(path.join(root, 'docs', 'CURRICULUM.md'), lines.join('\n'));
}

await main();
