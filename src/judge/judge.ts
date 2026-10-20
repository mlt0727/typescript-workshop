import { getCompiler } from '../compiler/client.ts';
import type { CompilerOverrides, RunMode } from '../compiler/config.ts';
import type { DiagnosticInfo, RuleId, RuleViolation, RunBundle } from '../compiler/core/types.ts';
import { runTests, type PageInput } from '../runner/runner.ts';
import type { FetchFixture, LogEntry, SerializedError, TestResult } from '../shared/sandbox-protocol.ts';
import { hashFiles } from './hash.ts';

export interface ExpectedDiagnostic {
  code: number;
  file: string;
  line: number;
}

export interface JudgeSpec {
  projectId: string;
  mode: RunMode;
  overrides?: CompilerOverrides;
  /** 学生入口（DOM 模式可由 index.html 的 module script 决定） */
  entry: string;
  /** 是否需要行为测试（类型检查与规则检查总是执行） */
  runTests: boolean;
  forbid: RuleId[];
  /** 有些题目要求代码“恰好产生这些错误”（例如演示 TS 能抓到的错误）；通常为空 */
  expectDiagnostics?: ExpectedDiagnostic[];
  timeoutMs: number;
  perTestTimeoutMs: number;
  fixtures?: FetchFixture[];
  /** implementation（默认）：学生写实现；tests：学生写测试，还要检查它能否发现 mutants 中的错误实现 */
  grading?: 'implementation' | 'tests';
}

export interface MutantInput {
  name: string;
  hint: string;
  /** 替换 support 中同名文件的内容 */
  files: Record<string, string>;
}

export interface MutantResult {
  name: string;
  hint: string;
  caught: boolean;
  /** 发现它的方式：类型测试报错，或者行为测试失败 */
  by?: 'types' | 'tests';
  detail?: string;
}

export interface JudgeFiles {
  /** 学生可编辑的文件（提交时冻结的快照） */
  student: Record<string, string>;
  /** 平台提供、学生不可编辑的辅助文件 */
  support: Record<string, string>;
  /** 测试文件：*.test.ts(x) 会运行，*.test-d.ts 只做类型检查 */
  tests: Record<string, string>;
  /** grading 为 tests 时：故意写错的实现 */
  mutants?: MutantInput[];
}

export interface JudgeResult {
  snapshotHash: string;
  at: number;
  passed: boolean;
  types: {
    ok: boolean;
    /** 学生文件中的错误 */
    student: DiagnosticInfo[];
    /** 测试文件中的错误（通常意味着类型不满足题目要求） */
    tests: DiagnosticInfo[];
    /** 题目要求出现但没有出现的诊断 */
    missingExpected: ExpectedDiagnostic[];
  };
  rules: { ok: boolean; violations: RuleViolation[] };
  tests: {
    required: boolean;
    ok: boolean;
    results: TestResult[];
    error?: SerializedError;
    logs: LogEntry[];
  };
  /** grading 为 tests 时：学生的测试是否发现了每一个错误的实现（只有测试在正确的实现上全部通过时才检查） */
  mutants?: MutantResult[];
  /** 编译器或沙箱本身出错（不是学生代码的问题） */
  internalError?: string;
}

export function isRuntimeTest(path: string) {
  return /\.test\.tsx?$/.test(path);
}

export function isTypeTest(path: string) {
  return /\.test-d\.tsx?$/.test(path);
}

