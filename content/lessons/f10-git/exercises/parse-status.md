---
kind: task
title: 解析 git status 的输出
---
编辑器和图形界面的 Git 工具，都是先运行 `git status --porcelain`（格式稳定、给程序读的版本），再解析它的输出。在 `status.ts` 中实现：

**`unquote(field)`**：路径以 `"` 开头时，它是 C 语言风格的字符串：去掉两端的引号，还原转义。`\"`、`\\`、`\t`、`\n`、`\r`、`\a`、`\b`、`\f`、`\v` 是对应的字符；`\` 后面跟三个八进制数字是**一个字节**，连续的几个字节按 UTF-8 解码（`\346\227\247` 是“旧”）。其他的字符按 UTF-8 编码成字节。不以 `"` 开头的路径原样返回。

**`parseStatus(output)`**：每行（忽略空行）的前两个字符是状态码，第三个是空格，之后是路径：

- `??` 是未跟踪的文件，`!!` 是被忽略的文件；
- `DD`、`AU`、`UD`、`UA`、`DU`、`AA`、`UU` 是合并冲突，`code` 保存这两个字符；
- 其他情况：第一个字符是**暂存区**的状态，第二个是**工作区**的状态。空格表示没有变化（`null`），`M` 修改、`T` 类型变化、`A` 新增、`D` 删除、`R` 改名、`C` 复制；其他字符抛出 `Error`；
- 有 `R` 或 `C` 时，路径部分是 `原路径 -> 新路径`，`path` 是新路径，`from` 是原路径；否则 `from` 是 `null`。含有空格的路径一定带引号，所以引号外的第一个 ` -> ` 就是分隔符；
- 所有的路径都经过 `unquote`。

测试中带有“Git 2.45 的实际输出”的例子，都是在本机真实运行 Git 得到的。

:::files{role=starter}
```ts file=status.ts
export type Change = 'modified' | 'type-changed' | 'added' | 'deleted' | 'renamed' | 'copied';

export type StatusEntry =
  | { kind: 'tracked'; path: string; from: string | null; staged: Change | null; unstaged: Change | null }
  | { kind: 'untracked'; path: string }
  | { kind: 'ignored'; path: string }
  | { kind: 'conflict'; path: string; code: string };

/** 去掉引号并还原转义；没有引号的路径原样返回 */
export function unquote(field: string): string {
  return field;
}

export function parseStatus(output: string): StatusEntry[] {
  return output
    .split('\n')
    .filter((line) => line !== '')
    .map((line) => ({ kind: 'untracked', path: line.slice(3) }));
}
```
```ts file=main.ts
import { parseStatus } from './status';

const output = [
  'M  a.txt',
  ' M b.txt',
  'MM c.txt',
  'R  old-name.txt -> new-name.txt',
  '?? logs/',
  'UU README.md',
  'A  "\\350\\257\\264\\346\\230\\216.md"',
  '',
].join('\n');

for (const entry of parseStatus(output)) console.log(entry);
```
:::

