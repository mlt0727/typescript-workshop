---
kind: challenge
title: 计算一个文件最终使用的 ESLint 配置
---
ESLint 的 flat config 是配置对象的数组。在 `flat-config.ts` 中实现 `computeConfig(configs, path)`：计算文件 `path`（相对于项目根目录，用 `/` 分隔）最终使用的规则；不需要检查时返回 `null`。测试中的结果都与 ESLint 10.13 的 `calculateConfigForFile` 对照过（ESLint 还会补上规则的默认选项，这里不处理）。

**`matchGlob(pattern, path)`**：从根目录开始匹配整个路径。`*` 匹配除 `/` 以外的任意字符，`?` 匹配一个非 `/` 的字符，`{a,b}` 匹配其中之一；单独的一段 `**` 匹配零层或多层文件夹（在结尾时匹配其中的一切）。

**`computeConfig`**：

1. **全局忽略**：只有 `ignores`、没有 `files` 和 `rules` 的配置对象。路径匹配其中任何一个模式时，返回 `null`；
2. **适用**：其他配置对象，没有 `files` 或者路径匹配 `files` 中的某个模式，并且不匹配它自己的 `ignores` 中的任何模式时，适用于这个文件；
3. **需要检查**：路径匹配 `**/*.js`、`**/*.mjs`、`**/*.cjs` 之一，或者匹配某个**适用的**配置对象 `files` 中的一个**非通用**的模式。通用的模式是 `*`、以 `!` 开头的、以 `/*` 或 `/**` 结尾的（例如 `src/**`、`**/*`），它们不会让一个文件需要被检查。不需要检查时返回 `null`；
4. **合并**：按顺序处理每个适用的配置对象的 `rules`，后面的覆盖前面的。严重程度统一成数字（`'off'`、`'warn'`、`'error'` 是 0、1、2）。规则写成数组且带有选项（`['error', 'smart']`）时，替换之前的选项；只写了严重程度（`'warn'`、`2`、`[1]`）时，保留之前的选项；
5. 返回 `{ 规则名: [严重程度, ...选项] }`。

:::files{role=starter}
```ts file=flat-config.ts
export type Severity = 'off' | 'warn' | 'error' | 0 | 1 | 2;
export type RuleEntry = Severity | [Severity, ...unknown[]];
export type ConfigObject = { files?: string[]; ignores?: string[]; rules?: Record<string, RuleEntry> };
/** 合并后的规则：严重程度统一成数字，后面是选项 */
export type ResolvedRules = Record<string, [0 | 1 | 2, ...unknown[]]>;

export function matchGlob(pattern: string, path: string): boolean {
  return pattern === path;
}

export function computeConfig(configs: readonly ConfigObject[], path: string): ResolvedRules | null {
  const rules: ResolvedRules = {};
  for (const config of configs) {
    for (const [name, entry] of Object.entries(config.rules ?? {})) {
      rules[name] = [Array.isArray(entry) ? 2 : 1];
    }
  }
  return rules;
}
```
```ts file=main.ts
import { computeConfig, type ConfigObject } from './flat-config';

const configs: ConfigObject[] = [
  { ignores: ['dist/**'] },
  { rules: { eqeqeq: ['error', 'smart'], 'no-console': 'warn' } },
  { files: ['**/*.ts'], rules: { eqeqeq: 'warn' } },
  { files: ['**/*.test.ts'], rules: { 'no-console': 'off' } },
];

for (const path of ['index.js', 'src/a.ts', 'src/a.test.ts', 'dist/a.js', 'README.md']) {
  console.log(path.padEnd(14), JSON.stringify(computeConfig(configs, path)));
}
```
:::

