---
kind: challenge
title: 检查构建产物中泄露的密钥
---
在 CI 中构建之后，扫描 `dist` 中的文件，检查有没有泄露密钥。在 `scan.ts` 中实现 `scanBundle(files, serverEnv)`：`files` 是构建产物（路径 → 文件内容），`serverEnv` 是服务端的环境变量（名字 → 值）。

**已知格式的密钥**（任何文件中、任何位置）：

| `kind` | 格式 |
| --- | --- |
| `'github-token'` | `ghp_` 后面跟 36 个字母或数字 |
| `'aws-access-key'` | `AKIA` 后面跟 16 个大写字母或数字 |
| `'stripe-secret'` | `sk_live_` 或 `sk_test_` 后面跟至少 10 个字母或数字（`pk_` 开头的是可公开的密钥，不报告） |
| `'private-key'` | `-----BEGIN PRIVATE KEY-----`，`BEGIN` 后面也可以有 `RSA ` 或 `EC ` |

前三种的前后都不能紧挨着字母、数字或 `_`（正则中的 `\b`），否则只是一个更长的字符串中的一段。

**服务端环境变量的值**：名字**不以** `VITE_` 开头、并且值至少 8 个字符的变量，它的值出现在构建产物中就是泄露，`kind` 为 `'env-value'`。（`VITE_` 变量本来就是公开的。）

每一处都报告一条 `{ file, line, column, kind, detail }`：`line`、`column` 是匹配开始的位置，都从 1 开始；`detail` 只显示匹配到的文字（`'env-value'` 时是变量的值）的前 4 个字符加上 `…`，`'env-value'` 时写成 `变量名（前 4 个字符…）`。同一处出现多次就报告多次。结果按文件名、行、列排序。

:::files{role=starter}
```ts file=scan.ts
export type FindingKind = 'github-token' | 'aws-access-key' | 'stripe-secret' | 'private-key' | 'env-value';
export type Finding = { file: string; line: number; column: number; kind: FindingKind; detail: string };

export function scanBundle(files: Readonly<Record<string, string>>, serverEnv: Readonly<Record<string, string>>): Finding[] {
  const findings: Finding[] = [];
  for (const [file, text] of Object.entries(files)) {
    if (text.includes('ghp_')) findings.push({ file, line: 1, column: 1, kind: 'github-token', detail: 'ghp_…' });
  }
  return findings;
}
```
```ts file=main.ts
import { scanBundle } from './scan';

// 为了不让这个示例本身包含一个“像真的一样”的令牌，测试数据都是拼接出来的
const token = 'gh' + 'p_' + 'A'.repeat(36);
const files = {
  'assets/index-abc12345.js': `const api = "https://api.example.com";\nconst t = "${token}";\nconst dsn = "db-pass-1234";`,
  'index.html': '<!doctype html><title>OK</title>',
};
console.log(scanBundle(files, { DATABASE_PASSWORD: 'db-pass-1234', VITE_API_BASE: 'https://api.example.com' }));
```
:::