:::files{role=solution}
```ts file=status.ts
export type Change = 'modified' | 'type-changed' | 'added' | 'deleted' | 'renamed' | 'copied';

export type StatusEntry =
  | { kind: 'tracked'; path: string; from: string | null; staged: Change | null; unstaged: Change | null }
  | { kind: 'untracked'; path: string }
  | { kind: 'ignored'; path: string }
  | { kind: 'conflict'; path: string; code: string };

const LETTERS: Record<string, Change | null> = {
  ' ': null,
  M: 'modified',
  T: 'type-changed',
  A: 'added',
  D: 'deleted',
  R: 'renamed',
  C: 'copied',
};
const CONFLICTS = new Set(['DD', 'AU', 'UD', 'UA', 'DU', 'AA', 'UU']);
const SIMPLE_ESCAPES: Record<string, number> = { a: 7, b: 8, t: 9, n: 10, v: 11, f: 12, r: 13, '"': 34, '\\': 92 };

/** 去掉引号并还原转义；没有引号的路径原样返回 */
export function unquote(field: string): string {
  if (!field.startsWith('"')) return field;
  // 先还原成字节，再按 UTF-8 解码：一个汉字是三个 \ooo
  const bytes: number[] = [];
  for (let i = 1; i < field.length - 1; i++) {
    const char = field.charAt(i);
    if (char !== '\\') {
      bytes.push(...new TextEncoder().encode(char));
      continue;
    }
    const next = field.charAt(i + 1);
    const octal = /^[0-7]{3}/.exec(field.slice(i + 1));
    if (octal) {
      bytes.push(Number.parseInt(octal[0], 8));
      i += 3;
    } else if (next in SIMPLE_ESCAPES) {
      bytes.push(SIMPLE_ESCAPES[next] ?? 0);
      i += 1;
    } else {
      throw new Error(`无法识别的转义：\\${next}`);
    }
  }
  return new TextDecoder().decode(new Uint8Array(bytes));
}

/** 改名的那一行：“原路径 -> 新路径”。含有空格的路径一定带引号，所以第一个引号外的 " -> " 就是分隔符 */
function splitRename(rest: string): [from: string, to: string] {
  let end = 0;
  if (rest.startsWith('"')) {
    end = 1;
    while (end < rest.length && rest.charAt(end) !== '"') end += rest.charAt(end) === '\\' ? 2 : 1;
    end += 1;
  } else {
    end = rest.indexOf(' -> ');
  }
  if (end <= 0 || !rest.startsWith(' -> ', end)) throw new Error(`无法解析改名：${rest}`);
  return [rest.slice(0, end), rest.slice(end + 4)];
}

function change(letter: string): Change | null {
  const value = LETTERS[letter];
  if (value === undefined) throw new Error(`未知的状态：${letter}`);
  return value;
}

export function parseStatus(output: string): StatusEntry[] {
  return output
    .split('\n')
    .filter((line) => line !== '')
    .map((line): StatusEntry => {
      const code = line.slice(0, 2);
      const rest = line.slice(3);
      if (code === '??') return { kind: 'untracked', path: unquote(rest) };
      if (code === '!!') return { kind: 'ignored', path: unquote(rest) };
      if (CONFLICTS.has(code)) return { kind: 'conflict', path: unquote(rest), code };
      const staged = change(code.charAt(0));
      const unstaged = change(code.charAt(1));
      if (staged === 'renamed' || staged === 'copied' || unstaged === 'renamed' || unstaged === 'copied') {
        const [from, to] = splitRename(rest);
        return { kind: 'tracked', path: unquote(to), from: unquote(from), staged, unstaged };
      }
      return { kind: 'tracked', path: unquote(rest), from: null, staged, unstaged };
    });
}
```
```ts file=main.ts
import { parseStatus } from './status';

const output = [
  'M  a.txt',
  ' M b.txt',
  'MM c.txt',
  'R  old-name.txt -> new-name.txt',
  '?? logs/',
  'UU README.md',
  'A  "\\350\\257\\264\\346\\230\\216.md"',
  '',
].join('\n');

for (const entry of parseStatus(output)) console.log(entry);
```
:::