:::files{role=solution}
```ts file=flat-config.ts
export type Severity = 'off' | 'warn' | 'error' | 0 | 1 | 2;
export type RuleEntry = Severity | [Severity, ...unknown[]];
export type ConfigObject = { files?: string[]; ignores?: string[]; rules?: Record<string, RuleEntry> };
/** 合并后的规则：严重程度统一成数字，后面是选项 */
export type ResolvedRules = Record<string, [0 | 1 | 2, ...unknown[]]>;

function escape(text: string): string {
  return text.replace(/[.+^${}()|[\]\\]/g, '\\$&');
}

/** 一段（不含 /）中的 *、?、{a,b} */
function segmentSource(segment: string): string {
  let source = '';
  for (let i = 0; i < segment.length; i++) {
    const char = segment.charAt(i);
    const close = char === '{' ? segment.indexOf('}', i) : -1;
    if (char === '*') source += '[^/]*';
    else if (char === '?') source += '[^/]';
    else if (close !== -1) {
      source += `(?:${segment.slice(i + 1, close).split(',').map(escape).join('|')})`;
      i = close;
    } else source += escape(char);
  }
  return source;
}

export function matchGlob(pattern: string, path: string): boolean {
  const segments = pattern.split('/');
  let source = '';
  segments.forEach((segment, i) => {
    const last = i === segments.length - 1;
    if (segment === '**') source += last ? '.*' : '(?:[^/]+/)*';
    else source += segmentSource(segment) + (last ? '' : '/');
  });
  return new RegExp(`^${source}$`).test(path);
}

const DEFAULT_FILES = ['**/*.js', '**/*.mjs', '**/*.cjs'];
/** 这些模式只决定配置是否适用，不会让一个文件“需要被检查”（与 ESLint 源代码中的规则相同） */
const UNIVERSAL = /^\*$|^!|\/\*{1,2}$/;
const LEVELS = { off: 0, warn: 1, error: 2 } as const;

const isGlobalIgnore = (config: ConfigObject) => config.ignores !== undefined && config.files === undefined && config.rules === undefined;

function applies(config: ConfigObject, path: string): boolean {
  if (isGlobalIgnore(config)) return false;
  if (config.files !== undefined && !config.files.some((pattern) => matchGlob(pattern, path))) return false;
  return !(config.ignores ?? []).some((pattern) => matchGlob(pattern, path));
}

function level(severity: Severity): 0 | 1 | 2 {
  return typeof severity === 'number' ? severity : LEVELS[severity];
}

export function computeConfig(configs: readonly ConfigObject[], path: string): ResolvedRules | null {
  // 1. 全局忽略：只有 ignores 的配置对象
  if (configs.some((config) => isGlobalIgnore(config) && (config.ignores ?? []).some((pattern) => matchGlob(pattern, path)))) return null;

  // 2. 这个文件需要被检查吗？
  const linted =
    DEFAULT_FILES.some((pattern) => matchGlob(pattern, path)) ||
    configs.some((config) => applies(config, path) && (config.files ?? []).some((pattern) => !UNIVERSAL.test(pattern) && matchGlob(pattern, path)));
  if (!linted) return null;

  // 3. 按顺序合并适用的配置对象：只写严重程度时，保留之前的选项
  const rules: ResolvedRules = {};
  for (const config of configs) {
    if (!applies(config, path)) continue;
    for (const [name, entry] of Object.entries(config.rules ?? {})) {
      const [severity, ...options] = Array.isArray(entry) ? entry : [entry];
      const previous = rules[name]?.slice(1) ?? [];
      rules[name] = [level(severity), ...(options.length > 0 ? options : previous)];
    }
  }
  return rules;
}
```
```ts file=main.ts
import { computeConfig, type ConfigObject } from './flat-config';

const configs: ConfigObject[] = [
  { ignores: ['dist/**'] },
  { rules: { eqeqeq: ['error', 'smart'], 'no-console': 'warn' } },
  { files: ['**/*.ts'], rules: { eqeqeq: 'warn' } },
  { files: ['**/*.test.ts'], rules: { 'no-console': 'off' } },
];

for (const path of ['index.js', 'src/a.ts', 'src/a.test.ts', 'dist/a.js', 'README.md']) {
  console.log(path.padEnd(14), JSON.stringify(computeConfig(configs, path)));
}
```
:::

