---
kind: challenge
title: 实现 .gitignore 的匹配规则
---
在 `gitignore.ts` 中实现 `.gitignore` 规则的一个子集（规则见正文与 Git 的 `gitignore` 文档）。测试中的每一组例子都与 Git 2.45 的实际结果一致。

**`parseGitignore(text)`**：按行解析，返回规则的数组：

1. 去掉行尾的 `\r` 和空格；空行和 `#` 开头的行跳过；
2. `!` 开头：`negate` 为 `true`，去掉 `!`；
3. `/` 结尾：`dirOnly` 为 `true`，去掉这个 `/`；
4. 剩下的部分中有 `/`（开头或中间）：`anchored` 为 `true`，从根目录开始匹配整个路径（去掉开头的 `/`）；否则只匹配路径的最后一段（名字）；
5. `regex` 由剩下的 glob 转换而来，匹配**整个**目标：`*` 匹配除 `/` 以外的任意字符；`?` 匹配一个非 `/` 的字符；`[abc]`、`[a-z]` 匹配其中一个，`[!x]` 表示“不是 x”；一段开头的 `**/` 匹配零层或多层文件夹；结尾的 `/**` 匹配里面的一切；其他位置连续的 `*` 与一个 `*` 相同；其余字符按字面匹配。

**`isIgnored(text, path, isDir = false)`**：`path` 是相对于根目录的路径（用 `/` 分隔），`isDir` 表示它是不是文件夹：

1. 对一个目标，依次检查每条规则（`dirOnly` 的规则只用于文件夹）；**最后一条**匹配的规则决定结果：普通规则是“忽略”，`!` 规则是“不忽略”；没有规则匹配就是“不忽略”；
2. 先从上到下检查 `path` 的每一层父文件夹（`a`、`a/b`……，都当作文件夹）：任何一层被忽略，`path` 就被忽略，`!` 规则也无法把它重新包含；
3. 父文件夹都没有被忽略时，按第 1 条检查 `path` 本身。

:::files{role=starter}
```ts file=gitignore.ts
export type Rule = {
  /** ! 开头：重新包含 */
  negate: boolean;
  /** / 结尾：只匹配文件夹 */
  dirOnly: boolean;
  /** 开头或中间有 /：从根目录开始匹配整个路径；否则只匹配最后一段的名字 */
  anchored: boolean;
  regex: RegExp;
};

export function parseGitignore(text: string): Rule[] {
  return text
    .split('\n')
    .filter((line) => line !== '')
    .map((line) => ({ negate: false, dirOnly: false, anchored: false, regex: new RegExp(line) }));
}

export function isIgnored(text: string, path: string, isDir = false): boolean {
  return parseGitignore(text).some((rule) => rule.regex.test(path));
}
```
```ts file=main.ts
import { isIgnored } from './gitignore';

const gitignore = ['# Vite 项目', 'node_modules', 'dist', '*.local', '.env', '.env.*', '!.env.example', 'logs/*', '!logs/.gitkeep'].join('\n');

for (const path of ['node_modules/vite/package.json', 'src/main.ts', '.env.local', '.env.example', 'logs/app.log', 'logs/.gitkeep']) {
  console.log(path.padEnd(32), isIgnored(gitignore, path) ? '忽略' : '跟踪');
}
```
:::