:::files{role=tests}
```ts file=status.test.ts
import { describe, expect, test } from 'vitest';
import { parseStatus, unquote } from './status';

describe('unquote', () => {
  test('没有引号的路径原样返回', () => {
    expect(unquote('src/main.ts')).toBe('src/main.ts');
    expect(unquote('旧.txt')).toBe('旧.txt');
  });

  test('八进制的 UTF-8 字节（Git 2.45 的实际输出）', () => {
    expect(unquote('"\\346\\227\\247.txt"')).toBe('旧.txt');
    expect(unquote('"\\346\\226\\260 \\346\\226\\207\\344\\273\\266.txt"')).toBe('新 文件.txt');
    expect(unquote('"\\350\\257\\264\\346\\230\\216.md"')).toBe('说明.md');
  });

  test('其他转义', () => {
    expect(unquote('"a b.txt"')).toBe('a b.txt');
    expect(unquote('"tab\\there.txt"')).toBe('tab\there.txt');
    expect(unquote('"quote\\"d.txt"')).toBe('quote"d.txt');
    expect(unquote('"back\\\\slash.txt"')).toBe('back\\slash.txt');
    expect(unquote('"line\\nbreak"')).toBe('line\nbreak');
  });
});

describe('parseStatus', () => {
  test('暂存区与工作区的状态（Git 2.45 的实际输出）', () => {
    const output = ['M  a.txt', ' M b.txt', 'MM c.txt', 'D  d.txt', 'A  new.txt', ''].join('\n');
    expect(parseStatus(output)).toEqual([
      { kind: 'tracked', path: 'a.txt', from: null, staged: 'modified', unstaged: null },
      { kind: 'tracked', path: 'b.txt', from: null, staged: null, unstaged: 'modified' },
      { kind: 'tracked', path: 'c.txt', from: null, staged: 'modified', unstaged: 'modified' },
      { kind: 'tracked', path: 'd.txt', from: null, staged: 'deleted', unstaged: null },
      { kind: 'tracked', path: 'new.txt', from: null, staged: 'added', unstaged: null },
    ]);
  });

  test('改名、类型变化、新增后又在工作区删除', () => {
    expect(parseStatus('R  old-name.txt -> new-name.txt\n T run.sh\nAD tmp.txt\n')).toEqual([
      { kind: 'tracked', path: 'new-name.txt', from: 'old-name.txt', staged: 'renamed', unstaged: null },
      { kind: 'tracked', path: 'run.sh', from: null, staged: null, unstaged: 'type-changed' },
      { kind: 'tracked', path: 'tmp.txt', from: null, staged: 'added', unstaged: 'deleted' },
    ]);
  });

  test('带引号的改名（Git 2.45 的实际输出）', () => {
    expect(parseStatus('R  "\\346\\227\\247.txt" -> "\\346\\226\\260 \\346\\226\\207\\344\\273\\266.txt"\n')).toEqual([
      { kind: 'tracked', path: '新 文件.txt', from: '旧.txt', staged: 'renamed', unstaged: null },
    ]);
    // core.quotepath=false 时：没有空格的中文名不带引号
    expect(parseStatus('R  旧.txt -> "新 文件.txt"\n')).toEqual([
      { kind: 'tracked', path: '新 文件.txt', from: '旧.txt', staged: 'renamed', unstaged: null },
    ]);
    // 原路径中也有空格
    expect(parseStatus('R  "a b.txt" -> "c d.txt"\n')).toEqual([
      { kind: 'tracked', path: 'c d.txt', from: 'a b.txt', staged: 'renamed', unstaged: null },
    ]);
  });

  test('未跟踪、忽略、冲突', () => {
    expect(parseStatus('?? logs/\n?? "a b.txt"\n!! dist/\nUU README.md\nAA both-added.ts\n')).toEqual([
      { kind: 'untracked', path: 'logs/' },
      { kind: 'untracked', path: 'a b.txt' },
      { kind: 'ignored', path: 'dist/' },
      { kind: 'conflict', path: 'README.md', code: 'UU' },
      { kind: 'conflict', path: 'both-added.ts', code: 'AA' },
    ]);
  });

  test('没有任何修改时是空数组；未知的状态抛出错误', () => {
    expect(parseStatus('')).toEqual([]);
    expect(() => parseStatus('XY weird.txt\n')).toThrow();
  });
});
```
:::

:::hint{level=1}
`unquote`：先把转义还原成**字节**放进一个数组，最后用 `new TextDecoder().decode(new Uint8Array(bytes))` 一次解码。普通字符用 `new TextEncoder().encode(char)` 得到它的字节。八进制用 `Number.parseInt('346', 8)`。
:::

:::hint{level=2}
`parseStatus`：不要 `trim` 每一行，开头的空格是状态码的一部分。`line.slice(0, 2)` 是状态码，`line.slice(3)` 是路径部分。改名的路径部分：如果以 `"` 开头，向后找到不在 `\` 之后的那个 `"`，它后面应该是 ` -> `；不带引号时，路径中没有空格，直接 `indexOf(' -> ')`。
:::

:::explanation
`git status --porcelain` 是专门为程序准备的格式：Git 保证它在不同版本之间不变，不受语言设置和颜色的影响。（还有 `--porcelain=v2` 和 `-z` 两种更适合解析的格式：v2 给出更多信息，`-z` 用 `\0` 分隔，路径永远不加引号。）

两个细节容易出错：

- **开头的空格**：` M b.txt` 表示“暂存区没有变化，工作区修改了”。先 `trim` 再解析，就把它和 `M  b.txt`（已经暂存）混在一起了。解析固定格式的文本时，空白往往是有意义的；
- **字节与字符**：Git 把路径的 UTF-8 字节逐个写成 `\ooo`。“旧”是三个字节 `346 227 247`，必须先收集所有的字节，再一起解码；把每个字节当成一个字符（`String.fromCharCode(0o346)` 是 `æ`）只会得到乱码。e09 讲过字符串与编码，这里是一个真实的例子。

类型上，`StatusEntry` 是一个可辨识联合：只有 `kind` 为 `'tracked'` 的条目才有 `staged`、`unstaged`、`from`，冲突的条目有 `code`。使用它的代码（例如编辑器中文件旁边的标记）用 `switch (entry.kind)` 就能安全地处理每一种情况。
:::

