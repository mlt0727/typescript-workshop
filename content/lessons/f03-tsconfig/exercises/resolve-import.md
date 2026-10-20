---
kind: challenge
title: 模拟 TypeScript 的模块解析
---
在 `resolve.ts` 中实现 `resolveImport(from, specifier, files, options)`，模拟 TypeScript 6.0 对**相对导入**的解析，结果与正文表格中实际运行 `tsc` 得到的一致：

- `from` 是导入方文件的路径（例如 `src/main.ts`，以项目根目录为起点，用 `/` 分隔）；
- `specifier` 是说明符，一定以 `./` 或 `../` 开头（不会只是 `./` 或 `../` 本身）；
- `files` 是项目中所有的源文件，只有 `.ts` 和 `.tsx`；
- `options.mode` 是 `'bundler'` 或 `'nodenext'`，`options.allowTsExtensions` 对应同名的编译选项。

**规则**：

1. 从 `from` 所在的文件夹出发，按说明符的每一段移动：`.` 不动，`..` 回到上一级，退到项目根目录之外时返回 2307。说明符以 `/` 结尾表示“一个文件夹”；
2. 说明符的最后一段以 `.ts` 或 `.tsx` 结尾：把扩展名换成 `.ts`、`.tsx` 依次查找。找到了文件、但没有开启 `allowTsExtensions` 时返回 5097（实测 `tsc` 是先找文件再检查扩展名，所以找不到时仍然是 2307）；
3. 以 `.js` 或 `.jsx` 结尾：把扩展名换成 `.ts`、`.tsx` 依次查找（两种模式都一样）；
4. 没有这四种扩展名（或者以 `/` 结尾）时，两种模式不同：
   - `bundler`：依次查找 `路径.ts`、`路径.tsx`、`路径/index.ts`、`路径/index.tsx`（以 `/` 结尾时只找后两个）；
   - `nodenext`：不查找。`路径.ts` 存在时返回 2835，建议在说明符后面加上 `.js`；`路径.tsx` 存在时返回 2835，建议加上 `.jsx`；其他情况（包括以 `/` 结尾）返回 2834；
5. 要查找的文件都不存在时返回 2307。

返回值的类型已经给出：只有 2835 带有 `suggestion`。

:::files{role=starter}
```ts file=resolve.ts
export type Mode = 'bundler' | 'nodenext';
export type ResolveOptions = { mode: Mode; allowTsExtensions: boolean };
export type Resolution =
  | { ok: true; file: string }
  | { ok: false; code: 2307 | 2834 | 5097 }
  | { ok: false; code: 2835; suggestion: string };

export function resolveImport(from: string, specifier: string, files: ReadonlySet<string>, options: ResolveOptions): Resolution {
  const dir = from.slice(0, from.lastIndexOf('/') + 1);
  const file = dir + specifier.slice(2) + '.ts';
  return files.has(file) ? { ok: true, file } : { ok: false, code: 2307 };
}
```
```ts file=main.ts
import { resolveImport, type ResolveOptions } from './resolve';

const files = new Set(['src/main.ts', 'src/util.ts', 'src/view.tsx', 'src/lib/index.ts']);
const bundler: ResolveOptions = { mode: 'bundler', allowTsExtensions: false };
const node: ResolveOptions = { mode: 'nodenext', allowTsExtensions: false };

for (const specifier of ['./util', './util.js', './view', './lib', './util.ts']) {
  console.log(specifier.padEnd(10), resolveImport('src/main.ts', specifier, files, bundler), resolveImport('src/main.ts', specifier, files, node));
}
```
:::