:::files{role=solution}
```ts file=scan.ts
export type FindingKind = 'github-token' | 'aws-access-key' | 'stripe-secret' | 'private-key' | 'env-value';
export type Finding = { file: string; line: number; column: number; kind: FindingKind; detail: string };

const PATTERNS: [FindingKind, RegExp][] = [
  ['github-token', /\bghp_[A-Za-z0-9]{36}\b/g],
  ['aws-access-key', /\bAKIA[0-9A-Z]{16}\b/g],
  ['stripe-secret', /\bsk_(?:live|test)_[0-9A-Za-z]{10,}/g],
  ['private-key', /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/g],
];

/** 只显示前 4 个字符，报告本身不能再泄露一次 */
const mask = (text: string) => `${text.slice(0, 4)}…`;

/** 字符串中第 index 个字符所在的行和列（都从 1 开始） */
function position(text: string, index: number): { line: number; column: number } {
  const before = text.slice(0, index);
  const line = before.split('\n').length;
  return { line, column: index - before.lastIndexOf('\n') };
}

export function scanBundle(files: Readonly<Record<string, string>>, serverEnv: Readonly<Record<string, string>>): Finding[] {
  const findings: Finding[] = [];
  const secrets = Object.entries(serverEnv).filter(([name, value]) => !name.startsWith('VITE_') && value.length >= 8);

  for (const [file, text] of Object.entries(files)) {
    for (const [kind, pattern] of PATTERNS) {
      for (const match of text.matchAll(pattern)) {
        findings.push({ file, ...position(text, match.index), kind, detail: mask(match[0]) });
      }
    }
    for (const [name, value] of secrets) {
      for (let at = text.indexOf(value); at !== -1; at = text.indexOf(value, at + value.length)) {
        findings.push({ file, ...position(text, at), kind: 'env-value', detail: `${name}（${mask(value)}）` });
      }
    }
  }
  return findings.toSorted((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : a.line - b.line || a.column - b.column));
}
```
```ts file=main.ts
import { scanBundle } from './scan';

// 为了不让这个示例本身包含一个“像真的一样”的令牌，测试数据都是拼接出来的
const token = 'gh' + 'p_' + 'A'.repeat(36);
const files = {
  'assets/index-abc12345.js': `const api = "https://api.example.com";\nconst t = "${token}";\nconst dsn = "db-pass-1234";`,
  'index.html': '<!doctype html><title>OK</title>',
};
console.log(scanBundle(files, { DATABASE_PASSWORD: 'db-pass-1234', VITE_API_BASE: 'https://api.example.com' }));
```
:::

:::files{role=tests}
```ts file=scan.test.ts
import { describe, expect, test } from 'vitest';
import { scanBundle } from './scan';

// 测试中的“密钥”都是在运行时拼接出来的，源代码中没有任何像真的一样的令牌
const github = 'gh' + 'p_' + 'aB3'.repeat(12);
const aws = 'AK' + 'IA' + 'ABCDEFGHIJ234567';
const stripe = 'sk' + '_live_' + '4eC39HqLyjWDarjtT1zdp7dc';
const pem = '-----BEGIN ' + 'PRIVATE KEY-----';

describe('已知格式的密钥', () => {
  test('四种格式，位置从 1 开始，详情只显示前 4 个字符', () => {
    const text = `const a = "${github}";\nconst b = "${aws}";\n  const c = "${stripe}";\n${pem}\nMIIE…`;
    expect(scanBundle({ 'app.js': text }, {})).toEqual([
      { file: 'app.js', line: 1, column: 12, kind: 'github-token', detail: 'ghp_…' },
      { file: 'app.js', line: 2, column: 12, kind: 'aws-access-key', detail: 'AKIA…' },
      { file: 'app.js', line: 3, column: 14, kind: 'stripe-secret', detail: 'sk_l…' },
      { file: 'app.js', line: 4, column: 1, kind: 'private-key', detail: '----…' },
    ]);
  });

  test('格式不完整或者是可公开的密钥时不报告', () => {
    const text = [
      'gh' + 'p_' + 'short',
      'AK' + 'IA' + 'abcdefghijklmnop',
      'pk' + '_live_' + '4eC39HqLyjWDarjtT1zdp7dc',
      'sk' + '_live_' + 'short',
      'x' + github,
    ].join('\n');
    expect(scanBundle({ 'app.js': text }, {})).toEqual([]);
  });

  test('同一个文件中出现多次', () => {
    const text = `${github} ${github}`;
    expect(scanBundle({ 'a.js': text }, {}).map((f) => f.column)).toEqual([1, 42]);
  });
});

describe('服务端环境变量的值', () => {
  test('非 VITE_ 变量的值出现在构建产物中', () => {
    const files = { 'assets/index.js': 'const conn = "postgres://user:hunter2-very-long@db/app";' };
    expect(scanBundle(files, { DATABASE_URL: 'postgres://user:hunter2-very-long@db/app', VITE_API_BASE: 'https://api.example.com' })).toEqual([
      { file: 'assets/index.js', line: 1, column: 15, kind: 'env-value', detail: 'DATABASE_URL（post…）' },
    ]);
  });

  test('VITE_ 变量本来就是公开的；太短的值不检查', () => {
    const files = { 'a.js': 'https://api.example.com 1234567 abcdefg' };
    expect(scanBundle(files, { VITE_API_BASE: 'https://api.example.com', PIN: '1234567', SHORT: 'abcdefg' })).toEqual([]);
  });

  test('多个文件：按文件名、行、列排序', () => {
    const secret = 'top-secret-value';
    const files = { 'z.js': `x\n${secret}`, 'a.js': `${secret}${secret}`, 'm.html': '<p>ok</p>' };
    expect(scanBundle(files, { API_SECRET: secret }).map(({ file, line, column }) => [file, line, column])).toEqual([
      ['a.js', 1, 1],
      ['a.js', 1, 17],
      ['z.js', 2, 1],
    ]);
  });
});
```
:::