:::files{role=tests}
```ts file=flat-config.test.ts
import { describe, expect, test } from 'vitest';
import { computeConfig, matchGlob, type ConfigObject } from './flat-config';

// 与 ESLint 10.13 的 calculateConfigForFile 对照得到的结果。
// ESLint 还会为每条规则补上默认的选项（例如 curly 显示为 [2, "all"]），这里不处理，只比较明确写出的选项。
const configs: ConfigObject[] = [
  { ignores: ['dist/**', '**/*.min.js'] },
  { rules: { eqeqeq: ['error', 'smart'], 'no-console': 'warn', curly: 'error' } },
  { files: ['**/*.ts'], rules: { eqeqeq: 'warn', 'prefer-const': ['error', { destructuring: 'all' }] } },
  { files: ['**/*.test.ts'], rules: { 'no-console': 'off', curly: ['warn', 'multi'] } },
  { files: ['src/**'], ignores: ['src/legacy/**'], rules: { 'no-console': ['error', { allow: ['warn'] }] } },
  { files: ['*.config.js'], rules: { curly: 0 } },
  { files: ['scripts/*.js'], rules: { eqeqeq: [1] } },
];
const preferConst = [2, { destructuring: 'all' }];

describe('matchGlob', () => {
  test('* 与 ? 不跨越 /，** 匹配任意层', () => {
    expect(matchGlob('**/*.ts', 'a.ts')).toBe(true);
    expect(matchGlob('**/*.ts', 'src/deep/a.ts')).toBe(true);
    expect(matchGlob('*.config.js', 'vite.config.js')).toBe(true);
    expect(matchGlob('*.config.js', 'tools/vite.config.js')).toBe(false);
    expect(matchGlob('src/**', 'src/a/b.ts')).toBe(true);
    expect(matchGlob('src/**', 'lib/a.ts')).toBe(false);
    expect(matchGlob('file?.js', 'file1.js')).toBe(true);
    expect(matchGlob('file?.js', 'file10.js')).toBe(false);
  });

  test('{a,b}', () => {
    expect(matchGlob('**/*.{ts,tsx}', 'src/a.tsx')).toBe(true);
    expect(matchGlob('**/*.{ts,tsx}', 'src/a.js')).toBe(false);
  });
});

describe('computeConfig：规则的合并', () => {
  test('没有 files 的配置适用于所有文件', () => {
    expect(computeConfig(configs, 'index.js')).toEqual({ eqeqeq: [2, 'smart'], 'no-console': [1], curly: [2] });
  });

  test('只写严重程度时保留之前的选项；写了选项时替换', () => {
    expect(computeConfig(configs, 'src/a.ts')).toEqual({ eqeqeq: [1, 'smart'], 'no-console': [2, { allow: ['warn'] }], curly: [2], 'prefer-const': preferConst });
    expect(computeConfig(configs, 'src/deep/b.ts')).toEqual({ eqeqeq: [1, 'smart'], 'no-console': [2, { allow: ['warn'] }], curly: [2], 'prefer-const': preferConst });
  });

  test('后面的配置覆盖前面的：src/** 写在 *.test.ts 之后', () => {
    expect(computeConfig(configs, 'src/a.test.ts')).toEqual({ eqeqeq: [1, 'smart'], 'no-console': [2, { allow: ['warn'] }], curly: [1, 'multi'], 'prefer-const': preferConst });
    expect(computeConfig(configs, 'test/a.test.ts')).toEqual({ eqeqeq: [1, 'smart'], 'no-console': [0], curly: [1, 'multi'], 'prefer-const': preferConst });
  });

  test('配置对象自己的 ignores 只让这个对象不适用', () => {
    expect(computeConfig(configs, 'src/legacy/old.ts')).toEqual({ eqeqeq: [1, 'smart'], 'no-console': [1], curly: [2], 'prefer-const': preferConst });
    expect(computeConfig(configs, 'src/legacy/old.test.ts')).toEqual({ eqeqeq: [1, 'smart'], 'no-console': [0], curly: [1, 'multi'], 'prefer-const': preferConst });
  });

  test('模式从根目录开始匹配；数字的严重程度；[1] 也只是严重程度', () => {
    expect(computeConfig(configs, 'vite.config.js')).toEqual({ eqeqeq: [2, 'smart'], 'no-console': [1], curly: [0] });
    expect(computeConfig(configs, 'tools/vite.config.js')).toEqual({ eqeqeq: [2, 'smart'], 'no-console': [1], curly: [2] });
    expect(computeConfig(configs, 'scripts/build.js')).toEqual({ eqeqeq: [1, 'smart'], 'no-console': [1], curly: [2] });
    expect(computeConfig(configs, 'scripts/deep/x.js')).toEqual({ eqeqeq: [2, 'smart'], 'no-console': [1], curly: [2] });
  });
});

describe('computeConfig：哪些文件被检查', () => {
  test('全局忽略', () => {
    expect(computeConfig(configs, 'dist/a.js')).toBeNull();
    expect(computeConfig(configs, 'lib/x.min.js')).toBeNull();
  });

  test('不是 .js / .mjs / .cjs、也没有被 files 匹配的文件不检查', () => {
    expect(computeConfig(configs, 'README.md')).toBeNull();
    // src/** 是“通用”的模式：它让配置适用于 src 中的文件，但不会让 .md 文件需要被检查
    expect(computeConfig(configs, 'src/notes.md')).toBeNull();
  });

  test('.cjs、.mjs 默认就检查；files 中具体的模式让其他文件也被检查', () => {
    const only: ConfigObject[] = [{ files: ['**/*.{ts,tsx}'], rules: { curly: 'error' } }];
    expect(computeConfig(only, 'src/a.tsx')).toEqual({ curly: [2] });
    expect(computeConfig(only, 'x.cjs')).toEqual({});
    expect(computeConfig(only, 'README.md')).toBeNull();
    expect(computeConfig([{ files: ['**'], rules: { curly: 'error' } }], 'README.md')).toEqual({ curly: [2] });
    expect(computeConfig([{ files: ['**/*'], rules: { curly: 'error' } }], 'README.md')).toBeNull();
    expect(computeConfig([{ files: ['**/*'], rules: { curly: 'error' } }], 'build/a.js')).toEqual({ curly: [2] });
  });

  test('只有适用的配置对象的 files 才让文件需要被检查', () => {
    // 这个对象自己的 ignores 排除了根目录的 README.md：它不适用，README.md 也就不需要检查
    const md: ConfigObject[] = [{ files: ['**/*.md'], ignores: ['README.md'], rules: { curly: 'error' } }];
    expect(computeConfig(md, 'README.md')).toBeNull();
    expect(computeConfig(md, 'docs/README.md')).toEqual({ curly: [2] });
    expect(computeConfig(md, 'a.js')).toEqual({});
  });
});
```
:::

:::hint{level=1}
先写 `matchGlob`：按 `/` 分段，`**` 这一段在中间时换成 `(?:[^/]+/)*`，在结尾时换成 `.*`；其他段逐个字符翻译（`*` 是 `[^/]*`，`{a,b}` 是 `(?:a|b)`，其余字符转义）。然后按第 1–4 步写 `computeConfig`，“适用”写成一个单独的函数 `applies(config, path)`，第 3、4 步都要用。
:::

:::hint{level=2}
合并时把每个条目统一成数组：`const [severity, ...options] = Array.isArray(entry) ? entry : [entry]`。`options` 为空时，用之前已经合并出的选项 `rules[name]?.slice(1) ?? []`。“通用的模式”可以用一个正则判断：`/^\*$|^!|\/\*{1,2}$/`。
:::

:::explanation
flat config 的规则比旧版的 `.eslintrc` 简单：**没有继承，没有层叠的配置文件，只有一个数组**，按顺序找出适用的对象，后面的覆盖前面的。读一份配置时，从上往下看，就知道某个文件最终用的是什么规则。

几个容易出错的地方：

