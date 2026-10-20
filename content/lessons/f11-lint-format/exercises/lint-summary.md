---
kind: task
title: 汇总 ESLint 的检查结果
---
`npx eslint src --format json` 输出一个数组，每个文件一项（类型已给出）。在 `summary.ts` 中实现三个函数，格式与 ESLint 默认的 stylish 格式一致：

**`formatMessage(message)`**：`行:列`、类型、信息、规则名，用两个空格连接。类型：`fatal` 为 `true`（解析错误）或者 `severity` 为 2 时是 `error`，否则是 `warning`。信息结尾的句点去掉，除非句点前面是空格（或者整条信息只有一个字符）。`ruleId` 为 `null` 时没有规则名这一部分。（真实的 stylish 格式还会把各列对齐，这里只用两个空格。）

**`summary(results)`**：把所有文件的 `errorCount`、`warningCount` 相加。总数为 0 时返回空数组；否则第一行是 `✖ N problems (E errors, W warnings)`，数量为 1 时用单数（`1 problem`、`1 error`、`1 warning`）。可以自动修复的数量（`fixableErrorCount`、`fixableWarningCount` 之和）大于 0 时，再加一行：两个空格开头，`F errors and G warnings potentially fixable with the` 加上带反引号的 `--fix` 和 `option.`（单复数规则相同）。

**`countByRule(results)`**：每条规则出现的次数，`ruleId` 为 `null` 的记作 `'(无规则)'`。按次数从多到少排列，次数相同时按规则名（用 `<` 比较字符串）排列。

测试使用的是正文中那次 ESLint 实际运行得到的 JSON。

:::files{role=starter}
```ts file=summary.ts
export type LintMessage = {
  ruleId: string | null;
  severity: 1 | 2;
  message: string;
  line: number;
  column: number;
  fatal?: boolean;
};

export type LintResult = {
  filePath: string;
  messages: LintMessage[];
  errorCount: number;
  warningCount: number;
  fixableErrorCount: number;
  fixableWarningCount: number;
};

export function formatMessage(message: LintMessage): string {
  return `${message.line}:${message.column}  ${message.message}`;
}

export function summary(results: readonly LintResult[]): string[] {
  const total = results.reduce((sum, r) => sum + r.messages.length, 0);
  return [`✖ ${total} problems`];
}

export function countByRule(results: readonly LintResult[]): [rule: string, count: number][] {
  return [];
}
```
```ts file=main.ts
import { countByRule, formatMessage, summary, type LintResult } from './summary';

// npx eslint src --format json 的输出（节选，路径已简化）
const results: LintResult[] = [
  {
    filePath: '/project/src/users.ts',
    messages: [
      { ruleId: '@typescript-eslint/no-misused-promises', severity: 2, message: 'Promise returned in function argument where a void return was expected.', line: 10, column: 15 },
      { ruleId: 'prefer-const', severity: 2, message: "'unused' is never reassigned. Use 'const' instead.", line: 18, column: 7 },
    ],
    errorCount: 2,
    warningCount: 0,
    fixableErrorCount: 1,
    fixableWarningCount: 0,
  },
];

for (const result of results) for (const m of result.messages) console.log(formatMessage(m));
console.log(summary(results).join('\n'));
console.log(countByRule(results));
```
:::