:::files{role=solution}
```ts file=gitignore.ts
export type Rule = {
  /** ! 开头：重新包含 */
  negate: boolean;
  /** / 结尾：只匹配文件夹 */
  dirOnly: boolean;
  /** 开头或中间有 /：从根目录开始匹配整个路径；否则只匹配最后一段的名字 */
  anchored: boolean;
  regex: RegExp;
};

/** 把一个 glob 转换成正则：* 与 ? 不跨越 /，** 匹配任意层 */
function globToRegExp(glob: string): RegExp {
  let source = '';
  for (let i = 0; i < glob.length; i++) {
    const char = glob.charAt(i);
    if (char === '*') {
      if (glob.charAt(i + 1) === '*') {
        const atSegmentStart = i === 0 || glob.charAt(i - 1) === '/';
        if (atSegmentStart && glob.charAt(i + 2) === '/') {
          source += '(?:.*/)?'; // **/：零层或多层文件夹
          i += 2;
          continue;
        }
        if (atSegmentStart && i + 2 === glob.length) {
          source += '.*'; // 结尾的 /**：里面的一切
          i += 1;
          continue;
        }
        while (glob.charAt(i + 1) === '*') i++; // 其他位置的 ** 与 * 相同
      }
      source += '[^/]*';
    } else if (char === '?') {
      source += '[^/]';
    } else if (char === '[') {
      const end = glob.indexOf(']', i + 2);
      if (end === -1) {
        source += '\\[';
        continue;
      }
      const body = glob.slice(i + 1, end);
      source += `[${body.startsWith('!') ? '^' + body.slice(1) : body}]`;
      i = end;
    } else {
      source += char.replace(/[.+^${}()|\\]/g, '\\$&');
    }
  }
  return new RegExp(`^${source}$`);
}

export function parseGitignore(text: string): Rule[] {
  const rules: Rule[] = [];
  for (const raw of text.split('\n')) {
    let line = raw.replace(/\r$/, '').replace(/ +$/, '');
    if (line === '' || line.startsWith('#')) continue;
    const negate = line.startsWith('!');
    if (negate) line = line.slice(1);
    const dirOnly = line.endsWith('/');
    if (dirOnly) line = line.slice(0, -1);
    const anchored = line.includes('/');
    if (line.startsWith('/')) line = line.slice(1);
    rules.push({ negate, dirOnly, anchored, regex: globToRegExp(line) });
  }
  return rules;
}

/** 后面的规则覆盖前面的：返回最后一条匹配的规则的结论 */
function matches(rules: readonly Rule[], path: string, isDir: boolean): boolean {
  const name = path.slice(path.lastIndexOf('/') + 1);
  let ignored = false;
  for (const rule of rules) {
    if (rule.dirOnly && !isDir) continue;
    if (rule.regex.test(rule.anchored ? path : name)) ignored = !rule.negate;
  }
  return ignored;
}

export function isIgnored(text: string, path: string, isDir = false): boolean {
  const rules = parseGitignore(text);
  const parts = path.split('/');
  // 某一层的文件夹被忽略了，里面的一切都被忽略，无法重新包含
  for (let i = 1; i < parts.length; i++) {
    if (matches(rules, parts.slice(0, i).join('/'), true)) return true;
  }
  return matches(rules, path, isDir);
}
```
```ts file=main.ts
import { isIgnored } from './gitignore';

const gitignore = ['# Vite 项目', 'node_modules', 'dist', '*.local', '.env', '.env.*', '!.env.example', 'logs/*', '!logs/.gitkeep'].join('\n');

for (const path of ['node_modules/vite/package.json', 'src/main.ts', '.env.local', '.env.example', 'logs/app.log', 'logs/.gitkeep']) {
  console.log(path.padEnd(32), isIgnored(gitignore, path) ? '忽略' : '跟踪');
}
```
:::

:::files{role=tests}
```ts file=gitignore.test.ts
import { describe, expect, test } from 'vitest';
import { isIgnored, parseGitignore } from './gitignore';

// 每一组的结果都与 Git 2.45 一致：在临时仓库中写入 .gitignore 和这些文件，用 git ls-files --others --ignored --exclude-standard 得到
const cases: [rules: string, files: [path: string, ignored: boolean][]][] = [
  ['*.log', [['app.log', true], ['logs/app.log', true], ['app.log.txt', false], ['a/b/c.log', true], ['log', false], ['catalog', false]]],
  ['*.log\n!important.log', [['app.log', true], ['important.log', false], ['sub/important.log', false]]],
  ['logs/', [['logs/a.txt', true], ['src/logs/a.txt', true], ['logs.txt', false], ['logsx/a.txt', false]]],
  ['logs/\n!logs/keep.txt', [['logs/keep.txt', true], ['logs/a.txt', true]]],
  ['build/**\n!build/keep.txt', [['build/keep.txt', false], ['build/a.js', true], ['build/sub/a.js', true]]],
  ['/dist', [['dist/a.js', true], ['src/dist/a.js', false], ['dist.txt', false]]],
  ['doc/*.txt', [['doc/a.txt', true], ['doc/sub/a.txt', false], ['x/doc/a.txt', false]]],
  ['**/temp', [['temp/a', true], ['a/temp/b', true], ['a/b/temp/c', true], ['temporary/a', false]]],
  ['a/**/b.txt', [['a/b.txt', true], ['a/x/b.txt', true], ['a/x/y/b.txt', true], ['x/a/b.txt', false]]],
  ['node_modules\n.env\n.env.*\n!.env.example', [['node_modules/react/index.js', true], ['pkg/node_modules/x.js', true], ['.env', true], ['.env.local', true], ['.env.example', false], ['src/.env', true], ['xenv', false]]],
  ['file?.txt', [['file1.txt', true], ['file10.txt', false], ['file.txt', false]]],
  ['doc/a?b.txt', [['doc/axb.txt', true], ['doc/a/b.txt', false]]],
  ['[ab]*.md\n!b*.md', [['a1.md', true], ['b1.md', false], ['c1.md', false]]],
  ['data/[!x]*.csv', [['data/a.csv', true], ['data/x.csv', false]]],
  ['# 注释\n\n*.tmp   \n  ', [['a.tmp', true], ['b.txt', false]]],
  ['src/\n!src/', [['src/a.ts', false]]],
  ['*.js\n!lib/*.js', [['lib/a.js', false], ['lib/sub/a.js', true], ['a.js', true]]],
  ['dir/sub/', [['dir/sub/a', true], ['x/dir/sub/a', false], ['dir/subx/a', false]]],
  ['**/*.snap', [['a.snap', true], ['x/y/a.snap', true]]],
  ['cache/**/', [['cache/a/b.txt', true], ['cache/b.txt', false]]],
];

describe('isIgnored：与真实的 Git 对照', () => {
  test.each(cases)('%j', (rules, files) => {
    for (const [path, ignored] of files) {
      expect(isIgnored(rules, path), `${path} 应该${ignored ? '被忽略' : '被跟踪'}`).toBe(ignored);
    }
  });
});

describe('文件夹', () => {
  test('结尾的 / 只匹配文件夹', () => {
    expect(isIgnored('logs/', 'logs', true)).toBe(true);
    expect(isIgnored('logs/', 'logs', false)).toBe(false);
  });

  test('结尾的 /** 匹配里面的内容，不匹配文件夹本身', () => {
    expect(isIgnored('build/**', 'build', true)).toBe(false);
    expect(isIgnored('build/**', 'build/a.js', false)).toBe(true);
  });
});

describe('parseGitignore', () => {
  test('跳过空行和注释，识别 !、结尾的 /、是否从根目录匹配', () => {
    const rules = parseGitignore('# 注释\n\n!/dist/\n*.log\ndoc/*.md\n');
    expect(rules.map(({ negate, dirOnly, anchored }) => ({ negate, dirOnly, anchored }))).toEqual([
      { negate: true, dirOnly: true, anchored: true },
      { negate: false, dirOnly: false, anchored: false },
      { negate: false, dirOnly: false, anchored: true },
    ]);
  });
});
```
:::