:::files{role=solution}
```ts file=resolve.ts
export type Mode = 'bundler' | 'nodenext';
export type ResolveOptions = { mode: Mode; allowTsExtensions: boolean };
export type Resolution =
  | { ok: true; file: string }
  | { ok: false; code: 2307 | 2834 | 5097 }
  | { ok: false; code: 2835; suggestion: string };

/** 从导入方所在的文件夹出发，按说明符的每一段移动；退到项目根目录之外时返回 null */
function join(from: string, specifier: string): string | null {
  const parts = from.split('/').slice(0, -1);
  for (const segment of specifier.split('/')) {
    if (segment === '' || segment === '.') continue;
    if (segment !== '..') parts.push(segment);
    else if (parts.length === 0) return null;
    else parts.pop();
  }
  return parts.join('/');
}

export function resolveImport(from: string, specifier: string, files: ReadonlySet<string>, options: ResolveOptions): Resolution {
  const target = join(from, specifier);
  if (target === null) return { ok: false, code: 2307 };
  const isDir = specifier.endsWith('/');

  const firstExisting = (candidates: string[]): Resolution => {
    const file = candidates.find((candidate) => files.has(candidate));
    return file === undefined ? { ok: false, code: 2307 } : { ok: true, file };
  };

  const ext = isDir ? null : /\.(ts|tsx|js|jsx)$/.exec(target);
  if (ext !== null) {
    // 写出的扩展名（.js、.jsx 或者 .ts、.tsx）都对应到源文件 .ts、.tsx
    const stem = target.slice(0, ext.index);
    const result = firstExisting([`${stem}.ts`, `${stem}.tsx`]);
    // 找到了文件，才检查写出 .ts、.tsx 是否被允许
    if (result.ok && (ext[1] === 'ts' || ext[1] === 'tsx') && !options.allowTsExtensions) return { ok: false, code: 5097 };
    return result;
  }

  const index = [`${target}/index.ts`, `${target}/index.tsx`];
  if (options.mode === 'bundler') {
    // 打包工具：先补扩展名，再找文件夹中的 index
    return firstExisting(isDir ? index : [`${target}.ts`, `${target}.tsx`, ...index]);
  }
  // nodenext：不补扩展名，也不找 index；能猜到时给出建议
  if (!isDir && files.has(`${target}.ts`)) return { ok: false, code: 2835, suggestion: `${specifier}.js` };
  if (!isDir && files.has(`${target}.tsx`)) return { ok: false, code: 2835, suggestion: `${specifier}.jsx` };
  return { ok: false, code: 2834 };
}
```
```ts file=main.ts
import { resolveImport, type ResolveOptions } from './resolve';

const files = new Set(['src/main.ts', 'src/util.ts', 'src/view.tsx', 'src/lib/index.ts']);
const bundler: ResolveOptions = { mode: 'bundler', allowTsExtensions: false };
const node: ResolveOptions = { mode: 'nodenext', allowTsExtensions: false };

for (const specifier of ['./util', './util.js', './view', './lib', './util.ts']) {
  console.log(specifier.padEnd(10), resolveImport('src/main.ts', specifier, files, bundler), resolveImport('src/main.ts', specifier, files, node));
}
```
:::