- **只写严重程度会保留选项**：`{ rules: { eqeqeq: 'warn' } }` 只是把 `eqeqeq` 降级为警告，之前配置的 `'smart'` 仍然有效。这让“在某些文件中把规则改成警告”非常方便；
- **两种 `ignores`**：一个只有 `ignores` 的对象是**全局**的，匹配的文件完全不检查；和 `files`、`rules` 写在一起的 `ignores` 只让**这个对象**不适用。`src/legacy/old.ts` 仍然被检查，只是没有用 `src/**` 那个对象中的规则；
- **模式从根目录开始**：`*.config.js` 只匹配根目录中的文件，要匹配任意一层写 `**/*.config.js`。这一点和 `.gitignore`（f10）不同，`.gitignore` 中没有 `/` 的模式匹配任何一层；
- **哪些文件需要检查**：默认只检查 `.js`、`.mjs`、`.cjs`。`files: ['**/*.ts']` 让 `.ts` 文件也被检查；而 `src/**` 这样的“通用”模式只表示“这个对象适用于 `src` 中的文件”，不会让 `src/notes.md` 被当成 JavaScript 去检查。这条规则来自 ESLint 的源代码（`@eslint/config-array`）。

调试真实的配置时，运行 `npx eslint --print-config 文件`，它输出的就是这道题计算的结果（加上规则的默认选项和其他设置）。
:::

:::variant{kind=alt name=char-by-char}
```ts file=flat-config.ts
export type Severity = 'off' | 'warn' | 'error' | 0 | 1 | 2;
export type RuleEntry = Severity | [Severity, ...unknown[]];
export type ConfigObject = { files?: string[]; ignores?: string[]; rules?: Record<string, RuleEntry> };
/** 合并后的规则：严重程度统一成数字，后面是选项 */
export type ResolvedRules = Record<string, [0 | 1 | 2, ...unknown[]]>;

function globToRegExp(glob: string): RegExp {
  let out = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob.charAt(i);
    if (c === '*' && glob.charAt(i + 1) === '*') {
      const startsSegment = i === 0 || glob.charAt(i - 1) === '/';
      if (startsSegment && glob.charAt(i + 2) === '/') {
        out += '(?:[^/]+/)*';
        i += 2;
        continue;
      }
      if (startsSegment && i + 2 === glob.length) {
        out += '.*';
        i += 1;
        continue;
      }
    }
    if (c === '*') out += '[^/]*';
    else if (c === '?') out += '[^/]';
    else if (c === '{' && glob.includes('}', i)) {
      const end = glob.indexOf('}', i);
      out += '(?:' + glob.slice(i + 1, end).split(',').map((alt) => alt.replace(/[.+^$()|[\]\\]/g, '\\$&')).join('|') + ')';
      i = end;
    } else out += /[.+^$()|[\]\\{}]/.test(c) ? '\\' + c : c;
  }
  return new RegExp('^' + out + '$');
}

export function matchGlob(pattern: string, path: string): boolean {
  return globToRegExp(pattern).test(path);
}

function toLevel(severity: Severity): 0 | 1 | 2 {
  switch (severity) {
    case 'off':
    case 0:
      return 0;
    case 'warn':
    case 1:
      return 1;
    default:
      return 2;
  }
}

export function computeConfig(configs: readonly ConfigObject[], path: string): ResolvedRules | null {
  const matchesAny = (patterns: readonly string[] | undefined) => (patterns ?? []).some((p) => matchGlob(p, path));
  const onlyIgnores = (c: ConfigObject) => Object.keys(c).length === 1 && c.ignores !== undefined;
  if (configs.some((c) => onlyIgnores(c) && matchesAny(c.ignores))) return null;

  const active = configs.filter((c) => !onlyIgnores(c) && (c.files === undefined || matchesAny(c.files)) && !matchesAny(c.ignores));
  const isUniversal = (p: string) => p === '*' || p.startsWith('!') || p.endsWith('/*') || p.endsWith('/**');
  const wanted = ['**/*.js', '**/*.mjs', '**/*.cjs'].some((p) => matchGlob(p, path)) || active.some((c) => (c.files ?? []).some((p) => !isUniversal(p) && matchGlob(p, path)));
  if (!wanted) return null;

  const resolved: ResolvedRules = {};
  for (const c of active) {
    for (const [rule, entry] of Object.entries(c.rules ?? {})) {
      if (Array.isArray(entry) && entry.length > 1) {
        const [severity, ...options] = entry;
        resolved[rule] = [toLevel(severity), ...options];
      } else {
        const severity = Array.isArray(entry) ? entry[0] : entry;
        const old = resolved[rule];
        resolved[rule] = old ? [toLevel(severity), ...old.slice(1)] : [toLevel(severity)];
      }
    }
  }
  return resolved;
}
```
:::

