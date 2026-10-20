import type {
  CompletionItem,
  DiagnosticInfo,
  ProjectSpec,
  QuickInfo,
  RuleId,
  RuleViolation,
  RunBundle,
} from './core/types.ts';

/** 主线程 ⇄ 编译器 Worker 的 RPC 方法表（编译器 Worker 只运行平台自己的代码，不运行学生代码）。 */
export interface CompilerMethods {
  init(params: { baseUrl: string }): { tsVersion: string };
  diagnostics(params: { projectId: string; spec: ProjectSpec; files?: string[] }): {
    diagnostics: DiagnosticInfo[];
    suggestions: DiagnosticInfo[];
  };
  completions(params: { projectId: string; spec: ProjectSpec; file: string; position: number }): CompletionItem[];
  completionDetail(params: { projectId: string; file: string; position: number; name: string }): QuickInfo | null;
  quickInfo(params: { projectId: string; spec: ProjectSpec; file: string; position: number }): QuickInfo | null;
  buildRun(params: { projectId: string; spec: ProjectSpec; entries: string[]; loopGuard: boolean }): {
    bundle: RunBundle;
    diagnostics: DiagnosticInfo[];
  };
  /** 把单个文件转译成 JavaScript（教学用：展示类型擦除后的代码） */
  emitJs(params: { mode: ProjectSpec['mode']; file: string; content: string }): { code: string };
  judge(params: {
    projectId: string;
    spec: ProjectSpec;
    studentFiles: string[];
    testFiles: string[];
    forbid: RuleId[];
    runEntries: string[];
    loopGuard: boolean;
  }): {
    diagnostics: DiagnosticInfo[];
    rules: RuleViolation[];
    bundle: RunBundle;
  };
}

export type CompilerMethod = keyof CompilerMethods;

export interface CompilerRequest<M extends CompilerMethod = CompilerMethod> {
  id: number;
  method: M;
  params: Parameters<CompilerMethods[M]>[0];
}

export type CompilerResponse =
  | { id: number; ok: true; result: unknown }
  | { id: number; ok: false; error: string };