:::files{role=solution}
```ts file=summary.ts
export type LintMessage = {
  ruleId: string | null;
  severity: 1 | 2;
  message: string;
  line: number;
  column: number;
  fatal?: boolean;
};

export type LintResult = {
  filePath: string;
  messages: LintMessage[];
  errorCount: number;
  warningCount: number;
  fixableErrorCount: number;
  fixableWarningCount: number;
};

const plural = (word: string, count: number) => `${count} ${count === 1 ? word : `${word}s`}`;

export function formatMessage(message: LintMessage): string {
  const type = message.fatal === true || message.severity === 2 ? 'error' : 'warning';
  // 去掉结尾的句点，除非句点前面是空格（与 ESLint 的 stylish 格式相同）
  const text = message.message.length > 1 && message.message.endsWith('.') && message.message.at(-2) !== ' ' ? message.message.slice(0, -1) : message.message;
  const parts = [`${message.line}:${message.column}`, type, text];
  if (message.ruleId !== null) parts.push(message.ruleId);
  return parts.join('  ');
}

export function summary(results: readonly LintResult[]): string[] {
  let errors = 0;
  let warnings = 0;
  let fixableErrors = 0;
  let fixableWarnings = 0;
  for (const result of results) {
    errors += result.errorCount;
    warnings += result.warningCount;
    fixableErrors += result.fixableErrorCount;
    fixableWarnings += result.fixableWarningCount;
  }
  const total = errors + warnings;
  if (total === 0) return [];
  const lines = [`✖ ${plural('problem', total)} (${plural('error', errors)}, ${plural('warning', warnings)})`];
  if (fixableErrors + fixableWarnings > 0) {
    lines.push(`  ${plural('error', fixableErrors)} and ${plural('warning', fixableWarnings)} potentially fixable with the \`--fix\` option.`);
  }
  return lines;
}

export function countByRule(results: readonly LintResult[]): [rule: string, count: number][] {
  const counts = new Map<string, number>();
  for (const { messages } of results) {
    for (const { ruleId } of messages) {
      const rule = ruleId ?? '(无规则)';
      counts.set(rule, (counts.get(rule) ?? 0) + 1);
    }
  }
  // 次数多的在前；次数相同时按规则名排序
  return [...counts].toSorted(([a, x], [b, y]) => y - x || (a < b ? -1 : a > b ? 1 : 0));
}
```
```ts file=main.ts
import { countByRule, formatMessage, summary, type LintResult } from './summary';

// npx eslint src --format json 的输出（节选，路径已简化）
const results: LintResult[] = [
  {
    filePath: '/project/src/users.ts',
    messages: [
      { ruleId: '@typescript-eslint/no-misused-promises', severity: 2, message: 'Promise returned in function argument where a void return was expected.', line: 10, column: 15 },
      { ruleId: 'prefer-const', severity: 2, message: "'unused' is never reassigned. Use 'const' instead.", line: 18, column: 7 },
    ],
    errorCount: 2,
    warningCount: 0,
    fixableErrorCount: 1,
    fixableWarningCount: 0,
  },
];

for (const result of results) for (const m of result.messages) console.log(formatMessage(m));
console.log(summary(results).join('\n'));
console.log(countByRule(results));
```
:::

:::files{role=tests}
```ts file=summary.test.ts
import { describe, expect, test } from 'vitest';
import { countByRule, formatMessage, summary, type LintResult } from './summary';

// ESLint 10.13 + typescript-eslint 8.72 对正文中 users.ts 的实际 JSON 输出（路径已简化，省略了 endLine 等字段）
const real: LintResult[] = [
  { filePath: '/project/src/messy.ts', messages: [], errorCount: 0, warningCount: 0, fixableErrorCount: 0, fixableWarningCount: 0 },
  {
    filePath: '/project/src/users.ts',
    messages: [
      { ruleId: '@typescript-eslint/no-misused-promises', severity: 2, message: 'Promise returned in function argument where a void return was expected.', line: 10, column: 15 },
      {
        ruleId: '@typescript-eslint/no-floating-promises',
        severity: 2,
        message: 'Promises must be awaited, end with a call to .catch, end with a call to .then with a rejection handler or be explicitly marked as ignored with the `void` operator.',
        line: 17,
        column: 3,
      },
      { ruleId: 'prefer-const', severity: 2, message: "'unused' is never reassigned. Use 'const' instead.", line: 18, column: 7 },
      { ruleId: '@typescript-eslint/no-unused-vars', severity: 2, message: "'unused' is assigned a value but never used.", line: 18, column: 7 },
    ],
    errorCount: 4,
    warningCount: 0,
    fixableErrorCount: 1,
    fixableWarningCount: 0,
  },
];