:::hint{level=1}
先写 `globToRegExp(glob)`：逐个字符地把 glob 翻译成正则的源代码。`*` 是 `[^/]*`，`?` 是 `[^/]`，`.`、`+`、`(` 这些正则中的特殊字符要转义；最后加上 `^` 和 `$`。然后是 `parseGitignore`：每行按第 1–4 步去掉前缀和后缀，记下三个标志。
:::

:::hint{level=2}
`**` 只在一段的开头有特殊含义：`**/` 换成 `(?:.*/)?`（可以是零层），结尾的 `**` 换成 `.*`。`isIgnored`：先写一个 `matches(rules, target, isDir)`，遍历所有规则，匹配时把结果设为 `!rule.negate`（后面的覆盖前面的）；再对 `path.split('/')` 的每一层前缀调用它（`isDir` 为 `true`），最后检查 `path` 本身。
:::

:::explanation
`.gitignore` 的规则可以归结为三点：

1. **匹配什么**：没有 `/` 的规则只看名字（任何一层都可以），有 `/` 的规则看从根目录开始的整个路径；结尾的 `/` 只用于文件夹；
2. **谁说了算**：最后一条匹配的规则。所以 `*.log` 之后的 `!important.log` 能把一个文件“救回来”，顺序反过来就不行了；
3. **文件夹被忽略了，里面的一切都被忽略**：Git 遇到被忽略的文件夹时，根本不会进入它，里面的 `!` 规则也就没有机会生效。这就是 `logs/` 加 `!logs/keep.txt` 不起作用、而 `logs/*` 加 `!logs/keep.txt` 有效的原因：后者忽略的是文件夹**中的**每一项，而不是文件夹本身。项目中常见的“保留空文件夹”写法 `logs/*` 加 `!logs/.gitkeep` 正是利用了这一点。

把 glob 转换成正则，是处理这类“小语言”的常见方法：把它翻译成一种已经有现成工具的形式（f01 把版本范围翻译成一组比较，也是同样的思路）。`*` 不跨越 `/` 这一点很重要：它让 `doc/*.txt` 只匹配一层，而 `**` 专门用来表示“任意多层”。

真实的 Git 还支持更多细节：每个文件夹中都可以有自己的 `.gitignore`（规则相对于它所在的文件夹）、`\` 转义（例如以 `#` 开头的文件名写成 `\#file`）、全局的忽略文件（`core.excludesFile`）。想知道某个文件为什么被忽略，运行 `git check-ignore -v 文件`，它会输出起作用的那条规则和它所在的行。
:::