:::hint{level=1}
用一个数组列出四种格式的正则（都带 `g` 标志），对每个文件用 `text.matchAll(regex)` 找出所有的匹配，`match.index` 是开始的位置。服务端变量的值用 `indexOf` 在循环中查找：`for (let at = text.indexOf(v); at !== -1; at = text.indexOf(v, at + v.length))`。
:::

:::hint{level=2}
把下标换成行和列：`text.slice(0, index)` 中换行的个数加一是行号；列号是 `index - 前面最后一个换行的下标`（没有换行时 `lastIndexOf` 返回 -1，正好得到 `index + 1`）。最后用 `toSorted` 按文件名、行、列排序。
:::

:::explanation
这个检查补上了“规则靠人记”的漏洞：即使有人把私密的变量改成了 `VITE_` 开头，或者在代码中临时写了一个令牌，构建之后的扫描也能在合并之前发现它。GitHub 的 secret scanning 也是这样做的，只是它认识的格式多得多，还会向发放密钥的服务商核实密钥是否有效。

几个设计上的考虑：

- **前缀让密钥可以被识别**：GitHub 在 2021 年把令牌改成 `ghp_` 这样带前缀的格式，一个重要的原因就是让扫描工具能可靠地发现它们，误报很少。没有固定格式的密钥（例如数据库的密码）只能按值检查，所以第二类检查需要知道服务端有哪些变量；
- **报告不能再泄露一次**：检查结果会出现在 CI 的日志、拉取请求的评论中，只显示前几个字符，足够定位，又不会公开完整的值；
- **太短的值不检查**：`8080`、`true` 这样的值到处都是，会产生大量的误报；
- **边界**：没有 `\b` 时，一段更长的、碰巧包含 `ghp_` 的字符串也会被当成令牌。

测试中的令牌都是在运行时拼接出来的，源代码中没有任何“像真的一样”的字符串。这样做是为了不触发代码仓库自己的密钥扫描：一个看起来像真密钥的测试数据，同样会被扫描工具报告。
:::