:::files{role=tests}
```ts file=resolve.test.ts
import { describe, expect, test } from 'vitest';
import { resolveImport, type ResolveOptions } from './resolve';

const files = new Set([
  'src/main.ts',
  'src/util.ts',
  'src/view.tsx',
  'src/lib/index.ts',
  'src/comp/index.tsx',
  'src/sub/index.ts',
  'src/sub/deep.ts',
]);

const bundler: ResolveOptions = { mode: 'bundler', allowTsExtensions: false };
const bundlerTs: ResolveOptions = { mode: 'bundler', allowTsExtensions: true };
const node: ResolveOptions = { mode: 'nodenext', allowTsExtensions: false };
const nodeTs: ResolveOptions = { mode: 'nodenext', allowTsExtensions: true };

const found = (file: string) => ({ ok: true, file });
const missing = { ok: false, code: 2307 };

describe('两种模式相同的部分', () => {
  test('写出 .js / .jsx 时对应到 .ts / .tsx', () => {
    for (const options of [bundler, node]) {
      expect(resolveImport('src/main.ts', './util.js', files, options)).toEqual(found('src/util.ts'));
      expect(resolveImport('src/main.ts', './view.js', files, options)).toEqual(found('src/view.tsx'));
      expect(resolveImport('src/main.ts', './view.jsx', files, options)).toEqual(found('src/view.tsx'));
      expect(resolveImport('src/main.ts', './lib/index.js', files, options)).toEqual(found('src/lib/index.ts'));
    }
  });

  test('. 和 .. 按文件夹移动', () => {
    for (const options of [bundler, node]) {
      expect(resolveImport('src/sub/deep.ts', '../util.js', files, options)).toEqual(found('src/util.ts'));
      expect(resolveImport('src/main.ts', '../src/util.js', files, options)).toEqual(found('src/util.ts'));
      expect(resolveImport('src/sub/deep.ts', '../sub/./index.js', files, options)).toEqual(found('src/sub/index.ts'));
      expect(resolveImport('src/main.ts', '../../outside.js', files, options)).toEqual(missing);
    }
  });

  test('找不到时是 2307', () => {
    for (const options of [bundler, node]) {
      expect(resolveImport('src/main.ts', './missing.js', files, options)).toEqual(missing);
    }
  });

  test('写出 .ts / .tsx：找到了文件，但没有开启 allowTsExtensions 时是 5097', () => {
    for (const options of [bundler, node]) {
      expect(resolveImport('src/main.ts', './util.ts', files, options)).toEqual({ ok: false, code: 5097 });
      expect(resolveImport('src/main.ts', './view.tsx', files, options)).toEqual({ ok: false, code: 5097 });
      // 找不到文件时仍然是 2307
      expect(resolveImport('src/main.ts', './missing.ts', files, options)).toEqual(missing);
    }
    for (const options of [bundlerTs, nodeTs]) {
      expect(resolveImport('src/main.ts', './util.ts', files, options)).toEqual(found('src/util.ts'));
      expect(resolveImport('src/main.ts', './view.tsx', files, options)).toEqual(found('src/view.tsx'));
      expect(resolveImport('src/main.ts', './util.tsx', files, options)).toEqual(found('src/util.ts'));
      expect(resolveImport('src/main.ts', './view.ts', files, options)).toEqual(found('src/view.tsx'));
      expect(resolveImport('src/main.ts', './missing.ts', files, options)).toEqual(missing);
    }
  });
});

describe('bundler：可以省略扩展名，可以导入文件夹', () => {
  test('省略扩展名', () => {
    expect(resolveImport('src/main.ts', './util', files, bundler)).toEqual(found('src/util.ts'));
    expect(resolveImport('src/main.ts', './view', files, bundler)).toEqual(found('src/view.tsx'));
    expect(resolveImport('src/main.ts', './lib/index', files, bundler)).toEqual(found('src/lib/index.ts'));
    expect(resolveImport('src/sub/deep.ts', '../util', files, bundler)).toEqual(found('src/util.ts'));
    expect(resolveImport('src/main.ts', './missing', files, bundler)).toEqual(missing);
  });

  test('导入文件夹', () => {
    expect(resolveImport('src/main.ts', './lib', files, bundler)).toEqual(found('src/lib/index.ts'));
    expect(resolveImport('src/main.ts', './lib/', files, bundler)).toEqual(found('src/lib/index.ts'));
    expect(resolveImport('src/main.ts', './comp', files, bundler)).toEqual(found('src/comp/index.tsx'));
    expect(resolveImport('src/main.ts', './comp/', files, bundler)).toEqual(found('src/comp/index.tsx'));
  });

  test('同名的文件优先于文件夹', () => {
    const both = new Set([...files, 'src/lib.ts']);
    expect(resolveImport('src/main.ts', './lib', both, bundler)).toEqual(found('src/lib.ts'));
    expect(resolveImport('src/main.ts', './lib/', both, bundler)).toEqual(found('src/lib/index.ts'));
  });
});

describe('nodenext：必须写出扩展名', () => {
  test('省略扩展名：能猜到时是 2835 加上建议', () => {
    expect(resolveImport('src/main.ts', './util', files, node)).toEqual({ ok: false, code: 2835, suggestion: './util.js' });
    expect(resolveImport('src/main.ts', './view', files, node)).toEqual({ ok: false, code: 2835, suggestion: './view.jsx' });
    expect(resolveImport('src/main.ts', './lib/index', files, node)).toEqual({ ok: false, code: 2835, suggestion: './lib/index.js' });
    expect(resolveImport('src/sub/deep.ts', '../util', files, nodeTs)).toEqual({ ok: false, code: 2835, suggestion: '../util.js' });
  });

  test('猜不到（文件夹、不存在的文件）时是 2834', () => {
    for (const specifier of ['./lib', './lib/', './comp', './comp/', './missing']) {
      expect(resolveImport('src/main.ts', specifier, files, node), specifier).toEqual({ ok: false, code: 2834 });
    }
  });

  test('同名的文件存在时给出建议', () => {
    const both = new Set([...files, 'src/lib.ts']);
    expect(resolveImport('src/main.ts', './lib', both, node)).toEqual({ ok: false, code: 2835, suggestion: './lib.js' });
    expect(resolveImport('src/main.ts', './lib.js', both, node)).toEqual(found('src/lib.ts'));
  });
});
```
```ts file=resolve.test-d.ts
import { expectTypeOf } from 'vitest';
import { resolveImport } from './resolve';

const result = resolveImport('src/main.ts', './util', new Set(['src/util.ts']), { mode: 'nodenext', allowTsExtensions: false });
if (!result.ok && result.code === 2835) {
  expectTypeOf(result.suggestion).toEqualTypeOf<string>();
}
if (!result.ok && result.code !== 2835) {
  // @ts-expect-error 只有 2835 才有建议
  console.log(result.suggestion);
}
// @ts-expect-error 只有这两种模式
resolveImport('src/main.ts', './util', new Set(), { mode: 'node10', allowTsExtensions: false });
```
:::