:::variant{kind=alt name=per-segment}
```ts file=gitignore.ts
export type Rule = {
  /** ! 开头：重新包含 */
  negate: boolean;
  /** / 结尾：只匹配文件夹 */
  dirOnly: boolean;
  /** 开头或中间有 /：从根目录开始匹配整个路径；否则只匹配最后一段的名字 */
  anchored: boolean;
  regex: RegExp;
};

function escapeChar(char: string): string {
  return /[\\^$.*+?()[\]{}|/]/.test(char) ? '\\' + char : char;
}

function compile(glob: string): RegExp {
  const segments = glob.split('/');
  const parts: string[] = [];
  segments.forEach((segment, index) => {
    const last = index === segments.length - 1;
    if (segment === '**') {
      parts.push(last ? '.*' : '(?:[^/]+/)*');
      return;
    }
    let source = '';
    for (let i = 0; i < segment.length; i++) {
      const char = segment.charAt(i);
      if (char === '*') {
        while (segment.charAt(i + 1) === '*') i++;
        source += '[^/]*';
      } else if (char === '?') source += '[^/]';
      else if (char === '[' && segment.indexOf(']', i + 2) !== -1) {
        const end = segment.indexOf(']', i + 2);
        const body = segment.slice(i + 1, end);
        source += '[' + (body.startsWith('!') ? '^' + body.slice(1) : body) + ']';
        i = end;
      } else source += escapeChar(char);
    }
    parts.push(last ? source : source + '/');
  });
  return new RegExp('^' + parts.join('') + '$');
}

export function parseGitignore(text: string): Rule[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line !== '' && !line.startsWith('#'))
    .map((line) => {
      const negate = line.startsWith('!');
      let body = negate ? line.slice(1) : line;
      const dirOnly = body.endsWith('/');
      if (dirOnly) body = body.slice(0, -1);
      const anchored = body.includes('/');
      if (body.startsWith('/')) body = body.slice(1);
      return { negate, dirOnly, anchored, regex: compile(body) };
    });
}

export function isIgnored(text: string, path: string, isDir = false): boolean {
  const rules = parseGitignore(text);
  const verdict = (target: string, dir: boolean) =>
    rules.reduce((ignored, rule) => {
      if (rule.dirOnly && !dir) return ignored;
      const subject = rule.anchored ? target : (target.split('/').at(-1) ?? target);
      return rule.regex.test(subject) ? !rule.negate : ignored;
    }, false);
  const parts = path.split('/');
  return parts.some((_, i) => i < parts.length - 1 && verdict(parts.slice(0, i + 1).join('/'), true)) || verdict(path, isDir);
}
```
:::

:::variant{kind=wrong name=first-match-wins fails=tests reason="第一条匹配的规则就决定了结果：后面的 ! 规则不起作用"}
```ts file=gitignore.ts
export type Rule = {
  /** ! 开头：重新包含 */
  negate: boolean;
  /** / 结尾：只匹配文件夹 */
  dirOnly: boolean;
  /** 开头或中间有 /：从根目录开始匹配整个路径；否则只匹配最后一段的名字 */
  anchored: boolean;
  regex: RegExp;
};

/** 把一个 glob 转换成正则：* 与 ? 不跨越 /，** 匹配任意层 */
function globToRegExp(glob: string): RegExp {
  let source = '';
  for (let i = 0; i < glob.length; i++) {
    const char = glob.charAt(i);
    if (char === '*') {
      if (glob.charAt(i + 1) === '*') {
        const atSegmentStart = i === 0 || glob.charAt(i - 1) === '/';
        if (atSegmentStart && glob.charAt(i + 2) === '/') {
          source += '(?:.*/)?'; // **/：零层或多层文件夹
          i += 2;
          continue;
        }
        if (atSegmentStart && i + 2 === glob.length) {
          source += '.*'; // 结尾的 /**：里面的一切
          i += 1;
          continue;
        }
        while (glob.charAt(i + 1) === '*') i++; // 其他位置的 ** 与 * 相同
      }
      source += '[^/]*';
    } else if (char === '?') {
      source += '[^/]';
    } else if (char === '[') {
      const end = glob.indexOf(']', i + 2);
      if (end === -1) {
        source += '\\[';
        continue;
      }
      const body = glob.slice(i + 1, end);
      source += `[${body.startsWith('!') ? '^' + body.slice(1) : body}]`;
      i = end;
    } else {
      source += char.replace(/[.+^${}()|\\]/g, '\\$&');
    }
  }
  return new RegExp(`^${source}$`);
}

export function parseGitignore(text: string): Rule[] {
  const rules: Rule[] = [];
  for (const raw of text.split('\n')) {
    let line = raw.replace(/\r$/, '').replace(/ +$/, '');
    if (line === '' || line.startsWith('#')) continue;
    const negate = line.startsWith('!');
    if (negate) line = line.slice(1);
    const dirOnly = line.endsWith('/');
    if (dirOnly) line = line.slice(0, -1);
    const anchored = line.includes('/');
    if (line.startsWith('/')) line = line.slice(1);
    rules.push({ negate, dirOnly, anchored, regex: globToRegExp(line) });
  }
  return rules;
}

/** 后面的规则覆盖前面的：返回最后一条匹配的规则的结论 */
function matches(rules: readonly Rule[], path: string, isDir: boolean): boolean {
  const name = path.slice(path.lastIndexOf('/') + 1);
  for (const rule of rules) {
    if (rule.dirOnly && !isDir) continue;
    if (rule.regex.test(rule.anchored ? path : name)) return !rule.negate;
  }
  return false;
}

export function isIgnored(text: string, path: string, isDir = false): boolean {
  const rules = parseGitignore(text);
  const parts = path.split('/');
  // 某一层的文件夹被忽略了，里面的一切都被忽略，无法重新包含
  for (let i = 1; i < parts.length; i++) {
    if (matches(rules, parts.slice(0, i).join('/'), true)) return true;
  }
  return matches(rules, path, isDir);
}
```
:::