:::variant{kind=wrong name=severity-drops-options fails=tests reason="只写严重程度时把之前的选项也丢掉了：eqeqeq 的 smart 选项不见了"}
```ts file=flat-config.ts
export type Severity = 'off' | 'warn' | 'error' | 0 | 1 | 2;
export type RuleEntry = Severity | [Severity, ...unknown[]];
export type ConfigObject = { files?: string[]; ignores?: string[]; rules?: Record<string, RuleEntry> };
/** 合并后的规则：严重程度统一成数字，后面是选项 */
export type ResolvedRules = Record<string, [0 | 1 | 2, ...unknown[]]>;

function escape(text: string): string {
  return text.replace(/[.+^${}()|[\]\\]/g, '\\$&');
}

/** 一段（不含 /）中的 *、?、{a,b} */
function segmentSource(segment: string): string {
  let source = '';
  for (let i = 0; i < segment.length; i++) {
    const char = segment.charAt(i);
    const close = char === '{' ? segment.indexOf('}', i) : -1;
    if (char === '*') source += '[^/]*';
    else if (char === '?') source += '[^/]';
    else if (close !== -1) {
      source += `(?:${segment.slice(i + 1, close).split(',').map(escape).join('|')})`;
      i = close;
    } else source += escape(char);
  }
  return source;
}

export function matchGlob(pattern: string, path: string): boolean {
  const segments = pattern.split('/');
  let source = '';
  segments.forEach((segment, i) => {
    const last = i === segments.length - 1;
    if (segment === '**') source += last ? '.*' : '(?:[^/]+/)*';
    else source += segmentSource(segment) + (last ? '' : '/');
  });
  return new RegExp(`^${source}$`).test(path);
}

const DEFAULT_FILES = ['**/*.js', '**/*.mjs', '**/*.cjs'];
/** 这些模式只决定配置是否适用，不会让一个文件“需要被检查”（与 ESLint 源代码中的规则相同） */
const UNIVERSAL = /^\*$|^!|\/\*{1,2}$/;
const LEVELS = { off: 0, warn: 1, error: 2 } as const;

const isGlobalIgnore = (config: ConfigObject) => config.ignores !== undefined && config.files === undefined && config.rules === undefined;

function applies(config: ConfigObject, path: string): boolean {
  if (isGlobalIgnore(config)) return false;
  if (config.files !== undefined && !config.files.some((pattern) => matchGlob(pattern, path))) return false;
  return !(config.ignores ?? []).some((pattern) => matchGlob(pattern, path));
}

function level(severity: Severity): 0 | 1 | 2 {
  return typeof severity === 'number' ? severity : LEVELS[severity];
}

export function computeConfig(configs: readonly ConfigObject[], path: string): ResolvedRules | null {
  // 1. 全局忽略：只有 ignores 的配置对象
  if (configs.some((config) => isGlobalIgnore(config) && (config.ignores ?? []).some((pattern) => matchGlob(pattern, path)))) return null;

  // 2. 这个文件需要被检查吗？
  const linted =
    DEFAULT_FILES.some((pattern) => matchGlob(pattern, path)) ||
    configs.some((config) => applies(config, path) && (config.files ?? []).some((pattern) => !UNIVERSAL.test(pattern) && matchGlob(pattern, path)));
  if (!linted) return null;

  // 3. 按顺序合并适用的配置对象：只写严重程度时，保留之前的选项
  const rules: ResolvedRules = {};
  for (const config of configs) {
    if (!applies(config, path)) continue;
    for (const [name, entry] of Object.entries(config.rules ?? {})) {
      const [severity, ...options] = Array.isArray(entry) ? entry : [entry];
      const previous = rules[name]?.slice(1) ?? [];
      rules[name] = [level(severity), ...options];
      void previous;
    }
  }
  return rules;
}
```
:::

:::variant{kind=wrong name=first-wins fails=tests reason="先写的配置优先：后面的配置应该覆盖前面的"}
```ts file=flat-config.ts
export type Severity = 'off' | 'warn' | 'error' | 0 | 1 | 2;
export type RuleEntry = Severity | [Severity, ...unknown[]];
export type ConfigObject = { files?: string[]; ignores?: string[]; rules?: Record<string, RuleEntry> };
/** 合并后的规则：严重程度统一成数字，后面是选项 */
export type ResolvedRules = Record<string, [0 | 1 | 2, ...unknown[]]>;

function escape(text: string): string {
  return text.replace(/[.+^${}()|[\]\\]/g, '\\$&');
}

/** 一段（不含 /）中的 *、?、{a,b} */
function segmentSource(segment: string): string {
  let source = '';
  for (let i = 0; i < segment.length; i++) {
    const char = segment.charAt(i);
    const close = char === '{' ? segment.indexOf('}', i) : -1;
    if (char === '*') source += '[^/]*';
    else if (char === '?') source += '[^/]';
    else if (close !== -1) {
      source += `(?:${segment.slice(i + 1, close).split(',').map(escape).join('|')})`;
      i = close;
    } else source += escape(char);
  }
  return source;
}

export function matchGlob(pattern: string, path: string): boolean {
  const segments = pattern.split('/');
  let source = '';
  segments.forEach((segment, i) => {
    const last = i === segments.length - 1;
    if (segment === '**') source += last ? '.*' : '(?:[^/]+/)*';
    else source += segmentSource(segment) + (last ? '' : '/');
  });
  return new RegExp(`^${source}$`).test(path);
}

const DEFAULT_FILES = ['**/*.js', '**/*.mjs', '**/*.cjs'];
/** 这些模式只决定配置是否适用，不会让一个文件“需要被检查”（与 ESLint 源代码中的规则相同） */
const UNIVERSAL = /^\*$|^!|\/\*{1,2}$/;
const LEVELS = { off: 0, warn: 1, error: 2 } as const;

const isGlobalIgnore = (config: ConfigObject) => config.ignores !== undefined && config.files === undefined && config.rules === undefined;

function applies(config: ConfigObject, path: string): boolean {
  if (isGlobalIgnore(config)) return false;
  if (config.files !== undefined && !config.files.some((pattern) => matchGlob(pattern, path))) return false;
  return !(config.ignores ?? []).some((pattern) => matchGlob(pattern, path));
}

function level(severity: Severity): 0 | 1 | 2 {
  return typeof severity === 'number' ? severity : LEVELS[severity];
}

export function computeConfig(configs: readonly ConfigObject[], path: string): ResolvedRules | null {
  // 1. 全局忽略：只有 ignores 的配置对象
  if (configs.some((config) => isGlobalIgnore(config) && (config.ignores ?? []).some((pattern) => matchGlob(pattern, path)))) return null;

  // 2. 这个文件需要被检查吗？
  const linted =
    DEFAULT_FILES.some((pattern) => matchGlob(pattern, path)) ||
    configs.some((config) => applies(config, path) && (config.files ?? []).some((pattern) => !UNIVERSAL.test(pattern) && matchGlob(pattern, path)));
  if (!linted) return null;

  // 3. 按顺序合并适用的配置对象：只写严重程度时，保留之前的选项
  const rules: ResolvedRules = {};
  for (const config of [...configs].reverse()) {
    if (!applies(config, path)) continue;
    for (const [name, entry] of Object.entries(config.rules ?? {})) {
      const [severity, ...options] = Array.isArray(entry) ? entry : [entry];
      const previous = rules[name]?.slice(1) ?? [];
      rules[name] = [level(severity), ...(options.length > 0 ? options : previous)];
    }
  }
  return rules;
}
```
:::

