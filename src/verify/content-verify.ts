/**
 * 课程内容验证（在真实浏览器中运行，与学习者使用完全相同的编译器、沙箱与判题流程）：
 * - 示例：诊断必须与 expect 声明完全一致（文件 + 行 + 诊断码），运行结果必须符合 run 声明；
 * - 练习：起始代码必须判为未通过；参考解与替代解必须通过；错误解必须在声明的那一步失败。
 */
import { getCompiler } from '../compiler/client.ts';
import type { Exercise, Lesson, PlaygroundBlock, VerifyData } from '../content/types.ts';
import { judge, mutantInputs, pageInput, runEntries, type JudgeResult } from '../judge/judge.ts';
import { startRun } from '../runner/runner.ts';

export interface CheckResult {
  lessonId: string;
  target: string;
  ok: boolean;
  detail: string;
}

const lessonLoaders = import.meta.glob<{ default: Lesson }>('../generated/lessons/*.json');

export async function listLessonIds(): Promise<string[]> {
  return Object.keys(lessonLoaders)
    .map((k) => k.replace(/^.*\/(.+)\.json$/, '$1'))
    .sort();
}

async function loadLessonForVerify(id: string): Promise<Lesson> {
  const load = lessonLoaders[`../generated/lessons/${id}.json`];
  if (!load) throw new Error(`没有课时 ${id}`);
  return (await load()).default;
}

async function loadVerifyData(): Promise<VerifyData> {
  return (await import('../generated/verify.json')).default as VerifyData;
}

function describeDiag(d: { code: number; file?: string; line?: number; message: string }) {
  return `TS${d.code}@${d.file ?? '?'}:${d.line ?? '?'} ${d.message.split('\n')[0]}`;
}

async function verifyPlayground(lesson: Lesson, pg: PlaygroundBlock): Promise<CheckResult[]> {
  const out: CheckResult[] = [];
  const files = Object.fromEntries(pg.files.map((f) => [f.path, f.content]));
  const projectId = `verify::${lesson.id}::${pg.id}`;
  const spec = { mode: pg.mode, overrides: pg.compiler.overrides, files };
  const { diagnostics } = await getCompiler().call('diagnostics', { projectId, spec });
  const errors = diagnostics.filter((d) => d.category === 'error');
  const unexpected = errors.filter((d) => !pg.expectDiagnostics.some((e) => e.code === d.code && e.file === d.file && e.line === d.line));
  const missing = pg.expectDiagnostics.filter((e) => !errors.some((d) => e.code === d.code && e.file === d.file && e.line === d.line));
  out.push({
    lessonId: lesson.id,
    target: `playground:${pg.id}:types`,
    ok: unexpected.length === 0 && missing.length === 0,
    detail:
      unexpected.length || missing.length
        ? `多余：${unexpected.map(describeDiag).join('；') || '无'}；缺少：${missing.map((m) => `TS${m.code}@${m.file}:${m.line}`).join('；') || '无'}`
        : `诊断符合预期（${errors.length} 个故意的错误）`,
  });

  if (pg.expectRun === 'skip') return out;
  const { bundle } = await getCompiler().call('buildRun', { projectId, spec, entries: runEntries(pg.mode, files, pg.entry), loopGuard: pg.mode !== 'ts' });
  const container = document.createElement('div');
  container.style.cssText = 'width:600px;height:300px';
  document.body.append(container);
  const logs: string[] = [];
  const status = await new Promise<{ status: string; error?: string }>((resolve) => {
    let settled = false;
    const handle = startRun(
      { mode: pg.mode, bundle, timeoutMs: pg.timeoutMs, fixtures: pg.fixtures, page: pg.mode === 'ts' ? undefined : pageInput(files), container },
      {
        onLogs: (e) => logs.push(...e.map((l) => `[${l.level}] ${l.text}`)),
        onStatus: (u) => {
          if (settled || u.status === 'running') return;
          settled = true;
          // DOM/React：入口执行完后再等一会儿，收集异步输出
          setTimeout(() => {
            if (pg.mode !== 'ts') handle.stop();
            resolve({ status: u.status, error: u.error ? `${u.error.name}: ${u.error.message}` : undefined });
          }, pg.mode === 'ts' ? 0 : 300);
        },
      },
    );
  });
  container.remove();
  const expected = pg.expectRun === 'ok' ? 'done' : 'error';
  const errorLogged = logs.some((l) => l.startsWith('[error]'));
  const ok = pg.expectRun === 'ok' ? status.status === 'done' && !errorLogged : status.status === 'error' || errorLogged;
  out.push({
    lessonId: lesson.id,
    target: `playground:${pg.id}:run`,
    ok,
    detail: `期望 ${expected}，实际 ${status.status}${status.error ? `（${status.error}）` : ''}；输出：${logs.slice(0, 8).join(' | ').slice(0, 600)}`,
  });
  return out;
}

function describeFailure(t: JudgeResult['tests']['results'][number]): string {
  const first = t.error?.message.split('\n')[0]?.slice(0, 160);
  return first === undefined ? t.name : `${t.name} ⟶ ${first}`;
}