:::variant{kind=alt name=per-line}
```ts file=scan.ts
export type FindingKind = 'github-token' | 'aws-access-key' | 'stripe-secret' | 'private-key' | 'env-value';
export type Finding = { file: string; line: number; column: number; kind: FindingKind; detail: string };

type Rule = { kind: FindingKind; regex: RegExp };

const RULES: Rule[] = [
  { kind: 'github-token', regex: /(?<![A-Za-z0-9_])ghp_[A-Za-z0-9]{36}(?![A-Za-z0-9_])/g },
  { kind: 'aws-access-key', regex: /(?<![A-Za-z0-9_])AKIA[0-9A-Z]{16}(?![A-Za-z0-9_])/g },
  { kind: 'stripe-secret', regex: /(?<![A-Za-z0-9_])sk_(?:live|test)_[0-9A-Za-z]{10,}/g },
  { kind: 'private-key', regex: /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/g },
];

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function scanBundle(files: Readonly<Record<string, string>>, serverEnv: Readonly<Record<string, string>>): Finding[] {
  const out: Finding[] = [];
  const envRules = Object.entries(serverEnv)
    .filter(([name, value]) => !name.startsWith('VITE_') && value.length >= 8)
    .map(([name, value]) => ({ name, value, regex: new RegExp(escapeRegExp(value), 'g') }));

  for (const file of Object.keys(files).sort()) {
    const lines = (files[file] ?? '').split('\n');
    lines.forEach((lineText, i) => {
      for (const rule of RULES) {
        for (const m of lineText.matchAll(rule.regex)) {
          out.push({ file, line: i + 1, column: m.index + 1, kind: rule.kind, detail: m[0].slice(0, 4) + '…' });
        }
      }
      for (const env of envRules) {
        for (const m of lineText.matchAll(env.regex)) {
          out.push({ file, line: i + 1, column: m.index + 1, kind: 'env-value', detail: `${env.name}（${env.value.slice(0, 4)}…）` });
        }
      }
    });
  }
  return out.sort((a, b) => (a.file === b.file ? a.line - b.line || a.column - b.column : a.file < b.file ? -1 : 1));
}
```
:::

:::variant{kind=wrong name=full-secret-in-report fails=tests reason="报告中写出了完整的密钥：检查结果会出现在 CI 的日志中，等于又泄露了一次"}
```ts file=scan.ts
export type FindingKind = 'github-token' | 'aws-access-key' | 'stripe-secret' | 'private-key' | 'env-value';
export type Finding = { file: string; line: number; column: number; kind: FindingKind; detail: string };

const PATTERNS: [FindingKind, RegExp][] = [
  ['github-token', /\bghp_[A-Za-z0-9]{36}\b/g],
  ['aws-access-key', /\bAKIA[0-9A-Z]{16}\b/g],
  ['stripe-secret', /\bsk_(?:live|test)_[0-9A-Za-z]{10,}/g],
  ['private-key', /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/g],
];

/** 只显示前 4 个字符，报告本身不能再泄露一次 */
const mask = (text: string) => text;

/** 字符串中第 index 个字符所在的行和列（都从 1 开始） */
function position(text: string, index: number): { line: number; column: number } {
  const before = text.slice(0, index);
  const line = before.split('\n').length;
  return { line, column: index - before.lastIndexOf('\n') };
}

export function scanBundle(files: Readonly<Record<string, string>>, serverEnv: Readonly<Record<string, string>>): Finding[] {
  const findings: Finding[] = [];
  const secrets = Object.entries(serverEnv).filter(([name, value]) => !name.startsWith('VITE_') && value.length >= 8);

  for (const [file, text] of Object.entries(files)) {
    for (const [kind, pattern] of PATTERNS) {
      for (const match of text.matchAll(pattern)) {
        findings.push({ file, ...position(text, match.index), kind, detail: mask(match[0]) });
      }
    }
    for (const [name, value] of secrets) {
      for (let at = text.indexOf(value); at !== -1; at = text.indexOf(value, at + value.length)) {
        findings.push({ file, ...position(text, at), kind: 'env-value', detail: `${name}（${mask(value)}）` });
      }
    }
  }
  return findings.toSorted((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : a.line - b.line || a.column - b.column));
}
```
:::