:::variant{kind=wrong name=ignores-only-local fails=tests reason="把只有 ignores 的配置对象当成了普通的对象：dist 中的文件没有被全局忽略"}
```ts file=flat-config.ts
export type Severity = 'off' | 'warn' | 'error' | 0 | 1 | 2;
export type RuleEntry = Severity | [Severity, ...unknown[]];
export type ConfigObject = { files?: string[]; ignores?: string[]; rules?: Record<string, RuleEntry> };
/** 合并后的规则：严重程度统一成数字，后面是选项 */
export type ResolvedRules = Record<string, [0 | 1 | 2, ...unknown[]]>;

function escape(text: string): string {
  return text.replace(/[.+^${}()|[\]\\]/g, '\\$&');
}

/** 一段（不含 /）中的 *、?、{a,b} */
function segmentSource(segment: string): string {
  let source = '';
  for (let i = 0; i < segment.length; i++) {
    const char = segment.charAt(i);
    const close = char === '{' ? segment.indexOf('}', i) : -1;
    if (char === '*') source += '[^/]*';
    else if (char === '?') source += '[^/]';
    else if (close !== -1) {
      source += `(?:${segment.slice(i + 1, close).split(',').map(escape).join('|')})`;
      i = close;
    } else source += escape(char);
  }
  return source;
}

export function matchGlob(pattern: string, path: string): boolean {
  const segments = pattern.split('/');
  let source = '';
  segments.forEach((segment, i) => {
    const last = i === segments.length - 1;
    if (segment === '**') source += last ? '.*' : '(?:[^/]+/)*';
    else source += segmentSource(segment) + (last ? '' : '/');
  });
  return new RegExp(`^${source}$`).test(path);
}

const DEFAULT_FILES = ['**/*.js', '**/*.mjs', '**/*.cjs'];
/** 这些模式只决定配置是否适用，不会让一个文件“需要被检查”（与 ESLint 源代码中的规则相同） */
const UNIVERSAL = /^\*$|^!|\/\*{1,2}$/;
const LEVELS = { off: 0, warn: 1, error: 2 } as const;

const isGlobalIgnore = (config: ConfigObject) => config.ignores !== undefined && config.files === undefined && config.rules === undefined;

function applies(config: ConfigObject, path: string): boolean {
  if (isGlobalIgnore(config)) return false;
  if (config.files !== undefined && !config.files.some((pattern) => matchGlob(pattern, path))) return false;
  return !(config.ignores ?? []).some((pattern) => matchGlob(pattern, path));
}

function level(severity: Severity): 0 | 1 | 2 {
  return typeof severity === 'number' ? severity : LEVELS[severity];
}

export function computeConfig(configs: readonly ConfigObject[], path: string): ResolvedRules | null {
  // 1. 全局忽略：只有 ignores 的配置对象

  // 2. 这个文件需要被检查吗？
  const linted =
    DEFAULT_FILES.some((pattern) => matchGlob(pattern, path)) ||
    configs.some((config) => applies(config, path) && (config.files ?? []).some((pattern) => !UNIVERSAL.test(pattern) && matchGlob(pattern, path)));
  if (!linted) return null;

  // 3. 按顺序合并适用的配置对象：只写严重程度时，保留之前的选项
  const rules: ResolvedRules = {};
  for (const config of configs) {
    if (!applies(config, path)) continue;
    for (const [name, entry] of Object.entries(config.rules ?? {})) {
      const [severity, ...options] = Array.isArray(entry) ? entry : [entry];
      const previous = rules[name]?.slice(1) ?? [];
      rules[name] = [level(severity), ...(options.length > 0 ? options : previous)];
    }
  }
  return rules;
}
```
:::