:::hint{level=1}
先写一个 `join(from, specifier)`：`from.split('/')` 去掉最后一项（文件名）得到文件夹的各段，再遍历说明符的每一段，`.` 和空字符串跳过，`..` 用 `pop()`（已经是空数组时返回 `null`），其他的 `push`。然后用正则 `/\.(ts|tsx|js|jsx)$/` 判断扩展名，按规则 2–4 生成“要查找的候选文件”数组，最后用 `find` 找第一个存在的。
:::

:::hint{level=2}
规则 4 中 `nodenext` 的两种错误：2835 表示 TypeScript 猜到了你想导入的文件（`路径.ts` 或 `路径.tsx` 存在），所以能给出建议；2834 表示猜不到，只能提醒“要写扩展名”。导入文件夹在 `nodenext` 中也是 2834，因为 Node.js 的 ES 模块不会去找文件夹中的 `index`。返回 2835 时用对象字面量 `{ ok: false, code: 2835, suggestion }`，TypeScript 会检查只有这种结果带 `suggestion`。
:::

:::explanation
这道题把正文的表格变成了代码。两种模式的分界只在规则 4，也就是**省略了扩展名**的时候：

- 打包工具（`bundler`）在构建时能看到所有文件，可以替你补上扩展名、找到文件夹中的 `index`，所以 TypeScript 按同样宽容的规则检查；
- Node.js 的 ES 模块（`nodenext`）在运行时按写出的路径加载，不会尝试别的可能，所以 TypeScript 要求写出扩展名。2835 中的建议是 `.js` 而不是 `.ts`：`tsc` 不改写导入路径，编译之后 Node.js 找的是 `util.js`。

规则 2、3 说明了另一件事：在 TypeScript 看来，`.js` 和 `.ts` 指向的是同一个源文件。写 `.js` 是“运行时的路径”，写 `.ts` 是“源代码的路径”（需要 `allowImportingTsExtensions`，只用于不经过 `tsc` 输出的场合：打包工具，或者 Node.js 直接运行 `.ts` 文件）。

为什么同名的文件优先于文件夹（`lib.ts` 优先于 `lib/index.ts`）？这与 Node.js 的 CommonJS 和打包工具的传统规则一致：先把说明符当作文件，补扩展名，找不到才当作文件夹。

真实的模块解析还要处理包名（`react`）、`package.json` 中的 `exports`、`.d.ts` 文件、路径别名等，原理相同：给定说明符和规则，生成候选文件，按顺序查找。遇到“找不到模块”时，可以运行 `tsc --traceResolution` 看 TypeScript 依次尝试了哪些文件。
:::