:::variant{kind=wrong name=reinclude-inside-ignored-dir fails=tests reason="没有处理“文件夹被忽略后，里面的文件无法重新包含”：logs/ 加 !logs/keep.txt 时 keep.txt 被当成了跟踪"}
```ts file=gitignore.ts
export type Rule = {
  /** ! 开头：重新包含 */
  negate: boolean;
  /** / 结尾：只匹配文件夹 */
  dirOnly: boolean;
  /** 开头或中间有 /：从根目录开始匹配整个路径；否则只匹配最后一段的名字 */
  anchored: boolean;
  regex: RegExp;
};

/** 把一个 glob 转换成正则：* 与 ? 不跨越 /，** 匹配任意层 */
function globToRegExp(glob: string): RegExp {
  let source = '';
  for (let i = 0; i < glob.length; i++) {
    const char = glob.charAt(i);
    if (char === '*') {
      if (glob.charAt(i + 1) === '*') {
        const atSegmentStart = i === 0 || glob.charAt(i - 1) === '/';
        if (atSegmentStart && glob.charAt(i + 2) === '/') {
          source += '(?:.*/)?'; // **/：零层或多层文件夹
          i += 2;
          continue;
        }
        if (atSegmentStart && i + 2 === glob.length) {
          source += '.*'; // 结尾的 /**：里面的一切
          i += 1;
          continue;
        }
        while (glob.charAt(i + 1) === '*') i++; // 其他位置的 ** 与 * 相同
      }
      source += '[^/]*';
    } else if (char === '?') {
      source += '[^/]';
    } else if (char === '[') {
      const end = glob.indexOf(']', i + 2);
      if (end === -1) {
        source += '\\[';
        continue;
      }
      const body = glob.slice(i + 1, end);
      source += `[${body.startsWith('!') ? '^' + body.slice(1) : body}]`;
      i = end;
    } else {
      source += char.replace(/[.+^${}()|\\]/g, '\\$&');
    }
  }
  return new RegExp(`^${source}$`);
}

export function parseGitignore(text: string): Rule[] {
  const rules: Rule[] = [];
  for (const raw of text.split('\n')) {
    let line = raw.replace(/\r$/, '').replace(/ +$/, '');
    if (line === '' || line.startsWith('#')) continue;
    const negate = line.startsWith('!');
    if (negate) line = line.slice(1);
    const dirOnly = line.endsWith('/');
    if (dirOnly) line = line.slice(0, -1);
    const anchored = line.includes('/');
    if (line.startsWith('/')) line = line.slice(1);
    rules.push({ negate, dirOnly, anchored, regex: globToRegExp(line) });
  }
  return rules;
}

/** 后面的规则覆盖前面的：返回最后一条匹配的规则的结论 */
function matches(rules: readonly Rule[], path: string, isDir: boolean): boolean {
  const name = path.slice(path.lastIndexOf('/') + 1);
  let ignored = false;
  for (const rule of rules) {
    if (rule.dirOnly && !isDir) continue;
    if (rule.regex.test(rule.anchored ? path : name)) ignored = !rule.negate;
  }
  return ignored;
}

export function isIgnored(text: string, path: string, isDir = false): boolean {
  const rules = parseGitignore(text);
  const parts = path.split('/');
  // 某一层的文件夹被忽略了，里面的一切都被忽略，无法重新包含
  let ignored = false;
  for (let i = 1; i < parts.length; i++) {
    if (matches(rules, parts.slice(0, i).join('/'), true)) ignored = true;
  }
  const own = parseGitignore(text).filter((rule) => rule.regex.test(rule.anchored ? path : (parts.at(-1) ?? path)));
  return own.length > 0 ? matches(rules, path, isDir) : ignored;
}
```
:::

