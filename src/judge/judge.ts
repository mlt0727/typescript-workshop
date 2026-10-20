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
}

export interface JudgeFiles {
  /** 学生可编辑的文件（提交时冻结的快照） */
  student: Record<string, string>;
  /** 平台提供、学生不可编辑的辅助文件 */
  support: Record<string, string>;
  /** 测试文件：*.test.ts(x) 会运行，*.test-d.ts 只做类型检查 */
  tests: Record<string, string>;
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

export async function judge(spec: JudgeSpec, files: JudgeFiles): Promise<JudgeResult> {
  const snapshot = { ...files.student };
  const snapshotHash = await hashFiles(snapshot);
  const all = { ...files.support, ...snapshot, ...files.tests };
  const studentFiles = Object.keys(snapshot);
  const testFiles = Object.keys(files.tests);
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
    const compiled = await getCompiler().call('judge', {
      projectId: spec.projectId,
      spec: { mode: spec.mode, overrides: spec.overrides, files: all, withTests: true },
      studentFiles,
      testFiles,
      forbid: spec.forbid,
      // React 模式的测试直接渲染组件，不运行入口；DOM 模式每个测试前运行入口
      runEntries: spec.mode === 'dom' ? runEntries('dom', all, spec.entry) : [],
      loopGuard: spec.mode !== 'ts',
    });
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
      result.internalError = '题目配置错误：要求行为测试，但没有 *.test.ts 文件';
      return result;
    }
    const outcome = await runTests({
      mode: spec.mode,
      bundle,
      testEntries: runtimeTests.map((t) => `file:${t}`),
      page: spec.mode === 'ts' ? undefined : pageInput(all),
      timeoutMs: spec.timeoutMs,
      perTestTimeoutMs: spec.perTestTimeoutMs,
      fixtures: spec.fixtures,
    });
    result.tests.results = outcome.results;
    result.tests.error = outcome.error;
    result.tests.logs = outcome.logs;
    result.tests.ok =
      outcome.error === undefined &&
      outcome.results.length > 0 &&
      outcome.results.every((r) => r.status === 'pass');
  }

  result.passed = result.types.ok && result.rules.ok && result.tests.ok;
  return result;
}