:::variant{kind=alt name=candidates-or-error}
```ts file=resolve.ts
export type Mode = 'bundler' | 'nodenext';
export type ResolveOptions = { mode: Mode; allowTsExtensions: boolean };
export type Resolution =
  | { ok: true; file: string }
  | { ok: false; code: 2307 | 2834 | 5097 }
  | { ok: false; code: 2835; suggestion: string };

type Candidates = string[] | Exclude<Resolution, { ok: true }>;

function normalize(path: string): string | null {
  const out: string[] = [];
  for (const part of path.split('/')) {
    if (part === '..') {
      if (out.pop() === undefined) return null;
    } else if (part !== '.' && part !== '') {
      out.push(part);
    }
  }
  return out.join('/');
}

function candidatesFor(target: string, specifier: string, files: ReadonlySet<string>, options: ResolveOptions): Candidates {
  const dirOnly = specifier.endsWith('/');
  const match = dirOnly ? null : target.match(/^(.*)\.(js|jsx|ts|tsx)$/);
  if (match) {
    const [, stem = ''] = match;
    return [stem + '.ts', stem + '.tsx'];
  }
  if (options.mode === 'nodenext') {
    if (dirOnly) return { ok: false, code: 2834 };
    if (files.has(target + '.ts')) return { ok: false, code: 2835, suggestion: specifier + '.js' };
    if (files.has(target + '.tsx')) return { ok: false, code: 2835, suggestion: specifier + '.jsx' };
    return { ok: false, code: 2834 };
  }
  const asDir = [target + '/index.ts', target + '/index.tsx'];
  return dirOnly ? asDir : [target + '.ts', target + '.tsx', ...asDir];
}

export function resolveImport(from: string, specifier: string, files: ReadonlySet<string>, options: ResolveOptions): Resolution {
  const dir = from.includes('/') ? from.slice(0, from.lastIndexOf('/')) : '';
  const target = normalize(dir === '' ? specifier : `${dir}/${specifier}`);
  if (target === null) return { ok: false, code: 2307 };
  const candidates = candidatesFor(target, specifier, files, options);
  if (!Array.isArray(candidates)) return candidates;
  const file = candidates.find((candidate) => files.has(candidate));
  if (file === undefined) return { ok: false, code: 2307 };
  if (/\.tsx?$/.test(specifier) && !options.allowTsExtensions) return { ok: false, code: 5097 };
  return { ok: true, file };
}
```
:::

:::variant{kind=wrong name=ignore-mode fails=tests reason="没有区分 nodenext：按打包工具的规则省略扩展名、导入文件夹，在 Node.js 中运行时会找不到模块"}
```ts file=resolve.ts
export type Mode = 'bundler' | 'nodenext';
export type ResolveOptions = { mode: Mode; allowTsExtensions: boolean };
export type Resolution =
  | { ok: true; file: string }
  | { ok: false; code: 2307 | 2834 | 5097 }
  | { ok: false; code: 2835; suggestion: string };

/** 从导入方所在的文件夹出发，按说明符的每一段移动；退到项目根目录之外时返回 null */
function join(from: string, specifier: string): string | null {
  const parts = from.split('/').slice(0, -1);
  for (const segment of specifier.split('/')) {
    if (segment === '' || segment === '.') continue;
    if (segment !== '..') parts.push(segment);
    else if (parts.length === 0) return null;
    else parts.pop();
  }
  return parts.join('/');
}

export function resolveImport(from: string, specifier: string, files: ReadonlySet<string>, options: ResolveOptions): Resolution {
  const target = join(from, specifier);
  if (target === null) return { ok: false, code: 2307 };
  const isDir = specifier.endsWith('/');

  const firstExisting = (candidates: string[]): Resolution => {
    const file = candidates.find((candidate) => files.has(candidate));
    return file === undefined ? { ok: false, code: 2307 } : { ok: true, file };
  };

  const ext = isDir ? null : /\.(ts|tsx|js|jsx)$/.exec(target);
  if (ext !== null) {
    // 写出的扩展名（.js、.jsx 或者 .ts、.tsx）都对应到源文件 .ts、.tsx
    const stem = target.slice(0, ext.index);
    const result = firstExisting([`${stem}.ts`, `${stem}.tsx`]);
    // 找到了文件，才检查写出 .ts、.tsx 是否被允许
    if (result.ok && (ext[1] === 'ts' || ext[1] === 'tsx') && !options.allowTsExtensions) return { ok: false, code: 5097 };
    return result;
  }

  const index = [`${target}/index.ts`, `${target}/index.tsx`];
  return firstExisting(isDir ? index : [`${target}.ts`, `${target}.tsx`, ...index]);
}
```
:::