:::variant{kind=alt name=regex-and-matchall}
```ts file=status.ts
export type Change = 'modified' | 'type-changed' | 'added' | 'deleted' | 'renamed' | 'copied';

export type StatusEntry =
  | { kind: 'tracked'; path: string; from: string | null; staged: Change | null; unstaged: Change | null }
  | { kind: 'untracked'; path: string }
  | { kind: 'ignored'; path: string }
  | { kind: 'conflict'; path: string; code: string };

const CODES = { M: 'modified', T: 'type-changed', A: 'added', D: 'deleted', R: 'renamed', C: 'copied' } as const;

function letterToChange(letter: string): Change | null {
  if (letter === ' ') return null;
  for (const [key, value] of Object.entries(CODES)) if (key === letter) return value;
  throw new Error('未知的状态 ' + letter);
}

export function unquote(field: string): string {
  const match = /^"(.*)"$/s.exec(field);
  if (!match) return field;
  const body = match[1] ?? '';
  const bytes: number[] = [];
  const encoder = new TextEncoder();
  const named: Record<string, string> = { a: '\x07', b: '\b', t: '\t', n: '\n', v: '\v', f: '\f', r: '\r', '"': '"', '\\': '\\' };
  const pattern = /\\([0-7]{3}|.)|([^\\]+)/gs;
  for (const [, escape, text] of body.matchAll(pattern)) {
    if (text !== undefined) bytes.push(...encoder.encode(text));
    else if (escape !== undefined && /^[0-7]{3}$/.test(escape)) bytes.push(parseInt(escape, 8));
    else if (escape !== undefined && escape in named) bytes.push(...encoder.encode(named[escape] ?? ''));
    else throw new Error('无效的转义');
  }
  return new TextDecoder().decode(Uint8Array.from(bytes));
}

const FIELD = String.raw`"(?:[^"\\]|\\.)*"|\S+`;
const RENAME = new RegExp(String.raw`^(${FIELD}) -> (${FIELD})$`);

export function parseStatus(output: string): StatusEntry[] {
  const entries: StatusEntry[] = [];
  for (const line of output.split('\n')) {
    if (line.length === 0) continue;
    const x = line.charAt(0);
    const y = line.charAt(1);
    const rest = line.slice(3);
    if (x === '?' && y === '?') entries.push({ kind: 'untracked', path: unquote(rest) });
    else if (x === '!' && y === '!') entries.push({ kind: 'ignored', path: unquote(rest) });
    else if (x === 'U' || y === 'U' || (x === y && (x === 'A' || x === 'D'))) entries.push({ kind: 'conflict', path: unquote(rest), code: x + y });
    else {
      const staged = letterToChange(x);
      const unstaged = letterToChange(y);
      const rename = 'RC'.includes(x) || 'RC'.includes(y) ? RENAME.exec(rest) : null;
      if (rename) entries.push({ kind: 'tracked', path: unquote(rename[2] ?? ''), from: unquote(rename[1] ?? ''), staged, unstaged });
      else entries.push({ kind: 'tracked', path: unquote(rest), from: null, staged, unstaged });
    }
  }
  return entries;
}
```
:::

:::variant{kind=wrong name=trim-each-line fails=tests reason="先 trim 了每一行：“ M b.txt”开头的空格是状态码的一部分，去掉之后暂存区和工作区就分不清了"}
```ts file=status.ts
export type Change = 'modified' | 'type-changed' | 'added' | 'deleted' | 'renamed' | 'copied';

export type StatusEntry =
  | { kind: 'tracked'; path: string; from: string | null; staged: Change | null; unstaged: Change | null }
  | { kind: 'untracked'; path: string }
  | { kind: 'ignored'; path: string }
  | { kind: 'conflict'; path: string; code: string };

const LETTERS: Record<string, Change | null> = {
  ' ': null,
  M: 'modified',
  T: 'type-changed',
  A: 'added',
  D: 'deleted',
  R: 'renamed',
  C: 'copied',
};
const CONFLICTS = new Set(['DD', 'AU', 'UD', 'UA', 'DU', 'AA', 'UU']);
const SIMPLE_ESCAPES: Record<string, number> = { a: 7, b: 8, t: 9, n: 10, v: 11, f: 12, r: 13, '"': 34, '\\': 92 };