:::variant{kind=wrong name=star-crosses-slash fails=tests reason="把 * 转换成了 .*：doc/*.txt 匹配到了 doc/sub/a.txt"}
```ts file=gitignore.ts
export type Rule = {
  /** ! 开头：重新包含 */
  negate: boolean;
  /** / 结尾：只匹配文件夹 */
  dirOnly: boolean;
  /** 开头或中间有 /：从根目录开始匹配整个路径；否则只匹配最后一段的名字 */
  anchored: boolean;
  regex: RegExp;
};

/** 把一个 glob 转换成正则：* 与 ? 不跨越 /，** 匹配任意层 */
function globToRegExp(glob: string): RegExp {
  let source = '';
  for (let i = 0; i < glob.length; i++) {
    const char = glob.charAt(i);
    if (char === '*') {
      if (glob.charAt(i + 1) === '*') {
        const atSegmentStart = i === 0 || glob.charAt(i - 1) === '/';
        if (atSegmentStart && glob.charAt(i + 2) === '/') {
          source += '(?:.*/)?'; // **/：零层或多层文件夹
          i += 2;
          continue;
        }
        if (atSegmentStart && i + 2 === glob.length) {
          source += '.*'; // 结尾的 /**：里面的一切
          i += 1;
          continue;
        }
        while (glob.charAt(i + 1) === '*') i++; // 其他位置的 ** 与 * 相同
      }
      source += '.*';
    } else if (char === '?') {
      source += '[^/]';
    } else if (char === '[') {
      const end = glob.indexOf(']', i + 2);
      if (end === -1) {
        source += '\\[';
        continue;
      }
      const body = glob.slice(i + 1, end);
      source += `[${body.startsWith('!') ? '^' + body.slice(1) : body}]`;
      i = end;
    } else {
      source += char.replace(/[.+^${}()|\\]/g, '\\$&');
    }
  }
  return new RegExp(`^${source}$`);
}

export function parseGitignore(text: string): Rule[] {
  const rules: Rule[] = [];
  for (const raw of text.split('\n')) {
    let line = raw.replace(/\r$/, '').replace(/ +$/, '');
    if (line === '' || line.startsWith('#')) continue;
    const negate = line.startsWith('!');
    if (negate) line = line.slice(1);
    const dirOnly = line.endsWith('/');
    if (dirOnly) line = line.slice(0, -1);
    const anchored = line.includes('/');
    if (line.startsWith('/')) line = line.slice(1);
    rules.push({ negate, dirOnly, anchored, regex: globToRegExp(line) });
  }
  return rules;
}

/** 后面的规则覆盖前面的：返回最后一条匹配的规则的结论 */
function matches(rules: readonly Rule[], path: string, isDir: boolean): boolean {
  const name = path.slice(path.lastIndexOf('/') + 1);
  let ignored = false;
  for (const rule of rules) {
    if (rule.dirOnly && !isDir) continue;
    if (rule.regex.test(rule.anchored ? path : name)) ignored = !rule.negate;
  }
  return ignored;
}

export function isIgnored(text: string, path: string, isDir = false): boolean {
  const rules = parseGitignore(text);
  const parts = path.split('/');
  // 某一层的文件夹被忽略了，里面的一切都被忽略，无法重新包含
  for (let i = 1; i < parts.length; i++) {
    if (matches(rules, parts.slice(0, i).join('/'), true)) return true;
  }
  return matches(rules, path, isDir);
}
```
:::