:::variant{kind=wrong name=js-taken-literally fails=tests reason="把 .js 当成真实的文件名去找：源代码中只有 util.ts，./util.js 被报告为找不到"}
```ts file=resolve.ts
export type Mode = 'bundler' | 'nodenext';
export type ResolveOptions = { mode: Mode; allowTsExtensions: boolean };
export type Resolution =
  | { ok: true; file: string }
  | { ok: false; code: 2307 | 2834 | 5097 }
  | { ok: false; code: 2835; suggestion: string };

/** 从导入方所在的文件夹出发，按说明符的每一段移动；退到项目根目录之外时返回 null */
function join(from: string, specifier: string): string | null {
  const parts = from.split('/').slice(0, -1);
  for (const segment of specifier.split('/')) {
    if (segment === '' || segment === '.') continue;
    if (segment !== '..') parts.push(segment);
    else if (parts.length === 0) return null;
    else parts.pop();
  }
  return parts.join('/');
}

export function resolveImport(from: string, specifier: string, files: ReadonlySet<string>, options: ResolveOptions): Resolution {
  const target = join(from, specifier);
  if (target === null) return { ok: false, code: 2307 };
  const isDir = specifier.endsWith('/');

  const firstExisting = (candidates: string[]): Resolution => {
    const file = candidates.find((candidate) => files.has(candidate));
    return file === undefined ? { ok: false, code: 2307 } : { ok: true, file };
  };

  const ext = isDir ? null : /\.(ts|tsx|js|jsx)$/.exec(target);
  if (ext !== null) {
    // 写出的扩展名（.js、.jsx 或者 .ts、.tsx）都对应到源文件 .ts、.tsx
    const stem = target.slice(0, ext.index);
    const result = ext[1] === 'js' || ext[1] === 'jsx' ? firstExisting([target]) : firstExisting([`${stem}.ts`, `${stem}.tsx`]);
    // 找到了文件，才检查写出 .ts、.tsx 是否被允许
    if (result.ok && (ext[1] === 'ts' || ext[1] === 'tsx') && !options.allowTsExtensions) return { ok: false, code: 5097 };
    return result;
  }

  const index = [`${target}/index.ts`, `${target}/index.tsx`];
  if (options.mode === 'bundler') {
    // 打包工具：先补扩展名，再找文件夹中的 index
    return firstExisting(isDir ? index : [`${target}.ts`, `${target}.tsx`, ...index]);
  }
  // nodenext：不补扩展名，也不找 index；能猜到时给出建议
  if (!isDir && files.has(`${target}.ts`)) return { ok: false, code: 2835, suggestion: `${specifier}.js` };
  if (!isDir && files.has(`${target}.tsx`)) return { ok: false, code: 2835, suggestion: `${specifier}.jsx` };
  return { ok: false, code: 2834 };
}
```
:::

:::variant{kind=wrong name=index-first fails=tests reason="先找文件夹中的 index，再补扩展名：lib.ts 和 lib/index.ts 都存在时选错了"}
```ts file=resolve.ts
export type Mode = 'bundler' | 'nodenext';
export type ResolveOptions = { mode: Mode; allowTsExtensions: boolean };
export type Resolution =
  | { ok: true; file: string }
  | { ok: false; code: 2307 | 2834 | 5097 }
  | { ok: false; code: 2835; suggestion: string };

/** 从导入方所在的文件夹出发，按说明符的每一段移动；退到项目根目录之外时返回 null */
function join(from: string, specifier: string): string | null {
  const parts = from.split('/').slice(0, -1);
  for (const segment of specifier.split('/')) {
    if (segment === '' || segment === '.') continue;
    if (segment !== '..') parts.push(segment);
    else if (parts.length === 0) return null;
    else parts.pop();
  }
  return parts.join('/');
}

export function resolveImport(from: string, specifier: string, files: ReadonlySet<string>, options: ResolveOptions): Resolution {
  const target = join(from, specifier);
  if (target === null) return { ok: false, code: 2307 };
  const isDir = specifier.endsWith('/');

  const firstExisting = (candidates: string[]): Resolution => {
    const file = candidates.find((candidate) => files.has(candidate));
    return file === undefined ? { ok: false, code: 2307 } : { ok: true, file };
  };

  const ext = isDir ? null : /\.(ts|tsx|js|jsx)$/.exec(target);
  if (ext !== null) {
    // 写出的扩展名（.js、.jsx 或者 .ts、.tsx）都对应到源文件 .ts、.tsx
    const stem = target.slice(0, ext.index);
    const result = firstExisting([`${stem}.ts`, `${stem}.tsx`]);
    // 找到了文件，才检查写出 .ts、.tsx 是否被允许
    if (result.ok && (ext[1] === 'ts' || ext[1] === 'tsx') && !options.allowTsExtensions) return { ok: false, code: 5097 };
    return result;
  }

  const index = [`${target}/index.ts`, `${target}/index.tsx`];
  if (options.mode === 'bundler') {
    // 打包工具：先补扩展名，再找文件夹中的 index
    return firstExisting(isDir ? index : [...index, `${target}.ts`, `${target}.tsx`]);
  }
  // nodenext：不补扩展名，也不找 index；能猜到时给出建议
  if (!isDir && files.has(`${target}.ts`)) return { ok: false, code: 2835, suggestion: `${specifier}.js` };
  if (!isDir && files.has(`${target}.tsx`)) return { ok: false, code: 2835, suggestion: `${specifier}.jsx` };
  return { ok: false, code: 2834 };
}
```
:::