/** 去掉引号并还原转义；没有引号的路径原样返回 */
export function unquote(field: string): string {
  if (!field.startsWith('"')) return field;
  // 先还原成字节，再按 UTF-8 解码：一个汉字是三个 \ooo
  const bytes: number[] = [];
  for (let i = 1; i < field.length - 1; i++) {
    const char = field.charAt(i);
    if (char !== '\\') {
      bytes.push(...new TextEncoder().encode(char));
      continue;
    }
    const next = field.charAt(i + 1);
    const octal = /^[0-7]{3}/.exec(field.slice(i + 1));
    if (octal) {
      bytes.push(Number.parseInt(octal[0], 8));
      i += 3;
    } else if (next in SIMPLE_ESCAPES) {
      bytes.push(SIMPLE_ESCAPES[next] ?? 0);
      i += 1;
    } else {
      throw new Error(`无法识别的转义：\\${next}`);
    }
  }
  return new TextDecoder().decode(new Uint8Array(bytes));
}

/** 改名的那一行：“原路径 -> 新路径”。含有空格的路径一定带引号，所以第一个引号外的 " -> " 就是分隔符 */
function splitRename(rest: string): [from: string, to: string] {
  let end = 0;
  if (rest.startsWith('"')) {
    end = 1;
    while (end < rest.length && rest.charAt(end) !== '"') end += rest.charAt(end) === '\\' ? 2 : 1;
    end += 1;
  } else {
    end = rest.indexOf(' -> ');
  }
  if (end <= 0 || !rest.startsWith(' -> ', end)) throw new Error(`无法解析改名：${rest}`);
  return [rest.slice(0, end), rest.slice(end + 4)];
}

function change(letter: string): Change | null {
  const value = LETTERS[letter];
  if (value === undefined) throw new Error(`未知的状态：${letter}`);
  return value;
}

export function parseStatus(output: string): StatusEntry[] {
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')
    .map((line): StatusEntry => {
      const code = line.slice(0, 2);
      const rest = line.slice(3);
      if (code === '??') return { kind: 'untracked', path: unquote(rest) };
      if (code === '!!') return { kind: 'ignored', path: unquote(rest) };
      if (CONFLICTS.has(code)) return { kind: 'conflict', path: unquote(rest), code };
      const staged = change(code.charAt(0));
      const unstaged = change(code.charAt(1));
      if (staged === 'renamed' || staged === 'copied' || unstaged === 'renamed' || unstaged === 'copied') {
        const [from, to] = splitRename(rest);
        return { kind: 'tracked', path: unquote(to), from: unquote(from), staged, unstaged };
      }
      return { kind: 'tracked', path: unquote(rest), from: null, staged, unstaged };
    });
}
```
:::

:::variant{kind=wrong name=swapped-columns fails=tests reason="把两列弄反了：第一列是暂存区，第二列是工作区"}
```ts file=status.ts
export type Change = 'modified' | 'type-changed' | 'added' | 'deleted' | 'renamed' | 'copied';

export type StatusEntry =
  | { kind: 'tracked'; path: string; from: string | null; staged: Change | null; unstaged: Change | null }
  | { kind: 'untracked'; path: string }
  | { kind: 'ignored'; path: string }
  | { kind: 'conflict'; path: string; code: string };

const LETTERS: Record<string, Change | null> = {
  ' ': null,
  M: 'modified',
  T: 'type-changed',
  A: 'added',
  D: 'deleted',
  R: 'renamed',
  C: 'copied',
};
const CONFLICTS = new Set(['DD', 'AU', 'UD', 'UA', 'DU', 'AA', 'UU']);
const SIMPLE_ESCAPES: Record<string, number> = { a: 7, b: 8, t: 9, n: 10, v: 11, f: 12, r: 13, '"': 34, '\\': 92 };

/** 去掉引号并还原转义；没有引号的路径原样返回 */
export function unquote(field: string): string {
  if (!field.startsWith('"')) return field;
  // 先还原成字节，再按 UTF-8 解码：一个汉字是三个 \ooo
  const bytes: number[] = [];
  for (let i = 1; i < field.length - 1; i++) {
    const char = field.charAt(i);
    if (char !== '\\') {
      bytes.push(...new TextEncoder().encode(char));
      continue;
    }
    const next = field.charAt(i + 1);
    const octal = /^[0-7]{3}/.exec(field.slice(i + 1));
    if (octal) {
      bytes.push(Number.parseInt(octal[0], 8));
      i += 3;
    } else if (next in SIMPLE_ESCAPES) {
      bytes.push(SIMPLE_ESCAPES[next] ?? 0);
      i += 1;
    } else {
      throw new Error(`无法识别的转义：\\${next}`);
    }
  }
  return new TextDecoder().decode(new Uint8Array(bytes));
}

