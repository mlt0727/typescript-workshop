import type { CompilerOverrides, RunMode, TypeGroup } from '../config.ts';

export type DiagnosticCategory = 'error' | 'warning' | 'suggestion' | 'message';

export interface DiagnosticInfo {
  /** 相对路径，例如 "main.ts"；全局诊断没有文件。 */
  file?: string;
  start?: number;
  length?: number;
  /** 1 起始 */
  line?: number;
  /** 1 起始 */
  column?: number;
  endLine?: number;
  endColumn?: number;
  code: number;
  category: DiagnosticCategory;
  message: string;
  /** 例如 TS 2578：未使用的 @ts-expect-error 指令 */
  related?: { file?: string; line?: number; column?: number; message: string }[];
}

export type RuleId = 'any' | 'type-assertion' | 'non-null-assertion' | 'ts-directive' | 'var';

export const ALL_RULES: readonly RuleId[] = [
  'any',
  'type-assertion',
  'non-null-assertion',
  'ts-directive',
  'var',
];

export interface RuleViolation {
  rule: RuleId;
  file: string;
  line: number;
  column: number;
  message: string;
}

export interface ProjectSpec {
  mode: RunMode;
  overrides?: CompilerOverrides;
  /** 路径 → 内容；路径不带前导斜杠，例如 "main.ts"、"index.html" */
  files: Record<string, string>;
  /** 是否加载测试相关类型（vitest 子集、Testing Library） */
  withTests?: boolean;
}

export interface CompletionItem {
  name: string;
  kind: string;
  sortText: string;
  insertText?: string;
  /** 替换范围（相对文件的偏移） */
  replacementStart?: number;
  replacementLength?: number;
}

export interface QuickInfo {
  start: number;
  length: number;
  display: string;
  documentation: string;
}

/** 运行用的已转译模块。specifier 已被替换为带随机 nonce 的占位符。 */
export interface RunModule {
  /** 模块 id，形如 "file:main.ts"、"css:style.css" */
  id: string;
  path: string;
  kind: 'js' | 'css';
  code: string;
  /** source map JSON 文本（仅 js） */
  map?: string;
  /** 本模块引用的其他模块 id（用于拓扑排序） */
  deps: string[];
}

export interface RunBundle {
  nonce: string;
  modules: RunModule[];
  /** 入口模块 id 列表（例如学生入口、测试文件） */
  entries: string[];
  /** 平台提供的依赖名（react、vitest……） */
  externalDeps: string[];
  /** 找不到的导入，会在运行时报错 */
  missing: { from: string; specifier: string }[];
}

export interface BuildRunOptions {
  entries: string[];
  nonce: string;
  loopGuard: boolean;
}

export type { CompilerOverrides, RunMode, TypeGroup };