:::variant{kind=wrong name=star-crosses-slash fails=tests reason="* 跨越了 /：*.config.js 匹配到了 tools/vite.config.js，scripts/*.js 匹配到了 scripts/deep/x.js"}
```ts file=flat-config.ts
export type Severity = 'off' | 'warn' | 'error' | 0 | 1 | 2;
export type RuleEntry = Severity | [Severity, ...unknown[]];
export type ConfigObject = { files?: string[]; ignores?: string[]; rules?: Record<string, RuleEntry> };
/** 合并后的规则：严重程度统一成数字，后面是选项 */
export type ResolvedRules = Record<string, [0 | 1 | 2, ...unknown[]]>;

function escape(text: string): string {
  return text.replace(/[.+^${}()|[\]\\]/g, '\\$&');
}

/** 一段（不含 /）中的 *、?、{a,b} */
function segmentSource(segment: string): string {
  let source = '';
  for (let i = 0; i < segment.length; i++) {
    const char = segment.charAt(i);
    const close = char === '{' ? segment.indexOf('}', i) : -1;
    if (char === '*') source += '.*';
    else if (char === '?') source += '[^/]';
    else if (close !== -1) {
      source += `(?:${segment.slice(i + 1, close).split(',').map(escape).join('|')})`;
      i = close;
    } else source += escape(char);
  }
  return source;
}

export function matchGlob(pattern: string, path: string): boolean {
  const segments = pattern.split('/');
  let source = '';
  segments.forEach((segment, i) => {
    const last = i === segments.length - 1;
    if (segment === '**') source += last ? '.*' : '(?:[^/]+/)*';
    else source += segmentSource(segment) + (last ? '' : '/');
  });
  return new RegExp(`^${source}$`).test(path);
}

const DEFAULT_FILES = ['**/*.js', '**/*.mjs', '**/*.cjs'];
/** 这些模式只决定配置是否适用，不会让一个文件“需要被检查”（与 ESLint 源代码中的规则相同） */
const UNIVERSAL = /^\*$|^!|\/\*{1,2}$/;
const LEVELS = { off: 0, warn: 1, error: 2 } as const;

const isGlobalIgnore = (config: ConfigObject) => config.ignores !== undefined && config.files === undefined && config.rules === undefined;

function applies(config: ConfigObject, path: string): boolean {
  if (isGlobalIgnore(config)) return false;
  if (config.files !== undefined && !config.files.some((pattern) => matchGlob(pattern, path))) return false;
  return !(config.ignores ?? []).some((pattern) => matchGlob(pattern, path));
}

function level(severity: Severity): 0 | 1 | 2 {
  return typeof severity === 'number' ? severity : LEVELS[severity];
}

export function computeConfig(configs: readonly ConfigObject[], path: string): ResolvedRules | null {
  // 1. 全局忽略：只有 ignores 的配置对象
  if (configs.some((config) => isGlobalIgnore(config) && (config.ignores ?? []).some((pattern) => matchGlob(pattern, path)))) return null;

  // 2. 这个文件需要被检查吗？
  const linted =
    DEFAULT_FILES.some((pattern) => matchGlob(pattern, path)) ||
    configs.some((config) => applies(config, path) && (config.files ?? []).some((pattern) => !UNIVERSAL.test(pattern) && matchGlob(pattern, path)));
  if (!linted) return null;

  // 3. 按顺序合并适用的配置对象：只写严重程度时，保留之前的选项
  const rules: ResolvedRules = {};
  for (const config of configs) {
    if (!applies(config, path)) continue;
    for (const [name, entry] of Object.entries(config.rules ?? {})) {
      const [severity, ...options] = Array.isArray(entry) ? entry : [entry];
      const previous = rules[name]?.slice(1) ?? [];
      rules[name] = [level(severity), ...(options.length > 0 ? options : previous)];
    }
  }
  return rules;
}
```
:::

:::variant{kind=wrong name=universal-patterns-lint fails=tests reason="通用的模式（src/**、**/*）也让文件需要被检查了：src/notes.md 和 README.md 不应该被检查"}
```ts file=flat-config.ts
export type Severity = 'off' | 'warn' | 'error' | 0 | 1 | 2;
export type RuleEntry = Severity | [Severity, ...unknown[]];
export type ConfigObject = { files?: string[]; ignores?: string[]; rules?: Record<string, RuleEntry> };
/** 合并后的规则：严重程度统一成数字，后面是选项 */
export type ResolvedRules = Record<string, [0 | 1 | 2, ...unknown[]]>;

function escape(text: string): string {
  return text.replace(/[.+^${}()|[\]\\]/g, '\\$&');
}

/** 一段（不含 /）中的 *、?、{a,b} */
function segmentSource(segment: string): string {
  let source = '';
  for (let i = 0; i < segment.length; i++) {
    const char = segment.charAt(i);
    const close = char === '{' ? segment.indexOf('}', i) : -1;
    if (char === '*') source += '[^/]*';
    else if (char === '?') source += '[^/]';
    else if (close !== -1) {
      source += `(?:${segment.slice(i + 1, close).split(',').map(escape).join('|')})`;
      i = close;
    } else source += escape(char);
  }
  return source;
}

export function matchGlob(pattern: string, path: string): boolean {
  const segments = pattern.split('/');
  let source = '';
  segments.forEach((segment, i) => {
    const last = i === segments.length - 1;
    if (segment === '**') source += last ? '.*' : '(?:[^/]+/)*';
    else source += segmentSource(segment) + (last ? '' : '/');
  });
  return new RegExp(`^${source}$`).test(path);
}

const DEFAULT_FILES = ['**/*.js', '**/*.mjs', '**/*.cjs'];
/** 这些模式只决定配置是否适用，不会让一个文件“需要被检查”（与 ESLint 源代码中的规则相同） */
const UNIVERSAL = /^\*$|^!|\/\*{1,2}$/;
const LEVELS = { off: 0, warn: 1, error: 2 } as const;

const isGlobalIgnore = (config: ConfigObject) => config.ignores !== undefined && config.files === undefined && config.rules === undefined;

function applies(config: ConfigObject, path: string): boolean {
  if (isGlobalIgnore(config)) return false;
  if (config.files !== undefined && !config.files.some((pattern) => matchGlob(pattern, path))) return false;
  return !(config.ignores ?? []).some((pattern) => matchGlob(pattern, path));
}

function level(severity: Severity): 0 | 1 | 2 {
  return typeof severity === 'number' ? severity : LEVELS[severity];
}

export function computeConfig(configs: readonly ConfigObject[], path: string): ResolvedRules | null {
  // 1. 全局忽略：只有 ignores 的配置对象
  if (configs.some((config) => isGlobalIgnore(config) && (config.ignores ?? []).some((pattern) => matchGlob(pattern, path)))) return null;

  // 2. 这个文件需要被检查吗？
  const linted =
    DEFAULT_FILES.some((pattern) => matchGlob(pattern, path)) ||
    configs.some((config) => applies(config, path) && (config.files ?? []).some((pattern) => matchGlob(pattern, path)));
  if (!linted) return null;

  // 3. 按顺序合并适用的配置对象：只写严重程度时，保留之前的选项
  const rules: ResolvedRules = {};
  for (const config of configs) {
    if (!applies(config, path)) continue;
    for (const [name, entry] of Object.entries(config.rules ?? {})) {
      const [severity, ...options] = Array.isArray(entry) ? entry : [entry];
      const previous = rules[name]?.slice(1) ?? [];
      rules[name] = [level(severity), ...(options.length > 0 ? options : previous)];
    }
  }
  return rules;
}
```
:::