/** 改名的那一行：“原路径 -> 新路径”。含有空格的路径一定带引号，所以第一个引号外的 " -> " 就是分隔符 */
function splitRename(rest: string): [from: string, to: string] {
  let end = 0;
  if (rest.startsWith('"')) {
    end = 1;
    while (end < rest.length && rest.charAt(end) !== '"') end += rest.charAt(end) === '\\' ? 2 : 1;
    end += 1;
  } else {
    end = rest.indexOf(' -> ');
  }
  if (end <= 0 || !rest.startsWith(' -> ', end)) throw new Error(`无法解析改名：${rest}`);
  return [rest.slice(0, end), rest.slice(end + 4)];
}

function change(letter: string): Change | null {
  const value = LETTERS[letter];
  if (value === undefined) throw new Error(`未知的状态：${letter}`);
  return value;
}

export function parseStatus(output: string): StatusEntry[] {
  return output
    .split('\n')
    .filter((line) => line !== '')
    .map((line): StatusEntry => {
      const code = line.slice(0, 2);
      const rest = line.slice(3);
      if (code === '??') return { kind: 'untracked', path: unquote(rest) };
      if (code === '!!') return { kind: 'ignored', path: unquote(rest) };
      if (CONFLICTS.has(code)) return { kind: 'conflict', path: unquote(rest), code };
      const staged = change(code.charAt(1));
      const unstaged = change(code.charAt(0));
      if (staged === 'renamed' || staged === 'copied' || unstaged === 'renamed' || unstaged === 'copied') {
        const [from, to] = splitRename(rest);
        return { kind: 'tracked', path: unquote(to), from: unquote(from), staged, unstaged };
      }
      return { kind: 'tracked', path: unquote(rest), from: null, staged, unstaged };
    });
}
```
:::

:::variant{kind=wrong name=no-unquote fails=tests reason="没有去掉引号、还原转义：中文和带空格的路径都是错的"}
```ts file=status.ts
export type Change = 'modified' | 'type-changed' | 'added' | 'deleted' | 'renamed' | 'copied';

export type StatusEntry =
  | { kind: 'tracked'; path: string; from: string | null; staged: Change | null; unstaged: Change | null }
  | { kind: 'untracked'; path: string }
  | { kind: 'ignored'; path: string }
  | { kind: 'conflict'; path: string; code: string };

const LETTERS: Record<string, Change | null> = {
  ' ': null,
  M: 'modified',
  T: 'type-changed',
  A: 'added',
  D: 'deleted',
  R: 'renamed',
  C: 'copied',
};
const CONFLICTS = new Set(['DD', 'AU', 'UD', 'UA', 'DU', 'AA', 'UU']);
const SIMPLE_ESCAPES: Record<string, number> = { a: 7, b: 8, t: 9, n: 10, v: 11, f: 12, r: 13, '"': 34, '\\': 92 };

/** 去掉引号并还原转义；没有引号的路径原样返回 */
export function unquote(field: string): string {
  return field;
}

export function unusedUnquote(field: string): string {
  if (!field.startsWith('"')) return field;
  // 先还原成字节，再按 UTF-8 解码：一个汉字是三个 \ooo
  const bytes: number[] = [];
  for (let i = 1; i < field.length - 1; i++) {
    const char = field.charAt(i);
    if (char !== '\\') {
      bytes.push(...new TextEncoder().encode(char));
      continue;
    }
    const next = field.charAt(i + 1);
    const octal = /^[0-7]{3}/.exec(field.slice(i + 1));
    if (octal) {
      bytes.push(Number.parseInt(octal[0], 8));
      i += 3;
    } else if (next in SIMPLE_ESCAPES) {
      bytes.push(SIMPLE_ESCAPES[next] ?? 0);
      i += 1;
    } else {
      throw new Error(`无法识别的转义：\\${next}`);
    }
  }
  return new TextDecoder().decode(new Uint8Array(bytes));
}

/** 改名的那一行：“原路径 -> 新路径”。含有空格的路径一定带引号，所以第一个引号外的 " -> " 就是分隔符 */
function splitRename(rest: string): [from: string, to: string] {
  let end = 0;
  if (rest.startsWith('"')) {
    end = 1;
    while (end < rest.length && rest.charAt(end) !== '"') end += rest.charAt(end) === '\\' ? 2 : 1;
    end += 1;
  } else {
    end = rest.indexOf(' -> ');
  }
  if (end <= 0 || !rest.startsWith(' -> ', end)) throw new Error(`无法解析改名：${rest}`);
  return [rest.slice(0, end), rest.slice(end + 4)];
}