const result = (partial: Partial<LintResult>): LintResult => ({
  filePath: '/project/a.ts',
  messages: [],
  errorCount: 0,
  warningCount: 0,
  fixableErrorCount: 0,
  fixableWarningCount: 0,
  ...partial,
});

describe('summary：与 ESLint 的 stylish 输出一致', () => {
  test('实际的输出', () => {
    expect(summary(real)).toEqual(['✖ 4 problems (4 errors, 0 warnings)', '  1 error and 0 warnings potentially fixable with the `--fix` option.']);
  });

  test('单数与复数', () => {
    expect(summary([result({ warningCount: 1 })])).toEqual(['✖ 1 problem (0 errors, 1 warning)']);
    expect(summary([result({ errorCount: 1, warningCount: 2, fixableWarningCount: 1 })])).toEqual([
      '✖ 3 problems (1 error, 2 warnings)',
      '  0 errors and 1 warning potentially fixable with the `--fix` option.',
    ]);
  });

  test('多个文件的数量相加；没有问题时什么也不输出', () => {
    expect(summary([result({ errorCount: 2, fixableErrorCount: 2 }), result({ errorCount: 1 })])).toEqual([
      '✖ 3 problems (3 errors, 0 warnings)',
      '  2 errors and 0 warnings potentially fixable with the `--fix` option.',
    ]);
    expect(summary([result({})])).toEqual([]);
    expect(summary([])).toEqual([]);
  });
});

describe('formatMessage', () => {
  test('位置、类型、去掉句点的信息、规则', () => {
    expect(formatMessage({ ruleId: 'prefer-const', severity: 2, message: "'unused' is never reassigned. Use 'const' instead.", line: 18, column: 7 })).toBe(
      "18:7  error  'unused' is never reassigned. Use 'const' instead  prefer-const",
    );
    expect(formatMessage({ ruleId: 'no-console', severity: 1, message: 'Unexpected console statement.', line: 3, column: 1 })).toBe(
      '3:1  warning  Unexpected console statement  no-console',
    );
  });

  test('句点前面是空格时保留；只有一个句点时保留', () => {
    expect(formatMessage({ ruleId: 'x', severity: 1, message: 'Expected value after .', line: 1, column: 1 })).toBe('1:1  warning  Expected value after .  x');
    expect(formatMessage({ ruleId: 'x', severity: 1, message: '.', line: 1, column: 1 })).toBe('1:1  warning  .  x');
  });

  test('解析错误：fatal 总是 error，没有规则名', () => {
    expect(formatMessage({ ruleId: null, severity: 1, fatal: true, message: "Parsing error: ';' expected.", line: 4, column: 9 })).toBe(
      "4:9  error  Parsing error: ';' expected",
    );
  });
});

describe('countByRule', () => {
  test('按次数从多到少，次数相同时按规则名', () => {
    const messages = (rules: (string | null)[]) => rules.map((ruleId) => ({ ruleId, severity: 2 as const, message: 'x', line: 1, column: 1 }));
    expect(
      countByRule([
        result({ messages: messages(['eqeqeq', 'no-console', 'eqeqeq', null]) }),
        result({ messages: messages(['curly', 'no-console', 'eqeqeq']) }),
      ]),
    ).toEqual([
      ['eqeqeq', 3],
      ['no-console', 2],
      ['(无规则)', 1],
      ['curly', 1],
    ]);
  });

  test('实际的输出', () => {
    expect(countByRule(real)).toEqual([
      ['@typescript-eslint/no-floating-promises', 1],
      ['@typescript-eslint/no-misused-promises', 1],
      ['@typescript-eslint/no-unused-vars', 1],
      ['prefer-const', 1],
    ]);
  });
});
```
:::

:::hint{level=1}
`summary`：先用一个循环把四个数量加起来。写一个小函数 `plural(word, count)` 返回 `1 error` 或 `2 errors`，三处都用它。第二行只在可修复的数量大于 0 时才加。模板字符串中要写反引号时用 `\``。
:::