:::variant{kind=wrong name=ts-extension-always-allowed fails=tests reason="没有检查 allowTsExtensions：写出 .ts 扩展名总是被接受"}
```ts file=resolve.ts
export type Mode = 'bundler' | 'nodenext';
export type ResolveOptions = { mode: Mode; allowTsExtensions: boolean };
export type Resolution =
  | { ok: true; file: string }
  | { ok: false; code: 2307 | 2834 | 5097 }
  | { ok: false; code: 2835; suggestion: string };

/** 从导入方所在的文件夹出发，按说明符的每一段移动；退到项目根目录之外时返回 null */
function join(from: string, specifier: string): string | null {
  const parts = from.split('/').slice(0, -1);
  for (const segment of specifier.split('/')) {
    if (segment === '' || segment === '.') continue;
    if (segment !== '..') parts.push(segment);
    else if (parts.length === 0) return null;
    else parts.pop();
  }
  return parts.join('/');
}

export function resolveImport(from: string, specifier: string, files: ReadonlySet<string>, options: ResolveOptions): Resolution {
  const target = join(from, specifier);
  if (target === null) return { ok: false, code: 2307 };
  const isDir = specifier.endsWith('/');

  const firstExisting = (candidates: string[]): Resolution => {
    const file = candidates.find((candidate) => files.has(candidate));
    return file === undefined ? { ok: false, code: 2307 } : { ok: true, file };
  };

  const ext = isDir ? null : /\.(ts|tsx|js|jsx)$/.exec(target);
  if (ext !== null) {
    // 写出的扩展名（.js、.jsx 或者 .ts、.tsx）都对应到源文件 .ts、.tsx
    const stem = target.slice(0, ext.index);
    const result = firstExisting([`${stem}.ts`, `${stem}.tsx`]);
    // 找到了文件，才检查写出 .ts、.tsx 是否被允许
    return result;
  }

  const index = [`${target}/index.ts`, `${target}/index.tsx`];
  if (options.mode === 'bundler') {
    // 打包工具：先补扩展名，再找文件夹中的 index
    return firstExisting(isDir ? index : [`${target}.ts`, `${target}.tsx`, ...index]);
  }
  // nodenext：不补扩展名，也不找 index；能猜到时给出建议
  if (!isDir && files.has(`${target}.ts`)) return { ok: false, code: 2835, suggestion: `${specifier}.js` };
  if (!isDir && files.has(`${target}.tsx`)) return { ok: false, code: 2835, suggestion: `${specifier}.jsx` };
  return { ok: false, code: 2834 };
}
```
:::