/** DOM 模式：从 index.html 中找 <script type="module" src="./main.ts">。 */
export function entryFromHtml(html: string | undefined): string | undefined {
  if (!html) return undefined;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  for (const s of doc.querySelectorAll('script[type="module"][src]')) {
    const src = s.getAttribute('src') ?? '';
    if (!/^[a-z]+:/i.test(src)) return src.replace(/^\.\//, '').replace(/^\//, '');
  }
  return undefined;
}

/**
 * 要运行的入口模块。DOM 模式以 index.html 中的 module script 为准；
 * 页面没有脚本时，退回到存在的 .ts 入口文件；两者都没有（纯 HTML/CSS 页面）时不运行任何代码。
 */
export function runEntries(mode: RunMode, files: Record<string, string>, fallback: string): string[] {
  if (mode !== 'dom' || files['index.html'] === undefined) return [fallback];
  const fromHtml = entryFromHtml(files['index.html']);
  if (fromHtml) return [fromHtml];
  return /\.tsx?$/.test(fallback) && files[fallback] !== undefined ? [fallback] : [];
}

export function pageInput(files: Record<string, string>): PageInput {
  const css: Record<string, string> = {};
  for (const [p, c] of Object.entries(files)) if (p.endsWith('.css')) css[p] = c;
  return { html: files['index.html'], css };
}

function sameDiag(d: DiagnosticInfo, e: ExpectedDiagnostic) {
  return d.code === e.code && d.file === e.file && d.line === e.line;
}

/** 练习中的 mutant（SourceFile 数组）转换成判题需要的形式 */
export function mutantInputs(mutants: readonly { name: string; hint: string; files: readonly { path: string; content: string }[] }[]): MutantInput[] {
  return mutants.map((m) => ({ name: m.name, hint: m.hint, files: Object.fromEntries(m.files.map((f) => [f.path, f.content])) }));
}

/** 学生写测试时，学生文件中的测试文件也参与运行 */
function testFilesOf(spec: JudgeSpec, files: JudgeFiles): string[] {
  const own = spec.grading === 'tests' ? Object.keys(files.student).filter((f) => isRuntimeTest(f) || isTypeTest(f)) : [];
  return [...own, ...Object.keys(files.tests)];
}

async function compileFor(spec: JudgeSpec, projectId: string, all: Record<string, string>, studentFiles: string[], testFiles: string[]) {
  return getCompiler().call('judge', {
    projectId,
    spec: { mode: spec.mode, overrides: spec.overrides, files: all, withTests: true },
    studentFiles,
    testFiles,
    forbid: spec.forbid,
    // React 模式的测试直接渲染组件，不运行入口；DOM 模式每个测试前运行入口
    runEntries: spec.mode === 'dom' ? runEntries('dom', all, spec.entry) : [],
    loopGuard: spec.mode !== 'ts',
  });
}

function runTestsFor(spec: JudgeSpec, bundle: RunBundle, runtimeTests: string[], all: Record<string, string>) {
  return runTests({
    mode: spec.mode,
    bundle,
    testEntries: runtimeTests.map((t) => `file:${t}`),
    page: spec.mode === 'ts' ? undefined : pageInput(all),
    timeoutMs: spec.timeoutMs,
    perTestTimeoutMs: spec.perTestTimeoutMs,
    fixtures: spec.fixtures,
  });
}

/** 用一个错误的实现替换 support，再检查学生的测试：类型测试报错或者行为测试失败，就算发现了它 */
async function checkMutant(spec: JudgeSpec, files: JudgeFiles, mutant: MutantInput, studentFiles: string[], testFiles: string[]): Promise<MutantResult> {
  const all = { ...files.support, ...mutant.files, ...files.student, ...files.tests };
  const compiled = await compileFor(spec, `${spec.projectId}::mutant::${mutant.name}`, all, studentFiles, testFiles);
  const typeError = compiled.diagnostics.find((d) => d.category === 'error' && d.file !== undefined && testFiles.includes(d.file));
  if (typeError) {
    return { name: mutant.name, hint: mutant.hint, caught: true, by: 'types', detail: `${typeError.file}:${typeError.line} ${typeError.message.split('\n')[0]}` };
  }
  const runtimeTests = testFiles.filter(isRuntimeTest);
  if (!spec.runTests || runtimeTests.length === 0) return { name: mutant.name, hint: mutant.hint, caught: false };
  const outcome = await runTestsFor(spec, compiled.bundle, runtimeTests, all);
  if (outcome.error) return { name: mutant.name, hint: mutant.hint, caught: true, by: 'tests', detail: `${outcome.error.name}: ${outcome.error.message}` };
  const failed = outcome.results.find((r) => r.status !== 'pass');
  return failed
    ? { name: mutant.name, hint: mutant.hint, caught: true, by: 'tests', detail: failed.name }
    : { name: mutant.name, hint: mutant.hint, caught: false };
}

export async function judge(spec: JudgeSpec, files: JudgeFiles): Promise<JudgeResult> {
  const snapshot = { ...files.student };
  const snapshotHash = await hashFiles(snapshot);
  const all = { ...files.support, ...snapshot, ...files.tests };
  const studentFiles = Object.keys(snapshot);
  const testFiles = testFilesOf(spec, files);
  const runtimeTests = testFiles.filter(isRuntimeTest);

  const result: JudgeResult = {
    snapshotHash,
    at: Date.now(),
    passed: false,
    types: { ok: false, student: [], tests: [], missingExpected: [] },
    rules: { ok: false, violations: [] },
    tests: { required: spec.runTests, ok: !spec.runTests, results: [], logs: [] },
  };

  let bundle: RunBundle;
  try {
    const compiled = await compileFor(spec, spec.projectId, all, studentFiles, testFiles);
    bundle = compiled.bundle;
    const errors = compiled.diagnostics.filter((d) => d.category === 'error');
    const expected = spec.expectDiagnostics ?? [];
    result.types.student = errors.filter((d) => d.file !== undefined && studentFiles.includes(d.file));
    result.types.tests = errors.filter((d) => d.file === undefined || !studentFiles.includes(d.file));
    result.types.missingExpected = expected.filter((e) => !result.types.student.some((d) => sameDiag(d, e)));
    const unexpected = result.types.student.filter((d) => !expected.some((e) => sameDiag(d, e)));
    result.types.ok = unexpected.length === 0 && result.types.missingExpected.length === 0 && result.types.tests.length === 0;
    result.rules.violations = compiled.rules;
    result.rules.ok = compiled.rules.length === 0;
  } catch (err) {
    result.internalError = `编译器出错：${err instanceof Error ? err.message : String(err)}`;
    return result;
  }

  if (spec.runTests) {
    if (runtimeTests.length === 0) {
      result.internalError = spec.grading === 'tests' ? '题目要求行为测试，但你的文件中没有 *.test.ts' : '题目配置错误：要求行为测试，但没有 *.test.ts 文件';
      return result;
    }
    const outcome = await runTestsFor(spec, bundle, runtimeTests, all);
    result.tests.results = outcome.results;
    result.tests.error = outcome.error;
    result.tests.logs = outcome.logs;
    result.tests.ok =
      outcome.error === undefined &&
      outcome.results.length > 0 &&
      outcome.results.every((r) => r.status === 'pass');
  }

  result.passed = result.types.ok && result.rules.ok && result.tests.ok;

  // 学生写测试：测试先要在正确的实现上全部通过，再检查它们能不能发现每一个错误的实现
  if (spec.grading === 'tests' && result.passed) {
    const mutants: MutantResult[] = [];
    try {
      for (const mutant of files.mutants ?? []) mutants.push(await checkMutant(spec, files, mutant, studentFiles, testFiles));
    } catch (err) {
      result.internalError = `检查错误实现时出错：${err instanceof Error ? err.message : String(err)}`;
      result.passed = false;
      return result;
    }
    result.mutants = mutants;
    result.passed = mutants.every((m) => m.caught);
  }
  return result;
}