:::variant{kind=wrong name=never-anchored fails=tests reason="所有的规则都只匹配名字：/dist 匹配到了 src/dist，doc/*.txt 什么都匹配不到"}
```ts file=gitignore.ts
export type Rule = {
  /** ! 开头：重新包含 */
  negate: boolean;
  /** / 结尾：只匹配文件夹 */
  dirOnly: boolean;
  /** 开头或中间有 /：从根目录开始匹配整个路径；否则只匹配最后一段的名字 */
  anchored: boolean;
  regex: RegExp;
};

/** 把一个 glob 转换成正则：* 与 ? 不跨越 /，** 匹配任意层 */
function globToRegExp(glob: string): RegExp {
  let source = '';
  for (let i = 0; i < glob.length; i++) {
    const char = glob.charAt(i);
    if (char === '*') {
      if (glob.charAt(i + 1) === '*') {
        const atSegmentStart = i === 0 || glob.charAt(i - 1) === '/';
        if (atSegmentStart && glob.charAt(i + 2) === '/') {
          source += '(?:.*/)?'; // **/：零层或多层文件夹
          i += 2;
          continue;
        }
        if (atSegmentStart && i + 2 === glob.length) {
          source += '.*'; // 结尾的 /**：里面的一切
          i += 1;
          continue;
        }
        while (glob.charAt(i + 1) === '*') i++; // 其他位置的 ** 与 * 相同
      }
      source += '[^/]*';
    } else if (char === '?') {
      source += '[^/]';
    } else if (char === '[') {
      const end = glob.indexOf(']', i + 2);
      if (end === -1) {
        source += '\\[';
        continue;
      }
      const body = glob.slice(i + 1, end);
      source += `[${body.startsWith('!') ? '^' + body.slice(1) : body}]`;
      i = end;
    } else {
      source += char.replace(/[.+^${}()|\\]/g, '\\$&');
    }
  }
  return new RegExp(`^${source}$`);
}

export function parseGitignore(text: string): Rule[] {
  const rules: Rule[] = [];
  for (const raw of text.split('\n')) {
    let line = raw.replace(/\r$/, '').replace(/ +$/, '');
    if (line === '' || line.startsWith('#')) continue;
    const negate = line.startsWith('!');
    if (negate) line = line.slice(1);
    const dirOnly = line.endsWith('/');
    if (dirOnly) line = line.slice(0, -1);
    const anchored = line.includes('/');
    if (line.startsWith('/')) line = line.slice(1);
    rules.push({ negate, dirOnly, anchored, regex: globToRegExp(line) });
  }
  return rules;
}

/** 后面的规则覆盖前面的：返回最后一条匹配的规则的结论 */
function matches(rules: readonly Rule[], path: string, isDir: boolean): boolean {
  const name = path.slice(path.lastIndexOf('/') + 1);
  let ignored = false;
  for (const rule of rules) {
    if (rule.dirOnly && !isDir) continue;
    if (rule.regex.test(name)) ignored = !rule.negate;
  }
  return ignored;
}

export function isIgnored(text: string, path: string, isDir = false): boolean {
  const rules = parseGitignore(text);
  const parts = path.split('/');
  // 某一层的文件夹被忽略了，里面的一切都被忽略，无法重新包含
  for (let i = 1; i < parts.length; i++) {
    if (matches(rules, parts.slice(0, i).join('/'), true)) return true;
  }
  return matches(rules, path, isDir);
}
```
:::

:::variant{kind=wrong name=dir-only-matches-files fails=tests reason="忽略了结尾的 /：logs/ 也匹配了一个名叫 logs 的文件"}
```ts file=gitignore.ts
export type Rule = {
  /** ! 开头：重新包含 */
  negate: boolean;
  /** / 结尾：只匹配文件夹 */
  dirOnly: boolean;
  /** 开头或中间有 /：从根目录开始匹配整个路径；否则只匹配最后一段的名字 */
  anchored: boolean;
  regex: RegExp;
};

/** 把一个 glob 转换成正则：* 与 ? 不跨越 /，** 匹配任意层 */
function globToRegExp(glob: string): RegExp {
  let source = '';
  for (let i = 0; i < glob.length; i++) {
    const char = glob.charAt(i);
    if (char === '*') {
      if (glob.charAt(i + 1) === '*') {
        const atSegmentStart = i === 0 || glob.charAt(i - 1) === '/';
        if (atSegmentStart && glob.charAt(i + 2) === '/') {
          source += '(?:.*/)?'; // **/：零层或多层文件夹
          i += 2;
          continue;
        }
        if (atSegmentStart && i + 2 === glob.length) {
          source += '.*'; // 结尾的 /**：里面的一切
          i += 1;
          continue;
        }
        while (glob.charAt(i + 1) === '*') i++; // 其他位置的 ** 与 * 相同
      }
      source += '[^/]*';
    } else if (char === '?') {
      source += '[^/]';
    } else if (char === '[') {
      const end = glob.indexOf(']', i + 2);
      if (end === -1) {
        source += '\\[';
        continue;
      }
      const body = glob.slice(i + 1, end);
      source += `[${body.startsWith('!') ? '^' + body.slice(1) : body}]`;
      i = end;
    } else {
      source += char.replace(/[.+^${}()|\\]/g, '\\$&');
    }
  }
  return new RegExp(`^${source}$`);
}

export function parseGitignore(text: string): Rule[] {
  const rules: Rule[] = [];
  for (const raw of text.split('\n')) {
    let line = raw.replace(/\r$/, '').replace(/ +$/, '');
    if (line === '' || line.startsWith('#')) continue;
    const negate = line.startsWith('!');
    if (negate) line = line.slice(1);
    const dirOnly = line.endsWith('/');
    if (dirOnly) line = line.slice(0, -1);
    const anchored = line.includes('/');
    if (line.startsWith('/')) line = line.slice(1);
    rules.push({ negate, dirOnly, anchored, regex: globToRegExp(line) });
  }
  return rules;
}

/** 后面的规则覆盖前面的：返回最后一条匹配的规则的结论 */
function matches(rules: readonly Rule[], path: string, isDir: boolean): boolean {
  const name = path.slice(path.lastIndexOf('/') + 1);
  let ignored = false;
  for (const rule of rules) {
    if (rule.regex.test(rule.anchored ? path : name)) ignored = !rule.negate;
  }
  return ignored;
}

export function isIgnored(text: string, path: string, isDir = false): boolean {
  const rules = parseGitignore(text);
  const parts = path.split('/');
  // 某一层的文件夹被忽略了，里面的一切都被忽略，无法重新包含
  for (let i = 1; i < parts.length; i++) {
    if (matches(rules, parts.slice(0, i).join('/'), true)) return true;
  }
  return matches(rules, path, isDir);
}
```
:::