function summarize(r: JudgeResult): string {
  const parts = [
    `types=${r.types.ok ? 'ok' : `fail(${[...r.types.student, ...r.types.tests].map(describeDiag).join('；').slice(0, 300)})`}`,
    `rules=${r.rules.ok ? 'ok' : `fail(${r.rules.violations.map((v) => `${v.rule}@${v.line}`).join(',')})`}`,
    `tests=${r.tests.required ? (r.tests.ok ? 'ok' : `fail(${r.tests.error ? `${r.tests.error.name}: ${r.tests.error.message}` : r.tests.results.filter((t) => t.status !== 'pass').map(describeFailure).join(',')})`) : 'n/a'}`,
  ];
  if (r.mutants) parts.push(`mutants=${r.mutants.map((m) => `${m.name}:${m.caught ? `caught(${m.by})` : 'missed'}`).join(',')}`);
  if (r.internalError) parts.push(`internal=${r.internalError}`);
  return parts.join(' ');
}

async function verifyExercise(lesson: Lesson, ex: Exercise, variants: VerifyData['exercises'][number]['variants']): Promise<CheckResult[]> {
  const out: CheckResult[] = [];
  const support = Object.fromEntries(ex.support.map((f) => [f.path, f.content]));
  const tests = Object.fromEntries(ex.tests.map((f) => [f.path, f.content]));
  for (const v of variants) {
    const r = await judge(
      {
        projectId: `verify::${lesson.id}::${ex.id}::${v.name}`,
        mode: ex.mode,
        overrides: ex.compiler.overrides,
        entry: ex.entry,
        runTests: ex.runTests,
        forbid: ex.forbid,
        expectDiagnostics: ex.expectDiagnostics,
        timeoutMs: ex.timeoutMs,
        perTestTimeoutMs: ex.perTestTimeoutMs,
        fixtures: ex.fixtures,
        grading: ex.grading,
      },
      { student: v.files, support, tests, mutants: mutantInputs(ex.mutants) },
    );
    let ok: boolean;
    let why: string;
    if (r.internalError) {
      ok = false;
      why = '平台内部错误';
    } else if (v.kind === 'solution' || v.kind === 'alt') {
      ok = r.passed;
      why = ok ? '通过' : '应当通过但未通过';
    } else if (v.kind === 'starter') {
      ok = !r.passed;
      why = ok ? '起始代码未通过（符合预期）' : '起始代码竟然通过了验收';
    } else {
      // fails=mutants：这组测试在正确的实现上通过，但漏掉的错误实现必须正好是声明的那几个
      const missed = (r.mutants ?? []).filter((m) => !m.caught).map((m) => m.name).toSorted();
      const missesMatch = JSON.stringify(missed) === JSON.stringify([...(v.misses ?? [])].toSorted());
      const stageFailed =
        v.fails === 'types' ? !r.types.ok : v.fails === 'rules' ? !r.rules.ok : v.fails === 'mutants' ? r.tests.ok && r.mutants !== undefined && missesMatch : !r.tests.ok;
      // 声明“测试中失败”的错误解必须能通过类型与规则检查：否则它是因为一个无关的错误被拒绝的，测的不是它想测的东西
      const incidental = (v.fails === 'tests' || v.fails === 'mutants') && (!r.types.ok || !r.rules.ok);
      ok = !r.passed && stageFailed && !incidental;
      why = ok
        ? `被拒绝（${v.fails}）`
        : r.passed
          ? '错误解竟然通过了'
          : incidental
            ? '错误解声明在测试中失败，但类型或规则检查也没有通过（它应该只因为测试而失败）'
            : v.fails === 'mutants'
              ? `漏掉的错误实现与声明的不一致：声明 ${(v.misses ?? []).join(',')}，实际 ${missed.join(',') || '（全部发现了）'}`
              : `被拒绝，但不是在声明的 ${v.fails} 阶段`;
    }
    out.push({ lessonId: lesson.id, target: `exercise:${ex.id}:${v.kind}:${v.name}`, ok, detail: `${why}；${summarize(r)}` });
  }
  return out;
}

/** 验证一个课时，返回每一项检查的结果 */
export async function verifyLesson(lessonId: string): Promise<CheckResult[]> {
  const lesson = await loadLessonForVerify(lessonId);
  const data = await loadVerifyData();
  const results: CheckResult[] = [];
  for (const block of lesson.blocks) {
    if (block.kind === 'playground') results.push(...(await verifyPlayground(lesson, block)));
  }
  for (const ex of Object.values(lesson.exercises)) {
    const v = data.exercises.find((e) => e.lessonId === lessonId && e.exerciseId === ex.id);
    if (!v) {
      results.push({ lessonId, target: `exercise:${ex.id}`, ok: false, detail: '缺少验证数据' });
      continue;
    }
    results.push(...(await verifyExercise(lesson, ex, v.variants)));
  }
  return results;
}