:::hint{level=2}
`formatMessage`：句点的规则写成 `text.endsWith('.') && text.at(-2) !== ' '`（再加上长度大于 1）。`countByRule`：用 `Map` 计数，然后 `toSorted((a, b) => b[1] - a[1] || 名字的比较)`：次数的差为 0 时，`||` 才会用到后面的比较。
:::

:::explanation
ESLint 的格式化器（formatter）就是这样一个函数：输入是检查结果的数组，输出是一段文字。默认的 `stylish` 之外，还可以用 `--format json` 交给别的程序处理（例如在拉取请求中把问题标注在对应的行上），这道题做的就是这种处理。

几个细节都来自 ESLint 的源代码（`lib/cli-engine/formatters/stylish.js`）：

- 数量直接用每个文件的 `errorCount`、`warningCount`，而不是重新数 `messages`：它们由 ESLint 计算，也考虑了 `fatal` 的解析错误；
- 单数和复数：`1 problem`、`2 problems`、`0 errors`。英文中 0 用复数；
- 去掉结尾的句点让输出更紧凑，但 `Expected value after .` 这样以“空格加句点”结尾的信息，句点本身是内容，要保留。

`countByRule` 适合回答“这个项目里最常见的问题是什么”：先修复出现最多的那几条规则，或者讨论是否要调整它们。
:::

:::variant{kind=alt name=destructure-and-filter}
```ts file=summary.ts
export type LintMessage = {
  ruleId: string | null;
  severity: 1 | 2;
  message: string;
  line: number;
  column: number;
  fatal?: boolean;
};

export type LintResult = {
  filePath: string;
  messages: LintMessage[];
  errorCount: number;
  warningCount: number;
  fixableErrorCount: number;
  fixableWarningCount: number;
};

function pluralize(count: number, word: string): string {
  return count === 1 ? `1 ${word}` : `${count} ${word}s`;
}

export function formatMessage({ line, column, severity, fatal, message, ruleId }: LintMessage): string {
  const kind = fatal || severity === 2 ? 'error' : 'warning';
  const text = /[^ ]\.$/.test(message) ? message.replace(/\.$/, '') : message;
  return [`${line}:${column}`, kind, text, ruleId ?? ''].filter((part) => part !== '').join('  ');
}

export function summary(results: readonly LintResult[]): string[] {
  const sum = (key: 'errorCount' | 'warningCount' | 'fixableErrorCount' | 'fixableWarningCount') =>
    results.reduce((total, result) => total + result[key], 0);
  const [e, w, fe, fw] = [sum('errorCount'), sum('warningCount'), sum('fixableErrorCount'), sum('fixableWarningCount')];
  if (e + w === 0) return [];
  const out = [`✖ ${pluralize(e + w, 'problem')} (${pluralize(e, 'error')}, ${pluralize(w, 'warning')})`];
  if (fe > 0 || fw > 0) out.push(`  ${pluralize(fe, 'error')} and ${pluralize(fw, 'warning')} potentially fixable with the ` + '`--fix`' + ' option.');
  return out;
}

export function countByRule(results: readonly LintResult[]): [rule: string, count: number][] {
  const counts: Record<string, number> = {};
  for (const message of results.flatMap((r) => r.messages)) {
    const key = message.ruleId === null ? '(无规则)' : message.ruleId;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1] || (a[0] > b[0] ? 1 : a[0] < b[0] ? -1 : 0));
}
```
:::