:::variant{kind=wrong name=zero-based-column fails=tests reason="列号从 0 开始：编辑器和 CI 的报告中，行号和列号都从 1 开始"}
```ts file=scan.ts
export type FindingKind = 'github-token' | 'aws-access-key' | 'stripe-secret' | 'private-key' | 'env-value';
export type Finding = { file: string; line: number; column: number; kind: FindingKind; detail: string };

const PATTERNS: [FindingKind, RegExp][] = [
  ['github-token', /\bghp_[A-Za-z0-9]{36}\b/g],
  ['aws-access-key', /\bAKIA[0-9A-Z]{16}\b/g],
  ['stripe-secret', /\bsk_(?:live|test)_[0-9A-Za-z]{10,}/g],
  ['private-key', /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/g],
];

/** 只显示前 4 个字符，报告本身不能再泄露一次 */
const mask = (text: string) => `${text.slice(0, 4)}…`;

/** 字符串中第 index 个字符所在的行和列（都从 1 开始） */
function position(text: string, index: number): { line: number; column: number } {
  const before = text.slice(0, index);
  const line = before.split('\n').length;
  return { line, column: index - before.lastIndexOf('\n') - 1 };
}

export function scanBundle(files: Readonly<Record<string, string>>, serverEnv: Readonly<Record<string, string>>): Finding[] {
  const findings: Finding[] = [];
  const secrets = Object.entries(serverEnv).filter(([name, value]) => !name.startsWith('VITE_') && value.length >= 8);

  for (const [file, text] of Object.entries(files)) {
    for (const [kind, pattern] of PATTERNS) {
      for (const match of text.matchAll(pattern)) {
        findings.push({ file, ...position(text, match.index), kind, detail: mask(match[0]) });
      }
    }
    for (const [name, value] of secrets) {
      for (let at = text.indexOf(value); at !== -1; at = text.indexOf(value, at + value.length)) {
        findings.push({ file, ...position(text, at), kind: 'env-value', detail: `${name}（${mask(value)}）` });
      }
    }
  }
  return findings.toSorted((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : a.line - b.line || a.column - b.column));
}
```
:::

:::variant{kind=wrong name=flags-public-vars fails=tests reason="把 VITE_ 变量的值也当成了泄露：它们本来就是要打包进前端的公开值"}
```ts file=scan.ts
export type FindingKind = 'github-token' | 'aws-access-key' | 'stripe-secret' | 'private-key' | 'env-value';
export type Finding = { file: string; line: number; column: number; kind: FindingKind; detail: string };

const PATTERNS: [FindingKind, RegExp][] = [
  ['github-token', /\bghp_[A-Za-z0-9]{36}\b/g],
  ['aws-access-key', /\bAKIA[0-9A-Z]{16}\b/g],
  ['stripe-secret', /\bsk_(?:live|test)_[0-9A-Za-z]{10,}/g],
  ['private-key', /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/g],
];

/** 只显示前 4 个字符，报告本身不能再泄露一次 */
const mask = (text: string) => `${text.slice(0, 4)}…`;

/** 字符串中第 index 个字符所在的行和列（都从 1 开始） */
function position(text: string, index: number): { line: number; column: number } {
  const before = text.slice(0, index);
  const line = before.split('\n').length;
  return { line, column: index - before.lastIndexOf('\n') };
}

export function scanBundle(files: Readonly<Record<string, string>>, serverEnv: Readonly<Record<string, string>>): Finding[] {
  const findings: Finding[] = [];
  const secrets = Object.entries(serverEnv).filter(([, value]) => value.length >= 8);

  for (const [file, text] of Object.entries(files)) {
    for (const [kind, pattern] of PATTERNS) {
      for (const match of text.matchAll(pattern)) {
        findings.push({ file, ...position(text, match.index), kind, detail: mask(match[0]) });
      }
    }
    for (const [name, value] of secrets) {
      for (let at = text.indexOf(value); at !== -1; at = text.indexOf(value, at + value.length)) {
        findings.push({ file, ...position(text, at), kind: 'env-value', detail: `${name}（${mask(value)}）` });
      }
    }
  }
  return findings.toSorted((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : a.line - b.line || a.column - b.column));
}
```
:::