:::variant{kind=wrong name=keeps-trailing-spaces fails=tests reason="没有去掉行尾的空格：“*.tmp   ” 匹配不到 a.tmp"}
```ts file=gitignore.ts
export type Rule = {
  /** ! 开头：重新包含 */
  negate: boolean;
  /** / 结尾：只匹配文件夹 */
  dirOnly: boolean;
  /** 开头或中间有 /：从根目录开始匹配整个路径；否则只匹配最后一段的名字 */
  anchored: boolean;
  regex: RegExp;
};

/** 把一个 glob 转换成正则：* 与 ? 不跨越 /，** 匹配任意层 */
function globToRegExp(glob: string): RegExp {
  let source = '';
  for (let i = 0; i < glob.length; i++) {
    const char = glob.charAt(i);
    if (char === '*') {
      if (glob.charAt(i + 1) === '*') {
        const atSegmentStart = i === 0 || glob.charAt(i - 1) === '/';
        if (atSegmentStart && glob.charAt(i + 2) === '/') {
          source += '(?:.*/)?'; // **/：零层或多层文件夹
          i += 2;
          continue;
        }
        if (atSegmentStart && i + 2 === glob.length) {
          source += '.*'; // 结尾的 /**：里面的一切
          i += 1;
          continue;
        }
        while (glob.charAt(i + 1) === '*') i++; // 其他位置的 ** 与 * 相同
      }
      source += '[^/]*';
    } else if (char === '?') {
      source += '[^/]';
    } else if (char === '[') {
      const end = glob.indexOf(']', i + 2);
      if (end === -1) {
        source += '\\[';
        continue;
      }
      const body = glob.slice(i + 1, end);
      source += `[${body.startsWith('!') ? '^' + body.slice(1) : body}]`;
      i = end;
    } else {
      source += char.replace(/[.+^${}()|\\]/g, '\\$&');
    }
  }
  return new RegExp(`^${source}$`);
}

export function parseGitignore(text: string): Rule[] {
  const rules: Rule[] = [];
  for (const raw of text.split('\n')) {
    let line = raw.replace(/\r$/, '');
    if (line === '' || line.startsWith('#')) continue;
    const negate = line.startsWith('!');
    if (negate) line = line.slice(1);
    const dirOnly = line.endsWith('/');
    if (dirOnly) line = line.slice(0, -1);
    const anchored = line.includes('/');
    if (line.startsWith('/')) line = line.slice(1);
    rules.push({ negate, dirOnly, anchored, regex: globToRegExp(line) });
  }
  return rules;
}

/** 后面的规则覆盖前面的：返回最后一条匹配的规则的结论 */
function matches(rules: readonly Rule[], path: string, isDir: boolean): boolean {
  const name = path.slice(path.lastIndexOf('/') + 1);
  let ignored = false;
  for (const rule of rules) {
    if (rule.dirOnly && !isDir) continue;
    if (rule.regex.test(rule.anchored ? path : name)) ignored = !rule.negate;
  }
  return ignored;
}

export function isIgnored(text: string, path: string, isDir = false): boolean {
  const rules = parseGitignore(text);
  const parts = path.split('/');
  // 某一层的文件夹被忽略了，里面的一切都被忽略，无法重新包含
  for (let i = 1; i < parts.length; i++) {
    if (matches(rules, parts.slice(0, i).join('/'), true)) return true;
  }
  return matches(rules, path, isDir);
}
```
:::