:::variant{kind=wrong name=always-plural fails=tests reason="单复数没有区分：1 个问题输出成了“1 problems”"}
```ts file=summary.ts
export type LintMessage = {
  ruleId: string | null;
  severity: 1 | 2;
  message: string;
  line: number;
  column: number;
  fatal?: boolean;
};

export type LintResult = {
  filePath: string;
  messages: LintMessage[];
  errorCount: number;
  warningCount: number;
  fixableErrorCount: number;
  fixableWarningCount: number;
};

const plural = (word: string, count: number) => `${count} ${word}s`;

export function formatMessage(message: LintMessage): string {
  const type = message.fatal === true || message.severity === 2 ? 'error' : 'warning';
  // 去掉结尾的句点，除非句点前面是空格（与 ESLint 的 stylish 格式相同）
  const text = message.message.length > 1 && message.message.endsWith('.') && message.message.at(-2) !== ' ' ? message.message.slice(0, -1) : message.message;
  const parts = [`${message.line}:${message.column}`, type, text];
  if (message.ruleId !== null) parts.push(message.ruleId);
  return parts.join('  ');
}

export function summary(results: readonly LintResult[]): string[] {
  let errors = 0;
  let warnings = 0;
  let fixableErrors = 0;
  let fixableWarnings = 0;
  for (const result of results) {
    errors += result.errorCount;
    warnings += result.warningCount;
    fixableErrors += result.fixableErrorCount;
    fixableWarnings += result.fixableWarningCount;
  }
  const total = errors + warnings;
  if (total === 0) return [];
  const lines = [`✖ ${plural('problem', total)} (${plural('error', errors)}, ${plural('warning', warnings)})`];
  if (fixableErrors + fixableWarnings > 0) {
    lines.push(`  ${plural('error', fixableErrors)} and ${plural('warning', fixableWarnings)} potentially fixable with the \`--fix\` option.`);
  }
  return lines;
}

export function countByRule(results: readonly LintResult[]): [rule: string, count: number][] {
  const counts = new Map<string, number>();
  for (const { messages } of results) {
    for (const { ruleId } of messages) {
      const rule = ruleId ?? '(无规则)';
      counts.set(rule, (counts.get(rule) ?? 0) + 1);
    }
  }
  // 次数多的在前；次数相同时按规则名排序
  return [...counts].toSorted(([a, x], [b, y]) => y - x || (a < b ? -1 : a > b ? 1 : 0));
}
```
:::

:::variant{kind=wrong name=fixable-line-always fails=tests reason="没有可以自动修复的问题时，也输出了“0 errors and 0 warnings potentially fixable”"}
```ts file=summary.ts
export type LintMessage = {
  ruleId: string | null;
  severity: 1 | 2;
  message: string;
  line: number;
  column: number;
  fatal?: boolean;
};

export type LintResult = {
  filePath: string;
  messages: LintMessage[];
  errorCount: number;
  warningCount: number;
  fixableErrorCount: number;
  fixableWarningCount: number;
};

const plural = (word: string, count: number) => `${count} ${count === 1 ? word : `${word}s`}`;

export function formatMessage(message: LintMessage): string {
  const type = message.fatal === true || message.severity === 2 ? 'error' : 'warning';
  // 去掉结尾的句点，除非句点前面是空格（与 ESLint 的 stylish 格式相同）
  const text = message.message.length > 1 && message.message.endsWith('.') && message.message.at(-2) !== ' ' ? message.message.slice(0, -1) : message.message;
  const parts = [`${message.line}:${message.column}`, type, text];
  if (message.ruleId !== null) parts.push(message.ruleId);
  return parts.join('  ');
}

export function summary(results: readonly LintResult[]): string[] {
  let errors = 0;
  let warnings = 0;
  let fixableErrors = 0;
  let fixableWarnings = 0;
  for (const result of results) {
    errors += result.errorCount;
    warnings += result.warningCount;
    fixableErrors += result.fixableErrorCount;
    fixableWarnings += result.fixableWarningCount;
  }
  const total = errors + warnings;
  if (total === 0) return [];
  const lines = [`✖ ${plural('problem', total)} (${plural('error', errors)}, ${plural('warning', warnings)})`];
  {
    lines.push(`  ${plural('error', fixableErrors)} and ${plural('warning', fixableWarnings)} potentially fixable with the \`--fix\` option.`);
  }
  return lines;
}