function change(letter: string): Change | null {
  const value = LETTERS[letter];
  if (value === undefined) throw new Error(`未知的状态：${letter}`);
  return value;
}

export function parseStatus(output: string): StatusEntry[] {
  return output
    .split('\n')
    .filter((line) => line !== '')
    .map((line): StatusEntry => {
      const code = line.slice(0, 2);
      const rest = line.slice(3);
      if (code === '??') return { kind: 'untracked', path: unquote(rest) };
      if (code === '!!') return { kind: 'ignored', path: unquote(rest) };
      if (CONFLICTS.has(code)) return { kind: 'conflict', path: unquote(rest), code };
      const staged = change(code.charAt(0));
      const unstaged = change(code.charAt(1));
      if (staged === 'renamed' || staged === 'copied' || unstaged === 'renamed' || unstaged === 'copied') {
        const [from, to] = splitRename(rest);
        return { kind: 'tracked', path: unquote(to), from: unquote(from), staged, unstaged };
      }
      return { kind: 'tracked', path: unquote(rest), from: null, staged, unstaged };
    });
}
```
:::

:::variant{kind=wrong name=decode-each-escape fails=tests reason="把每个 \ooo 当成一个字符（String.fromCharCode）：一个汉字的三个字节被拆成了三个乱码"}
```ts file=status.ts
export type Change = 'modified' | 'type-changed' | 'added' | 'deleted' | 'renamed' | 'copied';

export type StatusEntry =
  | { kind: 'tracked'; path: string; from: string | null; staged: Change | null; unstaged: Change | null }
  | { kind: 'untracked'; path: string }
  | { kind: 'ignored'; path: string }
  | { kind: 'conflict'; path: string; code: string };

const LETTERS: Record<string, Change | null> = {
  ' ': null,
  M: 'modified',
  T: 'type-changed',
  A: 'added',
  D: 'deleted',
  R: 'renamed',
  C: 'copied',
};
const CONFLICTS = new Set(['DD', 'AU', 'UD', 'UA', 'DU', 'AA', 'UU']);
const SIMPLE_ESCAPES: Record<string, number> = { a: 7, b: 8, t: 9, n: 10, v: 11, f: 12, r: 13, '"': 34, '\\': 92 };

/** 去掉引号并还原转义；没有引号的路径原样返回 */
export function unquote(field: string): string {
  if (!field.startsWith('"')) return field;
  // 先还原成字节，再按 UTF-8 解码：一个汉字是三个 \ooo
  const bytes: number[] = [];
  for (let i = 1; i < field.length - 1; i++) {
    const char = field.charAt(i);
    if (char !== '\\') {
      bytes.push(...new TextEncoder().encode(char));
      continue;
    }
    const next = field.charAt(i + 1);
    const octal = /^[0-7]{3}/.exec(field.slice(i + 1));
    if (octal) {
      bytes.push(...new TextEncoder().encode(String.fromCharCode(Number.parseInt(octal[0], 8))));
      i += 3;
    } else if (next in SIMPLE_ESCAPES) {
      bytes.push(SIMPLE_ESCAPES[next] ?? 0);
      i += 1;
    } else {
      throw new Error(`无法识别的转义：\\${next}`);
    }
  }
  return new TextDecoder().decode(new Uint8Array(bytes));
}

/** 改名的那一行：“原路径 -> 新路径”。含有空格的路径一定带引号，所以第一个引号外的 " -> " 就是分隔符 */
function splitRename(rest: string): [from: string, to: string] {
  let end = 0;
  if (rest.startsWith('"')) {
    end = 1;
    while (end < rest.length && rest.charAt(end) !== '"') end += rest.charAt(end) === '\\' ? 2 : 1;
    end += 1;
  } else {
    end = rest.indexOf(' -> ');
  }
  if (end <= 0 || !rest.startsWith(' -> ', end)) throw new Error(`无法解析改名：${rest}`);
  return [rest.slice(0, end), rest.slice(end + 4)];
}

function change(letter: string): Change | null {
  const value = LETTERS[letter];
  if (value === undefined) throw new Error(`未知的状态：${letter}`);
  return value;
}