:::variant{kind=wrong name=always-suggest-js fails=tests reason="建议总是加 .js：对应 view.tsx 的建议应该是 ./view.jsx"}
```ts file=resolve.ts
export type Mode = 'bundler' | 'nodenext';
export type ResolveOptions = { mode: Mode; allowTsExtensions: boolean };
export type Resolution =
  | { ok: true; file: string }
  | { ok: false; code: 2307 | 2834 | 5097 }
  | { ok: false; code: 2835; suggestion: string };

/** 从导入方所在的文件夹出发，按说明符的每一段移动；退到项目根目录之外时返回 null */
function join(from: string, specifier: string): string | null {
  const parts = from.split('/').slice(0, -1);
  for (const segment of specifier.split('/')) {
    if (segment === '' || segment === '.') continue;
    if (segment !== '..') parts.push(segment);
    else if (parts.length === 0) return null;
    else parts.pop();
  }
  return parts.join('/');
}

export function resolveImport(from: string, specifier: string, files: ReadonlySet<string>, options: ResolveOptions): Resolution {
  const target = join(from, specifier);
  if (target === null) return { ok: false, code: 2307 };
  const isDir = specifier.endsWith('/');

  const firstExisting = (candidates: string[]): Resolution => {
    const file = candidates.find((candidate) => files.has(candidate));
    return file === undefined ? { ok: false, code: 2307 } : { ok: true, file };
  };

  const ext = isDir ? null : /\.(ts|tsx|js|jsx)$/.exec(target);
  if (ext !== null) {
    // 写出的扩展名（.js、.jsx 或者 .ts、.tsx）都对应到源文件 .ts、.tsx
    const stem = target.slice(0, ext.index);
    const result = firstExisting([`${stem}.ts`, `${stem}.tsx`]);
    // 找到了文件，才检查写出 .ts、.tsx 是否被允许
    if (result.ok && (ext[1] === 'ts' || ext[1] === 'tsx') && !options.allowTsExtensions) return { ok: false, code: 5097 };
    return result;
  }

  const index = [`${target}/index.ts`, `${target}/index.tsx`];
  if (options.mode === 'bundler') {
    // 打包工具：先补扩展名，再找文件夹中的 index
    return firstExisting(isDir ? index : [`${target}.ts`, `${target}.tsx`, ...index]);
  }
  // nodenext：不补扩展名，也不找 index；能猜到时给出建议
  if (!isDir && (files.has(`${target}.ts`) || files.has(`${target}.tsx`))) return { ok: false, code: 2835, suggestion: `${specifier}.js` };
  return { ok: false, code: 2834 };
}
```
:::

:::variant{kind=wrong name=no-dot-segments fails=tests reason="只去掉了开头的 ./，没有处理 ..：../util.js 拼成了 src/sub/../util.js"}
```ts file=resolve.ts
export type Mode = 'bundler' | 'nodenext';
export type ResolveOptions = { mode: Mode; allowTsExtensions: boolean };
export type Resolution =
  | { ok: true; file: string }
  | { ok: false; code: 2307 | 2834 | 5097 }
  | { ok: false; code: 2835; suggestion: string };

/** 从导入方所在的文件夹出发，按说明符的每一段移动；退到项目根目录之外时返回 null */
function join(from: string, specifier: string): string | null {
  const dir = from.slice(0, from.lastIndexOf('/') + 1);
  const rest = specifier.startsWith('./') ? specifier.slice(2) : specifier;
  return (dir + rest).replace(/\/$/, '');
}

export function resolveImport(from: string, specifier: string, files: ReadonlySet<string>, options: ResolveOptions): Resolution {
  const target = join(from, specifier);
  if (target === null) return { ok: false, code: 2307 };
  const isDir = specifier.endsWith('/');

  const firstExisting = (candidates: string[]): Resolution => {
    const file = candidates.find((candidate) => files.has(candidate));
    return file === undefined ? { ok: false, code: 2307 } : { ok: true, file };
  };

  const ext = isDir ? null : /\.(ts|tsx|js|jsx)$/.exec(target);
  if (ext !== null) {
    // 写出的扩展名（.js、.jsx 或者 .ts、.tsx）都对应到源文件 .ts、.tsx
    const stem = target.slice(0, ext.index);
    const result = firstExisting([`${stem}.ts`, `${stem}.tsx`]);
    // 找到了文件，才检查写出 .ts、.tsx 是否被允许
    if (result.ok && (ext[1] === 'ts' || ext[1] === 'tsx') && !options.allowTsExtensions) return { ok: false, code: 5097 };
    return result;
  }

  const index = [`${target}/index.ts`, `${target}/index.tsx`];
  if (options.mode === 'bundler') {
    // 打包工具：先补扩展名，再找文件夹中的 index
    return firstExisting(isDir ? index : [`${target}.ts`, `${target}.tsx`, ...index]);
  }
  // nodenext：不补扩展名，也不找 index；能猜到时给出建议
  if (!isDir && files.has(`${target}.ts`)) return { ok: false, code: 2835, suggestion: `${specifier}.js` };
  if (!isDir && files.has(`${target}.tsx`)) return { ok: false, code: 2835, suggestion: `${specifier}.jsx` };
  return { ok: false, code: 2834 };
}
```
:::