export function countByRule(results: readonly LintResult[]): [rule: string, count: number][] {
  const counts = new Map<string, number>();
  for (const { messages } of results) {
    for (const { ruleId } of messages) {
      const rule = ruleId ?? '(无规则)';
      counts.set(rule, (counts.get(rule) ?? 0) + 1);
    }
  }
  // 次数多的在前；次数相同时按规则名排序
  return [...counts].toSorted(([a, x], [b, y]) => y - x || (a < b ? -1 : a > b ? 1 : 0));
}
```
:::

:::variant{kind=wrong name=strip-every-period fails=tests reason="去掉了所有结尾的句点：前面是空格的句点是信息的一部分，应该保留"}
```ts file=summary.ts
export type LintMessage = {
  ruleId: string | null;
  severity: 1 | 2;
  message: string;
  line: number;
  column: number;
  fatal?: boolean;
};

export type LintResult = {
  filePath: string;
  messages: LintMessage[];
  errorCount: number;
  warningCount: number;
  fixableErrorCount: number;
  fixableWarningCount: number;
};

const plural = (word: string, count: number) => `${count} ${count === 1 ? word : `${word}s`}`;

export function formatMessage(message: LintMessage): string {
  const type = message.fatal === true || message.severity === 2 ? 'error' : 'warning';
  // 去掉结尾的句点，除非句点前面是空格（与 ESLint 的 stylish 格式相同）
  const text = message.message.replace(/\.$/, '');
  const parts = [`${message.line}:${message.column}`, type, text];
  if (message.ruleId !== null) parts.push(message.ruleId);
  return parts.join('  ');
}

export function summary(results: readonly LintResult[]): string[] {
  let errors = 0;
  let warnings = 0;
  let fixableErrors = 0;
  let fixableWarnings = 0;
  for (const result of results) {
    errors += result.errorCount;
    warnings += result.warningCount;
    fixableErrors += result.fixableErrorCount;
    fixableWarnings += result.fixableWarningCount;
  }
  const total = errors + warnings;
  if (total === 0) return [];
  const lines = [`✖ ${plural('problem', total)} (${plural('error', errors)}, ${plural('warning', warnings)})`];
  if (fixableErrors + fixableWarnings > 0) {
    lines.push(`  ${plural('error', fixableErrors)} and ${plural('warning', fixableWarnings)} potentially fixable with the \`--fix\` option.`);
  }
  return lines;
}

export function countByRule(results: readonly LintResult[]): [rule: string, count: number][] {
  const counts = new Map<string, number>();
  for (const { messages } of results) {
    for (const { ruleId } of messages) {
      const rule = ruleId ?? '(无规则)';
      counts.set(rule, (counts.get(rule) ?? 0) + 1);
    }
  }
  // 次数多的在前；次数相同时按规则名排序
  return [...counts].toSorted(([a, x], [b, y]) => y - x || (a < b ? -1 : a > b ? 1 : 0));
}
```
:::

:::variant{kind=wrong name=fatal-ignored fails=tests reason="没有处理 fatal：解析错误的 severity 可能是 1，但它总是 error"}
```ts file=summary.ts
export type LintMessage = {
  ruleId: string | null;
  severity: 1 | 2;
  message: string;
  line: number;
  column: number;
  fatal?: boolean;
};

export type LintResult = {
  filePath: string;
  messages: LintMessage[];
  errorCount: number;
  warningCount: number;
  fixableErrorCount: number;
  fixableWarningCount: number;
};

const plural = (word: string, count: number) => `${count} ${count === 1 ? word : `${word}s`}`;

export function formatMessage(message: LintMessage): string {
  const type = message.severity === 2 ? 'error' : 'warning';
  // 去掉结尾的句点，除非句点前面是空格（与 ESLint 的 stylish 格式相同）
  const text = message.message.length > 1 && message.message.endsWith('.') && message.message.at(-2) !== ' ' ? message.message.slice(0, -1) : message.message;
  const parts = [`${message.line}:${message.column}`, type, text];
  if (message.ruleId !== null) parts.push(message.ruleId);
  return parts.join('  ');
}