:::variant{kind=wrong name=first-match-only fails=tests reason="每个文件中每种密钥只找了第一个：同一个令牌出现两次时只报告了一次"}
```ts file=scan.ts
export type FindingKind = 'github-token' | 'aws-access-key' | 'stripe-secret' | 'private-key' | 'env-value';
export type Finding = { file: string; line: number; column: number; kind: FindingKind; detail: string };

const PATTERNS: [FindingKind, RegExp][] = [
  ['github-token', /\bghp_[A-Za-z0-9]{36}\b/g],
  ['aws-access-key', /\bAKIA[0-9A-Z]{16}\b/g],
  ['stripe-secret', /\bsk_(?:live|test)_[0-9A-Za-z]{10,}/g],
  ['private-key', /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/g],
];

/** 只显示前 4 个字符，报告本身不能再泄露一次 */
const mask = (text: string) => `${text.slice(0, 4)}…`;

/** 字符串中第 index 个字符所在的行和列（都从 1 开始） */
function position(text: string, index: number): { line: number; column: number } {
  const before = text.slice(0, index);
  const line = before.split('\n').length;
  return { line, column: index - before.lastIndexOf('\n') };
}

export function scanBundle(files: Readonly<Record<string, string>>, serverEnv: Readonly<Record<string, string>>): Finding[] {
  const findings: Finding[] = [];
  const secrets = Object.entries(serverEnv).filter(([name, value]) => !name.startsWith('VITE_') && value.length >= 8);

  for (const [file, text] of Object.entries(files)) {
    for (const [kind, pattern] of PATTERNS) {
      const match = new RegExp(pattern.source).exec(text);
      if (match) findings.push({ file, ...position(text, match.index), kind, detail: mask(match[0]) });
    }
    for (const [name, value] of secrets) {
      for (let at = text.indexOf(value); at !== -1; at = text.indexOf(value, at + value.length)) {
        findings.push({ file, ...position(text, at), kind: 'env-value', detail: `${name}（${mask(value)}）` });
      }
    }
  }
  return findings.toSorted((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : a.line - b.line || a.column - b.column));
}
```
:::

:::variant{kind=wrong name=no-word-boundary fails=tests reason="没有检查边界：更长的字符串中间的一段（例如 xghp_…）也被当成了令牌"}
```ts file=scan.ts
export type FindingKind = 'github-token' | 'aws-access-key' | 'stripe-secret' | 'private-key' | 'env-value';
export type Finding = { file: string; line: number; column: number; kind: FindingKind; detail: string };

const PATTERNS: [FindingKind, RegExp][] = [
  ['github-token', /ghp_[A-Za-z0-9]{36}/g],
  ['aws-access-key', /\bAKIA[0-9A-Z]{16}\b/g],
  ['stripe-secret', /\bsk_(?:live|test)_[0-9A-Za-z]{10,}/g],
  ['private-key', /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/g],
];

/** 只显示前 4 个字符，报告本身不能再泄露一次 */
const mask = (text: string) => `${text.slice(0, 4)}…`;

/** 字符串中第 index 个字符所在的行和列（都从 1 开始） */
function position(text: string, index: number): { line: number; column: number } {
  const before = text.slice(0, index);
  const line = before.split('\n').length;
  return { line, column: index - before.lastIndexOf('\n') };
}

export function scanBundle(files: Readonly<Record<string, string>>, serverEnv: Readonly<Record<string, string>>): Finding[] {
  const findings: Finding[] = [];
  const secrets = Object.entries(serverEnv).filter(([name, value]) => !name.startsWith('VITE_') && value.length >= 8);

  for (const [file, text] of Object.entries(files)) {
    for (const [kind, pattern] of PATTERNS) {
      for (const match of text.matchAll(pattern)) {
        findings.push({ file, ...position(text, match.index), kind, detail: mask(match[0]) });
      }
    }
    for (const [name, value] of secrets) {
      for (let at = text.indexOf(value); at !== -1; at = text.indexOf(value, at + value.length)) {
        findings.push({ file, ...position(text, at), kind: 'env-value', detail: `${name}（${mask(value)}）` });
      }
    }
  }
  return findings.toSorted((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : a.line - b.line || a.column - b.column));
}
```
:::
