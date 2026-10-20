/** 构建后的课程数据结构（由 scripts/build-content.ts 生成，应用按需加载）。 */
import type { CompilerOverrides, RunMode } from '../compiler/config.ts';
import type { RuleId } from '../compiler/core/types.ts';
import type { FetchFixture } from '../shared/sandbox-protocol.ts';

export type LessonStatus = 'planned' | 'draft' | 'published';
export type ReviewStatus = 'ai-draft' | 'self-reviewed' | 'reviewed';

export interface CatalogLesson {
  id: string;
  title: string;
  stage: string;
  status: LessonStatus;
  prerequisites: string[];
  /** 仅 draft/published 有 */
  version?: number;
  objectives?: string[];
  estimatedMinutes?: number;
  review?: ReviewStatus;
  mode?: RunMode;
  /** 本课的练习 id（用于计算进度） */
  exerciseIds?: string[];
  quizCount?: number;
}

export interface CatalogStage {
  id: string;
  title: string;
  summary: string;
  lessons: CatalogLesson[];
}

export interface Catalog {
  version: number;
  builtAt: string;
  stages: CatalogStage[];
  counts: { published: number; draft: number; planned: number; total: number };
}

export interface SourceFile {
  path: string;
  content: string;
  /** 平台提供的辅助文件：不在编辑器标签中显示 */
  hidden?: boolean;
  /** 显示但不可编辑 */
  readonly?: boolean;
}

export interface ExpectedDiagnostic {
  code: number;
  file: string;
  line: number;
}

export interface CompilerSettings {
  overrides?: CompilerOverrides;
  /** 覆盖默认配置时必须说明原因 */
  note?: string;
}

export interface PlaygroundBlock {
  kind: 'playground';
  id: string;
  mode: RunMode;
  entry: string;
  files: SourceFile[];
  /** “观察什么”的说明 */
  observeHtml?: string;
  /** 故意包含的类型错误（教学用），按文件+行+诊断码匹配 */
  expectDiagnostics: ExpectedDiagnostic[];
  /** 运行预期：ok（正常结束）/ error（故意演示运行时错误）/ skip（不自动验证运行，例如需要停止的死循环演示） */
  expectRun: 'ok' | 'error' | 'skip';
  compiler: CompilerSettings;
  fixtures?: FetchFixture[];
  timeoutMs: number;
  /** 起始文件内容哈希，用于识别课程更新后草稿是否过期 */
  baseHash: string;
}

export interface ProseBlock {
  kind: 'prose';
  id: string;
  html: string;
}

export interface ExerciseRefBlock {
  kind: 'exercise';
  id: string;
}

export interface QuizRefBlock {
  kind: 'quiz';
  id: string;
}

export type LessonBlock = ProseBlock | PlaygroundBlock | ExerciseRefBlock | QuizRefBlock;

export interface Hint {
  level: 1 | 2;
  html: string;
}

export interface Exercise {
  id: string;
  kind: 'task' | 'challenge';
  title: string;
  promptHtml: string;
  mode: RunMode;
  entry: string;
  starter: SourceFile[];
  solution: SourceFile[];
  support: SourceFile[];
  tests: SourceFile[];
  runTests: boolean;
  forbid: RuleId[];
  expectDiagnostics: ExpectedDiagnostic[];
  hints: Hint[];
  explanationHtml: string;
  compiler: CompilerSettings;
  fixtures?: FetchFixture[];
  timeoutMs: number;
  perTestTimeoutMs: number;
  baseHash: string;
}

export interface QuizOption {
  id: string;
  html: string;
  correct: boolean;
  explainHtml: string;
}

export interface QuizQuestion {
  id: string;
  type: 'single' | 'multiple';
  promptHtml: string;
  options: QuizOption[];
  explainHtml?: string;
}

export interface Reference {
  title: string;
  url: string;
  checked: string;
  note?: string;
}

export interface Lesson {
  id: string;
  version: number;
  title: string;
  stage: string;
  stageTitle: string;
  status: Exclude<LessonStatus, 'planned'>;
  review: ReviewStatus;
  prerequisites: string[];
  objectives: string[];
  problem: string;
  estimatedMinutes: number;
  mode: RunMode;
  references: Reference[];
  blocks: LessonBlock[];
  exercises: Record<string, Exercise>;
  quiz: QuizQuestion[];
  /** 本课是否为“代表案例”（为提前验证运行模式而先写的课，先修课尚未全部完成） */
  representative?: boolean;
  /** 上一课/下一课（按课程图谱顺序，仅已发布或草稿） */
  prev?: { id: string; title: string };
  next?: { id: string; title: string };
}

/** 课程验证数据：每个练习的所有变体及其预期结果。 */
export interface ExerciseVariant {
  name: string;
  kind: 'starter' | 'solution' | 'alt' | 'wrong';
  files: Record<string, string>;
  /** wrong：期望在哪一步失败 */
  fails?: 'types' | 'tests' | 'rules';
  reason?: string;
}

export interface VerifyExercise {
  lessonId: string;
  exerciseId: string;
  variants: ExerciseVariant[];
}

export interface VerifyData {
  builtAt: string;
  exercises: VerifyExercise[];
}