export function summary(results: readonly LintResult[]): string[] {
  let errors = 0;
  let warnings = 0;
  let fixableErrors = 0;
  let fixableWarnings = 0;
  for (const result of results) {
    errors += result.errorCount;
    warnings += result.warningCount;
    fixableErrors += result.fixableErrorCount;
    fixableWarnings += result.fixableWarningCount;
  }
  const total = errors + warnings;
  if (total === 0) return [];
  const lines = [`✖ ${plural('problem', total)} (${plural('error', errors)}, ${plural('warning', warnings)})`];
  if (fixableErrors + fixableWarnings > 0) {
    lines.push(`  ${plural('error', fixableErrors)} and ${plural('warning', fixableWarnings)} potentially fixable with the \`--fix\` option.`);
  }
  return lines;
}

export function countByRule(results: readonly LintResult[]): [rule: string, count: number][] {
  const counts = new Map<string, number>();
  for (const { messages } of results) {
    for (const { ruleId } of messages) {
      const rule = ruleId ?? '(无规则)';
      counts.set(rule, (counts.get(rule) ?? 0) + 1);
    }
  }
  // 次数多的在前；次数相同时按规则名排序
  return [...counts].toSorted(([a, x], [b, y]) => y - x || (a < b ? -1 : a > b ? 1 : 0));
}
```
:::

:::variant{kind=wrong name=count-only-sort fails=tests reason="只按次数排序：次数相同时的顺序取决于出现的顺序，而不是规则名"}
```ts file=summary.ts
export type LintMessage = {
  ruleId: string | null;
  severity: 1 | 2;
  message: string;
  line: number;
  column: number;
  fatal?: boolean;
};

export type LintResult = {
  filePath: string;
  messages: LintMessage[];
  errorCount: number;
  warningCount: number;
  fixableErrorCount: number;
  fixableWarningCount: number;
};

const plural = (word: string, count: number) => `${count} ${count === 1 ? word : `${word}s`}`;

export function formatMessage(message: LintMessage): string {
  const type = message.fatal === true || message.severity === 2 ? 'error' : 'warning';
  // 去掉结尾的句点，除非句点前面是空格（与 ESLint 的 stylish 格式相同）
  const text = message.message.length > 1 && message.message.endsWith('.') && message.message.at(-2) !== ' ' ? message.message.slice(0, -1) : message.message;
  const parts = [`${message.line}:${message.column}`, type, text];
  if (message.ruleId !== null) parts.push(message.ruleId);
  return parts.join('  ');
}

export function summary(results: readonly LintResult[]): string[] {
  let errors = 0;
  let warnings = 0;
  let fixableErrors = 0;
  let fixableWarnings = 0;
  for (const result of results) {
    errors += result.errorCount;
    warnings += result.warningCount;
    fixableErrors += result.fixableErrorCount;
    fixableWarnings += result.fixableWarningCount;
  }
  const total = errors + warnings;
  if (total === 0) return [];
  const lines = [`✖ ${plural('problem', total)} (${plural('error', errors)}, ${plural('warning', warnings)})`];
  if (fixableErrors + fixableWarnings > 0) {
    lines.push(`  ${plural('error', fixableErrors)} and ${plural('warning', fixableWarnings)} potentially fixable with the \`--fix\` option.`);
  }
  return lines;
}

export function countByRule(results: readonly LintResult[]): [rule: string, count: number][] {
  const counts = new Map<string, number>();
  for (const { messages } of results) {
    for (const { ruleId } of messages) {
      const rule = ruleId ?? '(无规则)';
      counts.set(rule, (counts.get(rule) ?? 0) + 1);
    }
  }
  // 次数多的在前；次数相同时按规则名排序
  return [...counts].toSorted(([, x], [, y]) => y - x);
}
```
:::
