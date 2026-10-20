/**
 * 课程练习的编译配置（纯数据，主线程、编译器 Worker、Node 脚本共用）。
 *
 * 编辑器诊断、提交判题与课程验证都从这里构建配置，保证三者一致。
 * 选项采用 tsconfig.json 的 JSON 写法，由使用方通过 ts.convertCompilerOptionsFromJson 转换。
 */

export const TS_VERSION = '6.0.3';

export type RunMode = 'ts' | 'dom' | 'react';

export const RUN_MODES: readonly RunMode[] = ['ts', 'dom', 'react'];

/** 类型包分组：public/tsw-types/<TS_VERSION>/<group>.json */
export type TypeGroup = 'core' | 'test' | 'dom-testing' | 'react';

/**
 * 默认选项：对齐 TypeScript 6.0 `tsc --init` 与 create-vite 9 模板的现代默认值。
 * 有意不开启 noUnusedLocals/noUnusedParameters：它们会把教学示例中的未使用变量报成错误。
 * 有意不开启 exactOptionalPropertyTypes：在 c11 课单独讲解。
 */
const BASE_OPTIONS = {
  target: 'ES2025',
  module: 'ESNext',
  moduleResolution: 'Bundler',
  strict: true,
  noUncheckedIndexedAccess: true,
  verbatimModuleSyntax: true,
  isolatedModules: true,
  moduleDetection: 'force',
  erasableSyntaxOnly: true,
  noFallthroughCasesInSwitch: true,
  allowImportingTsExtensions: true,
  noEmit: true,
  skipLibCheck: true,
  types: [],
} as const;

const MODE_OPTIONS: Record<RunMode, Record<string, unknown>> = {
  // 纯 TS 代码运行在 Web Worker 中：没有 document，但有 console、setTimeout、fetch 等。
  ts: { lib: ['ES2025', 'WebWorker'] },
  dom: { lib: ['ES2025', 'DOM'] },
  react: { lib: ['ES2025', 'DOM'], jsx: 'react-jsx' },
};

/** 课程可以覆盖的选项（必须在课文中说明原因）。 */
export const OVERRIDABLE_OPTIONS = [
  'strict',
  'strictNullChecks',
  'noImplicitAny',
  'noUncheckedIndexedAccess',
  'exactOptionalPropertyTypes',
  'erasableSyntaxOnly',
  'useUnknownInCatchVariables',
  'noImplicitReturns',
  'noUnusedLocals',
  'noUnusedParameters',
  'noPropertyAccessFromIndexSignature',
  'strictFunctionTypes',
  'noImplicitOverride',
] as const;

export type OverridableOption = (typeof OVERRIDABLE_OPTIONS)[number];

export type CompilerOverrides = Partial<Record<OverridableOption, boolean>>;

export function typeGroupsFor(mode: RunMode, withTests: boolean): TypeGroup[] {
  const groups: TypeGroup[] = ['core'];
  if (withTests) groups.push('test');
  if (withTests && mode !== 'ts') groups.push('dom-testing');
  if (mode === 'react') groups.push('react');
  return groups;
}

/** 用于类型检查的原始选项（tsconfig JSON 形式）。 */
export function rawCheckOptions(
  mode: RunMode,
  overrides: CompilerOverrides = {},
): Record<string, unknown> {
  for (const key of Object.keys(overrides)) {
    if (!(OVERRIDABLE_OPTIONS as readonly string[]).includes(key)) {
      throw new Error(`不允许覆盖编译选项：${key}`);
    }
  }
  return { ...BASE_OPTIONS, ...MODE_OPTIONS[mode], ...overrides };
}

/** 用于运行时逐文件转译的原始选项：与检查选项相同的 target/jsx，但需要真正产出 JS。 */
export function rawTranspileOptions(mode: RunMode): Record<string, unknown> {
  return {
    target: BASE_OPTIONS.target,
    module: 'ESNext',
    verbatimModuleSyntax: true,
    isolatedModules: true,
    moduleDetection: 'force',
    sourceMap: true,
    inlineSources: false,
    ...(mode === 'react' ? { jsx: 'react-jsx' } : {}),
  };
}

/** 展示给学习者的“本练习编译配置”（只列与默认值相关的关键项）。 */
export function describeOptions(mode: RunMode, overrides: CompilerOverrides = {}): string {
  const raw = rawCheckOptions(mode, overrides);
  const shown: Record<string, unknown> = {};
  for (const key of [
    'target',
    'lib',
    'module',
    'moduleResolution',
    'jsx',
    'strict',
    'noUncheckedIndexedAccess',
    'verbatimModuleSyntax',
    'erasableSyntaxOnly',
    ...Object.keys(overrides),
  ]) {
    if (key in raw) shown[key] = raw[key];
  }
  return JSON.stringify({ compilerOptions: shown }, null, 2);
}