:::variant{kind=wrong name=string-severity fails=tests reason="没有把严重程度统一成数字：输出中出现了 ‘warn’、‘error’"}
```ts file=flat-config.ts
export type Severity = 'off' | 'warn' | 'error' | 0 | 1 | 2;
export type RuleEntry = Severity | [Severity, ...unknown[]];
export type ConfigObject = { files?: string[]; ignores?: string[]; rules?: Record<string, RuleEntry> };
/** 合并后的规则：严重程度统一成数字，后面是选项 */
export type ResolvedRules = Record<string, [0 | 1 | 2, ...unknown[]]>;

function escape(text: string): string {
  return text.replace(/[.+^${}()|[\]\\]/g, '\\$&');
}

/** 一段（不含 /）中的 *、?、{a,b} */
function segmentSource(segment: string): string {
  let source = '';
  for (let i = 0; i < segment.length; i++) {
    const char = segment.charAt(i);
    const close = char === '{' ? segment.indexOf('}', i) : -1;
    if (char === '*') source += '[^/]*';
    else if (char === '?') source += '[^/]';
    else if (close !== -1) {
      source += `(?:${segment.slice(i + 1, close).split(',').map(escape).join('|')})`;
      i = close;
    } else source += escape(char);
  }
  return source;
}

export function matchGlob(pattern: string, path: string): boolean {
  const segments = pattern.split('/');
  let source = '';
  segments.forEach((segment, i) => {
    const last = i === segments.length - 1;
    if (segment === '**') source += last ? '.*' : '(?:[^/]+/)*';
    else source += segmentSource(segment) + (last ? '' : '/');
  });
  return new RegExp(`^${source}$`).test(path);
}

const DEFAULT_FILES = ['**/*.js', '**/*.mjs', '**/*.cjs'];
/** 这些模式只决定配置是否适用，不会让一个文件“需要被检查”（与 ESLint 源代码中的规则相同） */
const UNIVERSAL = /^\*$|^!|\/\*{1,2}$/;
const LEVELS = { off: 0, warn: 1, error: 2 } as const;

const isGlobalIgnore = (config: ConfigObject) => config.ignores !== undefined && config.files === undefined && config.rules === undefined;

function applies(config: ConfigObject, path: string): boolean {
  if (isGlobalIgnore(config)) return false;
  if (config.files !== undefined && !config.files.some((pattern) => matchGlob(pattern, path))) return false;
  return !(config.ignores ?? []).some((pattern) => matchGlob(pattern, path));
}

function level(severity: Severity): 0 | 1 | 2 {
  // 原样复制一份：'warn' 仍然是 'warn'
  return JSON.parse(JSON.stringify(severity));
}

export function computeConfig(configs: readonly ConfigObject[], path: string): ResolvedRules | null {
  // 1. 全局忽略：只有 ignores 的配置对象
  if (configs.some((config) => isGlobalIgnore(config) && (config.ignores ?? []).some((pattern) => matchGlob(pattern, path)))) return null;

  // 2. 这个文件需要被检查吗？
  const linted =
    DEFAULT_FILES.some((pattern) => matchGlob(pattern, path)) ||
    configs.some((config) => applies(config, path) && (config.files ?? []).some((pattern) => !UNIVERSAL.test(pattern) && matchGlob(pattern, path)));
  if (!linted) return null;

  // 3. 按顺序合并适用的配置对象：只写严重程度时，保留之前的选项
  const rules: ResolvedRules = {};
  for (const config of configs) {
    if (!applies(config, path)) continue;
    for (const [name, entry] of Object.entries(config.rules ?? {})) {
      const [severity, ...options] = Array.isArray(entry) ? entry : [entry];
      const previous = rules[name]?.slice(1) ?? [];
      rules[name] = [level(severity), ...(options.length > 0 ? options : previous)];
    }
  }
  return rules;
}
```
:::