export function parseStatus(output: string): StatusEntry[] {
  return output
    .split('\n')
    .filter((line) => line !== '')
    .map((line): StatusEntry => {
      const code = line.slice(0, 2);
      const rest = line.slice(3);
      if (code === '??') return { kind: 'untracked', path: unquote(rest) };
      if (code === '!!') return { kind: 'ignored', path: unquote(rest) };
      if (CONFLICTS.has(code)) return { kind: 'conflict', path: unquote(rest), code };
      const staged = change(code.charAt(0));
      const unstaged = change(code.charAt(1));
      if (staged === 'renamed' || staged === 'copied' || unstaged === 'renamed' || unstaged === 'copied') {
        const [from, to] = splitRename(rest);
        return { kind: 'tracked', path: unquote(to), from: unquote(from), staged, unstaged };
      }
      return { kind: 'tracked', path: unquote(rest), from: null, staged, unstaged };
    });
}
```
:::

:::variant{kind=wrong name=split-arrow-anywhere fails=tests reason="按第一个 “ -> ” 拆分改名：带引号的旧路径中如果有空格，会被拆错"}
```ts file=status.ts
export type Change = 'modified' | 'type-changed' | 'added' | 'deleted' | 'renamed' | 'copied';

export type StatusEntry =
  | { kind: 'tracked'; path: string; from: string | null; staged: Change | null; unstaged: Change | null }
  | { kind: 'untracked'; path: string }
  | { kind: 'ignored'; path: string }
  | { kind: 'conflict'; path: string; code: string };

const LETTERS: Record<string, Change | null> = {
  ' ': null,
  M: 'modified',
  T: 'type-changed',
  A: 'added',
  D: 'deleted',
  R: 'renamed',
  C: 'copied',
};
const CONFLICTS = new Set(['DD', 'AU', 'UD', 'UA', 'DU', 'AA', 'UU']);
const SIMPLE_ESCAPES: Record<string, number> = { a: 7, b: 8, t: 9, n: 10, v: 11, f: 12, r: 13, '"': 34, '\\': 92 };

/** 去掉引号并还原转义；没有引号的路径原样返回 */
export function unquote(field: string): string {
  if (!field.startsWith('"')) return field;
  // 先还原成字节，再按 UTF-8 解码：一个汉字是三个 \ooo
  const bytes: number[] = [];
  for (let i = 1; i < field.length - 1; i++) {
    const char = field.charAt(i);
    if (char !== '\\') {
      bytes.push(...new TextEncoder().encode(char));
      continue;
    }
    const next = field.charAt(i + 1);
    const octal = /^[0-7]{3}/.exec(field.slice(i + 1));
    if (octal) {
      bytes.push(Number.parseInt(octal[0], 8));
      i += 3;
    } else if (next in SIMPLE_ESCAPES) {
      bytes.push(SIMPLE_ESCAPES[next] ?? 0);
      i += 1;
    } else {
      throw new Error(`无法识别的转义：\\${next}`);
    }
  }
  return new TextDecoder().decode(new Uint8Array(bytes));
}

/** 改名的那一行：“原路径 -> 新路径”。含有空格的路径一定带引号，所以第一个引号外的 " -> " 就是分隔符 */
function splitRename(rest: string): [from: string, to: string] {
  const end = rest.indexOf(' ');
  if (end <= 0 || !rest.startsWith(' -> ', end)) throw new Error(`无法解析改名：${rest}`);
  return [rest.slice(0, end), rest.slice(end + 4)];
}

function change(letter: string): Change | null {
  const value = LETTERS[letter];
  if (value === undefined) throw new Error(`未知的状态：${letter}`);
  return value;
}

export function parseStatus(output: string): StatusEntry[] {
  return output
    .split('\n')
    .filter((line) => line !== '')
    .map((line): StatusEntry => {
      const code = line.slice(0, 2);
      const rest = line.slice(3);
      if (code === '??') return { kind: 'untracked', path: unquote(rest) };
      if (code === '!!') return { kind: 'ignored', path: unquote(rest) };
      if (CONFLICTS.has(code)) return { kind: 'conflict', path: unquote(rest), code };
      const staged = change(code.charAt(0));
      const unstaged = change(code.charAt(1));
      if (staged === 'renamed' || staged === 'copied' || unstaged === 'renamed' || unstaged === 'copied') {
        const [from, to] = splitRename(rest);
        return { kind: 'tracked', path: unquote(to), from: unquote(from), staged, unstaged };
      }
      return { kind: 'tracked', path: unquote(rest), from: null, staged, unstaged };
    });
}
```
:::
