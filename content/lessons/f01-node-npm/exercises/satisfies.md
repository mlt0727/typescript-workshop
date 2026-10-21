---
kind: challenge
title: 判断版本是否满足范围
---
在 `ranges.ts` 中实现 `satisfies(version, range)`：判断版本 `version` 是否满足 npm 的版本范围 `range`。`semver.ts`（只读）是小任务的参考解，可以直接使用其中的 `parseVersion` 和 `compareVersions`。

范围的写法（npm 写法的一个子集）：

- `range` 用 `||` 分成几组，满足**任意一组**即可；每一组前后的空白忽略；
- 一组中用空白（一个或多个）分隔的多个条件必须**全部**满足；
- 一个条件是：`1.2.3` 或 `=1.2.3`（相等）、`>1.2.3`、`>=1.2.3`、`<1.2.3`、`<=1.2.3`、`^1.2.3`、`~1.2.3`，或者 `*`（任何版本）。运算符和版本之间没有空格，版本必须是完整的（本练习不处理 `1.2`、`1.x`、`1.2.3 - 2.0.0` 这些写法）；
- `^V`：`>=V`，并且小于“最左边非零的那一位加一、右边各位清零”的版本：`^1.2.3` 小于 `2.0.0`，`^0.2.3` 小于 `0.3.0`，`^0.0.3` 小于 `0.0.4`；
- `~V`：`>=V`，并且小于“次版本加一、修订号清零”的版本：`~1.2.3` 小于 `1.3.0`，`~0.0.3` 小于 `0.1.0`；
- 整个 `range` 是空字符串或者只有空白时，与 `*` 相同；
- **预发布规则**：`version` 带预发布标签时，一组条件中必须有某个条件**写出的版本**也带预发布标签、并且主.次.修订与 `version` 相同，这一组才能满足它（`^`、`~` 写出的版本就是它们后面的那个版本，`*` 没有写出版本）。

`version` 不是有效的版本，或者 `range` 中任何一部分写得不正确（空的组、不认识的条件、不完整的版本）时，抛出 `Error`。整个范围要先全部检查：不能因为前面的组已经满足，就不管后面写错的组。

测试中 `satisfies` 返回 `true`/`false` 的结果都与 npm 使用的 node-semver（7.8.5）一致。抛出错误的输入分两种：真正无效的写法（`latest`、`>>1.2.3`），以及 node-semver 能处理、但本练习不支持的写法（`v1.2.3`、`^1.2`、`1.x`、`>= 1.2.3`、`1.2.3 - 2.0.0`，node-semver 甚至把 `^1.0.0 ||` 当成 `*`）。本题对这两种都统一抛出错误。

:::files{role=starter}
```ts file=ranges.ts
import { compareVersions, parseVersion, type Version } from './semver';

export function satisfies(version: string, range: string): boolean {
  return false;
}
```
```ts file=main.ts
import { satisfies } from './ranges';

const checks: [version: string, range: string][] = [
  ['1.4.0', '^1.2.3'],
  ['0.3.0', '^0.2.3'],
  ['1.3.0', '~1.2.3'],
  ['3.1.0', '^1.0.0 || ^3.0.0'],
  ['1.2.3-beta.1', '^1.2.0'],
  ['1.2.3-beta.2', '^1.2.3-beta.1'],
];
for (const [version, range] of checks) console.log(version, range, satisfies(version, range));
```
:::

:::files{role=support}
```ts file=semver.ts readonly
/** 预发布标签中的一个标识符：纯数字的是 number，其他的是 string */
export type Identifier = string | number;

export type Version = {
  major: number;
  minor: number;
  patch: number;
  prerelease: Identifier[];
};

/** 没有前导零的非负整数 */
const NUMERIC = /^(?:0|[1-9]\d*)$/;
/** 一个标识符：非空，只有 ASCII 字母、数字和 - */
const IDENTIFIER = /^[0-9A-Za-z-]+$/;

/** 用 . 分隔的标识符；有空的或者含有不允许的字符时返回 null */
function identifiers(text: string): string[] | null {
  const ids = text.split('.');
  return ids.every((id) => IDENTIFIER.test(id)) ? ids : null;
}

export function parseVersion(text: string): Version | null {
  // 构建信息：+ 之后的部分，检查格式后丢弃
  const plus = text.indexOf('+');
  if (plus !== -1 && identifiers(text.slice(plus + 1)) === null) return null;
  const main = plus === -1 ? text : text.slice(0, plus);

  // 预发布标签：第一个 - 之后的部分（标识符中也可以有 -）
  const dash = main.indexOf('-');
  const core = dash === -1 ? main : main.slice(0, dash);
  const pre = dash === -1 ? [] : identifiers(main.slice(dash + 1));
  if (pre === null) return null;

  const numbers = core.split('.');
  if (numbers.length !== 3 || !numbers.every((n) => NUMERIC.test(n))) return null;
  // 长度已经检查过是 3；默认值只是为了让类型是 number
  const [major = 0, minor = 0, patch = 0] = numbers.map(Number);

  const prerelease: Identifier[] = [];
  for (const id of pre) {
    if (!/^\d+$/.test(id)) prerelease.push(id);
    else if (NUMERIC.test(id)) prerelease.push(Number(id));
    else return null; // 纯数字，但有前导零
  }
  return { major, minor, patch, prerelease };
}

const sign = (n: number): -1 | 0 | 1 => (n < 0 ? -1 : n > 0 ? 1 : 0);

function compareIdentifiers(a: Identifier, b: Identifier): -1 | 0 | 1 {
  if (typeof a === 'number' && typeof b === 'number') return sign(a - b);
  if (typeof a === 'number') return -1; // 数字比字符串小
  if (typeof b === 'number') return 1;
  return a < b ? -1 : a > b ? 1 : 0;
}

export function compareVersions(a: Version, b: Version): -1 | 0 | 1 {
  const core = sign(a.major - b.major) || sign(a.minor - b.minor) || sign(a.patch - b.patch);
  if (core !== 0) return core;

  const pa = a.prerelease;
  const pb = b.prerelease;
  if (pa.length === 0 && pb.length === 0) return 0;
  if (pa.length === 0) return 1; // 正式版本比预发布版本大
  if (pb.length === 0) return -1;

  for (const [i, id] of pa.entries()) {
    const other = pb[i];
    if (other === undefined) return 1; // 前面都相同，a 的标识符更多
    const result = compareIdentifiers(id, other);
    if (result !== 0) return result;
  }
  return pa.length < pb.length ? -1 : 0;
}
```
:::

:::files{role=solution}
```ts file=ranges.ts
import { compareVersions, parseVersion, type Version } from './semver';

/** 一个条件：写出的版本（* 没有），以及判断一个版本是否满足它的函数 */
type Comparator = { written: Version | null; test: (version: Version) => boolean };

function mustParse(text: string): Version {
  const version = parseVersion(text);
  if (version === null) throw new Error(`无效的版本：${text}`);
  return version;
}

/** ^ 的上限：最左边非零的那一位加一，右边各位清零 */
function caretUpper({ major, minor, patch }: Version): Version {
  if (major > 0) return { major: major + 1, minor: 0, patch: 0, prerelease: [] };
  if (minor > 0) return { major: 0, minor: minor + 1, patch: 0, prerelease: [] };
  return { major: 0, minor: 0, patch: patch + 1, prerelease: [] };
}

/** ~ 的上限：次版本加一，修订号清零 */
function tildeUpper({ major, minor }: Version): Version {
  return { major, minor: minor + 1, patch: 0, prerelease: [] };
}

function parseComparator(token: string): Comparator {
  if (token === '*') return { written: null, test: () => true };
  // 这个正则总能匹配：运算符可以没有，其余部分交给 mustParse 检查
  const [, operator = '', rest = ''] = /^(>=|<=|>|<|=|\^|~)?(.*)$/.exec(token) ?? [];
  const written = mustParse(rest);
  const from = (version: Version) => compareVersions(version, written);
  switch (operator) {
    case '>':
      return { written, test: (v) => from(v) > 0 };
    case '>=':
      return { written, test: (v) => from(v) >= 0 };
    case '<':
      return { written, test: (v) => from(v) < 0 };
    case '<=':
      return { written, test: (v) => from(v) <= 0 };
    case '^': {
      const upper = caretUpper(written);
      return { written, test: (v) => from(v) >= 0 && compareVersions(v, upper) < 0 };
    }
    case '~': {
      const upper = tildeUpper(written);
      return { written, test: (v) => from(v) >= 0 && compareVersions(v, upper) < 0 };
    }
    default: // 没有运算符，或者 =
      return { written, test: (v) => from(v) === 0 };
  }
}

function parseSet(part: string, range: string): Comparator[] {
  const text = part.trim();
  if (text === '') throw new Error(`范围中有空的一组：${range}`);
  return text.split(/\s+/).map(parseComparator);
}

/** 预发布规则：这一组中有条件写出了同一个 主.次.修订 的预发布版本 */
function allowsPrerelease(comparators: Comparator[], version: Version): boolean {
  return comparators.some(
    ({ written }) =>
      written !== null &&
      written.prerelease.length > 0 &&
      written.major === version.major &&
      written.minor === version.minor &&
      written.patch === version.patch,
  );
}

export function satisfies(version: string, range: string): boolean {
  const target = mustParse(version);
  // 先完整解析整个范围：任何一部分写错都抛出错误
  const sets = range.trim() === '' ? [[parseComparator('*')]] : range.split('||').map((part) => parseSet(part, range));
  return sets.some(
    (comparators) =>
      comparators.every((c) => c.test(target)) && (target.prerelease.length === 0 || allowsPrerelease(comparators, target)),
  );
}
```
```ts file=main.ts
import { satisfies } from './ranges';

const checks: [version: string, range: string][] = [
  ['1.4.0', '^1.2.3'],
  ['0.3.0', '^0.2.3'],
  ['1.3.0', '~1.2.3'],
  ['3.1.0', '^1.0.0 || ^3.0.0'],
  ['1.2.3-beta.1', '^1.2.0'],
  ['1.2.3-beta.2', '^1.2.3-beta.1'],
];
for (const [version, range] of checks) console.log(version, range, satisfies(version, range));
```
:::

:::files{role=tests}
```ts file=ranges.test.ts
import { describe, expect, test } from 'vitest';
import { satisfies } from './ranges';

const yes = (version: string, range: string) => expect(satisfies(version, range), `${version} 应该满足 ${range}`).toBe(true);
const no = (version: string, range: string) => expect(satisfies(version, range), `${version} 不应该满足 ${range}`).toBe(false);

describe('单个条件', () => {
  test('相等与比较', () => {
    yes('1.2.3', '1.2.3');
    no('1.2.4', '1.2.3');
    yes('1.0.0', '=1.0.0');
    yes('1.0.1', '>1.0.0');
    no('1.0.0', '>1.0.0');
    yes('1.0.0', '>=1.0.0');
    yes('1.0.0', '<=1.0.0');
    yes('1.9.9', '<2.0.0');
    no('2.0.0', '<2.0.0');
    yes('10.0.0', '>9.10.0');
    yes('1.2.3+build.7', '=1.2.3');
  });

  test('^：不改变最左边非零的那一位', () => {
    yes('1.2.3', '^1.2.3');
    yes('1.4.0', '^1.2.3');
    no('2.0.0', '^1.2.3');
    no('1.2.2', '^1.2.3');
    no('10.0.0', '^9.0.0');
    yes('0.2.5', '^0.2.3');
    yes('0.2.9', '^0.2.3');
    no('0.3.0', '^0.2.3');
    no('0.2.2', '^0.2.3');
    yes('0.0.3', '^0.0.3');
    no('0.0.4', '^0.0.3');
  });

  test('~：只允许修订号变化', () => {
    yes('1.2.9', '~1.2.3');
    no('1.3.0', '~1.2.3');
    yes('1.9.10', '~1.9.0');
    no('1.10.0', '~1.9.0');
    yes('0.2.9', '~0.2.3');
    yes('0.0.9', '~0.0.3');
    no('0.0.9', '^0.0.3');
    no('0.1.0', '~0.0.3');
  });

  test('* 与空的范围', () => {
    yes('9.9.9', '*');
    yes('0.0.0', '*');
    yes('3.1.4', '');
    yes('3.1.4', '   ');
  });
});

describe('组合', () => {
  test('空白分隔：同时满足', () => {
    yes('1.4.9', '>=1.2.0 <1.5.0');
    yes('1.4.9', '>=1.2.0   <1.5.0');
    no('1.5.0', '>=1.2.0 <1.5.0');
    no('1.1.9', '>=1.2.0 <1.5.0');
    yes('1.0.0', '>=1.0.0 <=1.0.0');
    no('5.0.0', '>=1.0.0 <2.0.0 >=4.0.0');
  });

  test('||：满足任意一组', () => {
    yes('1.9.0', '^1.0.0 || ^3.0.0');
    yes('3.1.0', '^1.0.0 || ^3.0.0');
    no('2.1.0', '^1.0.0 || ^3.0.0');
    yes('3.1.0', '  ^1.0.0||^3.0.0  ');
    yes('3.0.0', '^1.0.0 || >=3.0.0 <3.1.0');
    no('3.1.0', '^1.0.0 || >=3.0.0 <3.1.0');
    yes('1.5.0', '>=1.2.0 <1.5.0 || 1.5.0');
  });
});

describe('预发布版本', () => {
  test('普通的范围不包含预发布版本', () => {
    no('1.2.3-beta.1', '^1.2.0');
    no('2.0.0-rc.1', '^1.2.0');
    no('2.0.0-rc.1', '<2.0.0');
    no('1.0.0-beta', '*');
    no('1.0.0-beta', '');
  });

  test('条件写出了同一个 主.次.修订 的预发布版本时', () => {
    yes('1.2.3-beta.2', '^1.2.3-beta.1');
    no('1.2.3-beta.0', '^1.2.3-beta.1');
    no('1.2.4-beta.1', '^1.2.3-beta.1');
    yes('1.2.3', '^1.2.3-beta.1');
    yes('1.9.9', '^1.2.3-beta.1');
    no('2.0.0', '^1.2.3-beta.1');
    yes('1.2.3-beta.2', '~1.2.3-beta.1');
    no('1.2.3-alpha', '~1.2.3-beta.1');
    no('1.3.0', '~1.2.3-beta.1');
    yes('0.2.3-beta.5', '^0.2.3-beta.1');
    no('0.3.0', '^0.2.3-beta.1');
    yes('1.2.3-beta.2', '>1.2.3-beta.1');
    no('1.2.3-beta.1', '>1.2.3-beta.1');
    yes('1.4.0-rc.1', '>=1.4.0-rc.0 <1.5.0');
    // 写出预发布版本的条件不一定是这一组的第一个
    yes('1.4.0-rc.1', '<1.5.0 >=1.4.0-rc.0');
    no('1.4.1-rc.1', '>=1.4.0-rc.0 <1.5.0');
    yes('2.0.0-rc.1', '<=2.0.0-rc.1');
    no('2.0.0-rc.2', '<=2.0.0-rc.1');
  });

  test('规则按组检查：满足的那一组自己要写出预发布版本', () => {
    yes('1.2.3-beta.5', '>=1.0.0 || ^1.2.3-beta.1');
    no('1.2.3-beta.5', '>=1.2.3-beta.1 <1.2.3-beta.2 || >=1.0.0');
  });
});

describe('无效的输入', () => {
  test('无效的版本', () => {
    for (const version of ['1.2', 'v1.2.3', '01.2.3', '']) {
      expect(() => satisfies(version, '*'), version).toThrow();
    }
  });

  test('无效的范围：整个范围都要检查', () => {
    const ranges = ['^1.2', '1.x', 'latest', '>= 1.2.3', '>>1.2.3', '=', '1.2.3 - 2.0.0', '^1.0.0 ||', '|| ^1.0.0', '^1.0.0 || ^2', '^1.0.0 || * || ~'];
    for (const range of ranges) {
      expect(() => satisfies('1.2.3', range), range).toThrow();
    }
  });
});
```
:::

:::hint{level=1}
分两步：先把整个范围**解析**成“组的数组，每组是条件的数组”（这一步遇到错误就抛出），再**判断**。`range.split('||')` 得到每一组，`trim()` 之后用 `split(/\s+/)` 得到每个条件。每个条件可以解析成一个对象：写出的版本，加上一个 `(v: Version) => boolean` 的判断函数。`^`、`~` 的判断函数检查“大于等于下限、小于上限”两件事。
:::

:::hint{level=2}
取出运算符可以用正则 `/^(>=|<=|>|<|=|\^|~)?(.*)$/`（注意 `>=` 要写在 `>` 前面）。`compareVersions(v, written)` 大于 0 就是 `v > written`。预发布规则放在组的层面：这一组的条件都满足之后，如果 `version` 带预发布标签，再检查这一组中是否有条件写出了“同一个主.次.修订、带预发布标签”的版本。
:::

:::explanation
参考解把工作分成**解析**和**判断**两步。先完整地解析整个范围，再判断，这样“写错的范围”总是会被发现，而不是取决于版本碰巧满足了哪一组。这也是处理任何“小语言”（范围、查询条件、路由规则）的常见结构。

每个条件被解析成 `{ written, test }`：`test` 是一个闭包，记住了写出的版本和上限。`^` 和 `~` 只是“下限加上限”的简写，区别全在上限的计算上：

| 写法 | 下限 | 上限（不含） |
| --- | --- | --- |
| `^1.2.3` | `1.2.3` | `2.0.0` |
| `^0.2.3` | `0.2.3` | `0.3.0` |
| `^0.0.3` | `0.0.3` | `0.0.4` |
| `~1.2.3` | `1.2.3` | `1.3.0` |
| `~0.0.3` | `0.0.3` | `0.1.0` |

**预发布规则**是 npm 的一个刻意的设计：`^1.2.0` 的作者想要的是稳定的 1.x 版本，`2.0.0-rc.1`、`1.3.0-beta.1` 这些测试版虽然在数值上可能落在范围内，也不应该被自动安装。只有当作者在某个条件中明确写出了同一个版本的预发布标签（`^1.2.3-beta.1`），才表示“我愿意接受 1.2.3 的测试版”，而且只接受 1.2.3 的，不包括 1.2.4 的。规则按组检查：`>=1.0.0 || ^1.2.3-beta.1` 中，只有第二组接受 1.2.3 的测试版。

真实的 npm 范围还支持 `1.2`、`1.x`、`1.2.3 - 2.0.0` 等写法，它们都会先被展开成这里的比较条件。项目中需要处理版本范围时，直接使用 `semver` 包的 `satisfies`。
:::

:::variant{kind=alt name=expand-to-comparators}
```ts file=ranges.ts
import { compareVersions, parseVersion, type Version } from './semver';

type Op = '=' | '>' | '>=' | '<' | '<=';
type Comparator = { op: Op; version: Version };
/** 一组条件展开后的比较，以及其中写出的版本（预发布规则要用） */
type ComparatorSet = { comparators: Comparator[]; written: Version[] };

function parse(text: string): Version {
  const version = parseVersion(text);
  if (version === null) throw new Error('无效的版本 ' + text);
  return version;
}

function expand(token: string): ComparatorSet {
  if (token === '*') return { comparators: [], written: [] };
  const ops: Op[] = ['>=', '<=', '>', '<', '='];
  for (const op of ops) {
    if (token.startsWith(op)) {
      const version = parse(token.slice(op.length));
      return { comparators: [{ op, version }], written: [version] };
    }
  }
  if (token.startsWith('^') || token.startsWith('~')) {
    const base = parse(token.slice(1));
    const { major, minor, patch } = base;
    const upper: Version =
      token.startsWith('~') ? { major, minor: minor + 1, patch: 0, prerelease: [] }
      : major > 0 ? { major: major + 1, minor: 0, patch: 0, prerelease: [] }
      : minor > 0 ? { major: 0, minor: minor + 1, patch: 0, prerelease: [] }
      : { major: 0, minor: 0, patch: patch + 1, prerelease: [] };
    return { comparators: [{ op: '>=', version: base }, { op: '<', version: upper }], written: [base] };
  }
  const version = parse(token);
  return { comparators: [{ op: '=', version }], written: [version] };
}

function test({ op, version }: Comparator, target: Version): boolean {
  const c = compareVersions(target, version);
  switch (op) {
    case '=':
      return c === 0;
    case '>':
      return c > 0;
    case '>=':
      return c >= 0;
    case '<':
      return c < 0;
    case '<=':
      return c <= 0;
  }
}

export function satisfies(version: string, range: string): boolean {
  const target = parse(version);
  const groups = range.trim() === '' ? ['*'] : range.split('||');
  const sets = groups.map((group) => {
    const tokens = group.trim().split(/\s+/).filter((t) => t !== '');
    if (tokens.length === 0) throw new Error('范围中有空的一组');
    const parts = tokens.map(expand);
    return { comparators: parts.flatMap((p) => p.comparators), written: parts.flatMap((p) => p.written) };
  });
  return sets.some(({ comparators, written }) => {
    if (!comparators.every((c) => test(c, target))) return false;
    if (target.prerelease.length === 0) return true;
    return written.some(
      (w) => w.prerelease.length > 0 && w.major === target.major && w.minor === target.minor && w.patch === target.patch,
    );
  });
}
```
:::

:::variant{kind=wrong name=caret-ignores-zero fails=tests reason="^ 总是允许次版本变化：没有处理主版本为 0 的情况，0.3.0 被当成满足 ^0.2.3"}
```ts file=ranges.ts
import { compareVersions, parseVersion, type Version } from './semver';

/** 一个条件：写出的版本（* 没有），以及判断一个版本是否满足它的函数 */
type Comparator = { written: Version | null; test: (version: Version) => boolean };

function mustParse(text: string): Version {
  const version = parseVersion(text);
  if (version === null) throw new Error(`无效的版本：${text}`);
  return version;
}

/** ^ 的上限：最左边非零的那一位加一，右边各位清零 */
function caretUpper({ major }: Version): Version {
  return { major: major + 1, minor: 0, patch: 0, prerelease: [] };
}

/** ~ 的上限：次版本加一，修订号清零 */
function tildeUpper({ major, minor }: Version): Version {
  return { major, minor: minor + 1, patch: 0, prerelease: [] };
}

function parseComparator(token: string): Comparator {
  if (token === '*') return { written: null, test: () => true };
  // 这个正则总能匹配：运算符可以没有，其余部分交给 mustParse 检查
  const [, operator = '', rest = ''] = /^(>=|<=|>|<|=|\^|~)?(.*)$/.exec(token) ?? [];
  const written = mustParse(rest);
  const from = (version: Version) => compareVersions(version, written);
  switch (operator) {
    case '>':
      return { written, test: (v) => from(v) > 0 };
    case '>=':
      return { written, test: (v) => from(v) >= 0 };
    case '<':
      return { written, test: (v) => from(v) < 0 };
    case '<=':
      return { written, test: (v) => from(v) <= 0 };
    case '^': {
      const upper = caretUpper(written);
      return { written, test: (v) => from(v) >= 0 && compareVersions(v, upper) < 0 };
    }
    case '~': {
      const upper = tildeUpper(written);
      return { written, test: (v) => from(v) >= 0 && compareVersions(v, upper) < 0 };
    }
    default: // 没有运算符，或者 =
      return { written, test: (v) => from(v) === 0 };
  }
}

function parseSet(part: string, range: string): Comparator[] {
  const text = part.trim();
  if (text === '') throw new Error(`范围中有空的一组：${range}`);
  return text.split(/\s+/).map(parseComparator);
}

/** 预发布规则：这一组中有条件写出了同一个 主.次.修订 的预发布版本 */
function allowsPrerelease(comparators: Comparator[], version: Version): boolean {
  return comparators.some(
    ({ written }) =>
      written !== null &&
      written.prerelease.length > 0 &&
      written.major === version.major &&
      written.minor === version.minor &&
      written.patch === version.patch,
  );
}

export function satisfies(version: string, range: string): boolean {
  const target = mustParse(version);
  // 先完整解析整个范围：任何一部分写错都抛出错误
  const sets = range.trim() === '' ? [[parseComparator('*')]] : range.split('||').map((part) => parseSet(part, range));
  return sets.some(
    (comparators) =>
      comparators.every((c) => c.test(target)) && (target.prerelease.length === 0 || allowsPrerelease(comparators, target)),
  );
}
```
:::

:::variant{kind=wrong name=tilde-as-caret fails=tests reason="~ 用了 ^ 的上限：1.3.0 被当成满足 ~1.2.3"}
```ts file=ranges.ts
import { compareVersions, parseVersion, type Version } from './semver';

/** 一个条件：写出的版本（* 没有），以及判断一个版本是否满足它的函数 */
type Comparator = { written: Version | null; test: (version: Version) => boolean };

function mustParse(text: string): Version {
  const version = parseVersion(text);
  if (version === null) throw new Error(`无效的版本：${text}`);
  return version;
}

/** ^ 的上限：最左边非零的那一位加一，右边各位清零 */
function caretUpper({ major, minor, patch }: Version): Version {
  if (major > 0) return { major: major + 1, minor: 0, patch: 0, prerelease: [] };
  if (minor > 0) return { major: 0, minor: minor + 1, patch: 0, prerelease: [] };
  return { major: 0, minor: 0, patch: patch + 1, prerelease: [] };
}

/** ~ 的上限：次版本加一，修订号清零 */
function tildeUpper({ major, minor }: Version): Version {
  return { major, minor: minor + 1, patch: 0, prerelease: [] };
}

function parseComparator(token: string): Comparator {
  if (token === '*') return { written: null, test: () => true };
  // 这个正则总能匹配：运算符可以没有，其余部分交给 mustParse 检查
  const [, operator = '', rest = ''] = /^(>=|<=|>|<|=|\^|~)?(.*)$/.exec(token) ?? [];
  const written = mustParse(rest);
  const from = (version: Version) => compareVersions(version, written);
  switch (operator) {
    case '>':
      return { written, test: (v) => from(v) > 0 };
    case '>=':
      return { written, test: (v) => from(v) >= 0 };
    case '<':
      return { written, test: (v) => from(v) < 0 };
    case '<=':
      return { written, test: (v) => from(v) <= 0 };
    case '^': {
      const upper = caretUpper(written);
      return { written, test: (v) => from(v) >= 0 && compareVersions(v, upper) < 0 };
    }
    case '~': {
      const upper = caretUpper(written);
      return { written, test: (v) => from(v) >= 0 && compareVersions(v, upper) < 0 };
    }
    default: // 没有运算符，或者 =
      return { written, test: (v) => from(v) === 0 };
  }
}

function parseSet(part: string, range: string): Comparator[] {
  const text = part.trim();
  if (text === '') throw new Error(`范围中有空的一组：${range}`);
  return text.split(/\s+/).map(parseComparator);
}

/** 预发布规则：这一组中有条件写出了同一个 主.次.修订 的预发布版本 */
function allowsPrerelease(comparators: Comparator[], version: Version): boolean {
  return comparators.some(
    ({ written }) =>
      written !== null &&
      written.prerelease.length > 0 &&
      written.major === version.major &&
      written.minor === version.minor &&
      written.patch === version.patch,
  );
}

export function satisfies(version: string, range: string): boolean {
  const target = mustParse(version);
  // 先完整解析整个范围：任何一部分写错都抛出错误
  const sets = range.trim() === '' ? [[parseComparator('*')]] : range.split('||').map((part) => parseSet(part, range));
  return sets.some(
    (comparators) =>
      comparators.every((c) => c.test(target)) && (target.prerelease.length === 0 || allowsPrerelease(comparators, target)),
  );
}
```
:::

:::variant{kind=wrong name=no-prerelease-rule fails=tests reason="没有预发布规则：1.2.3-beta.1 被当成满足 ^1.2.0"}
```ts file=ranges.ts
import { compareVersions, parseVersion, type Version } from './semver';

/** 一个条件：写出的版本（* 没有），以及判断一个版本是否满足它的函数 */
type Comparator = { written: Version | null; test: (version: Version) => boolean };

function mustParse(text: string): Version {
  const version = parseVersion(text);
  if (version === null) throw new Error(`无效的版本：${text}`);
  return version;
}

/** ^ 的上限：最左边非零的那一位加一，右边各位清零 */
function caretUpper({ major, minor, patch }: Version): Version {
  if (major > 0) return { major: major + 1, minor: 0, patch: 0, prerelease: [] };
  if (minor > 0) return { major: 0, minor: minor + 1, patch: 0, prerelease: [] };
  return { major: 0, minor: 0, patch: patch + 1, prerelease: [] };
}

/** ~ 的上限：次版本加一，修订号清零 */
function tildeUpper({ major, minor }: Version): Version {
  return { major, minor: minor + 1, patch: 0, prerelease: [] };
}

function parseComparator(token: string): Comparator {
  if (token === '*') return { written: null, test: () => true };
  // 这个正则总能匹配：运算符可以没有，其余部分交给 mustParse 检查
  const [, operator = '', rest = ''] = /^(>=|<=|>|<|=|\^|~)?(.*)$/.exec(token) ?? [];
  const written = mustParse(rest);
  const from = (version: Version) => compareVersions(version, written);
  switch (operator) {
    case '>':
      return { written, test: (v) => from(v) > 0 };
    case '>=':
      return { written, test: (v) => from(v) >= 0 };
    case '<':
      return { written, test: (v) => from(v) < 0 };
    case '<=':
      return { written, test: (v) => from(v) <= 0 };
    case '^': {
      const upper = caretUpper(written);
      return { written, test: (v) => from(v) >= 0 && compareVersions(v, upper) < 0 };
    }
    case '~': {
      const upper = tildeUpper(written);
      return { written, test: (v) => from(v) >= 0 && compareVersions(v, upper) < 0 };
    }
    default: // 没有运算符，或者 =
      return { written, test: (v) => from(v) === 0 };
  }
}

function parseSet(part: string, range: string): Comparator[] {
  const text = part.trim();
  if (text === '') throw new Error(`范围中有空的一组：${range}`);
  return text.split(/\s+/).map(parseComparator);
}

/** 预发布规则：这一组中有条件写出了同一个 主.次.修订 的预发布版本 */
function allowsPrerelease(comparators: Comparator[], version: Version): boolean {
  return comparators.some(
    ({ written }) =>
      written !== null &&
      written.prerelease.length > 0 &&
      written.major === version.major &&
      written.minor === version.minor &&
      written.patch === version.patch,
  );
}

export function satisfies(version: string, range: string): boolean {
  const target = mustParse(version);
  // 先完整解析整个范围：任何一部分写错都抛出错误
  const sets = range.trim() === '' ? [[parseComparator('*')]] : range.split('||').map((part) => parseSet(part, range));
  return sets.some(
    (comparators) =>
      comparators.every((c) => c.test(target)),
  );
}
```
:::

:::variant{kind=wrong name=prerelease-rule-whole-range fails=tests reason="预发布规则在整个范围中检查，而不是在满足的那一组中：另一组写出的预发布版本让 >=1.0.0 也接受了预发布版本"}
```ts file=ranges.ts
import { compareVersions, parseVersion, type Version } from './semver';

/** 一个条件：写出的版本（* 没有），以及判断一个版本是否满足它的函数 */
type Comparator = { written: Version | null; test: (version: Version) => boolean };

function mustParse(text: string): Version {
  const version = parseVersion(text);
  if (version === null) throw new Error(`无效的版本：${text}`);
  return version;
}

/** ^ 的上限：最左边非零的那一位加一，右边各位清零 */
function caretUpper({ major, minor, patch }: Version): Version {
  if (major > 0) return { major: major + 1, minor: 0, patch: 0, prerelease: [] };
  if (minor > 0) return { major: 0, minor: minor + 1, patch: 0, prerelease: [] };
  return { major: 0, minor: 0, patch: patch + 1, prerelease: [] };
}

/** ~ 的上限：次版本加一，修订号清零 */
function tildeUpper({ major, minor }: Version): Version {
  return { major, minor: minor + 1, patch: 0, prerelease: [] };
}

function parseComparator(token: string): Comparator {
  if (token === '*') return { written: null, test: () => true };
  // 这个正则总能匹配：运算符可以没有，其余部分交给 mustParse 检查
  const [, operator = '', rest = ''] = /^(>=|<=|>|<|=|\^|~)?(.*)$/.exec(token) ?? [];
  const written = mustParse(rest);
  const from = (version: Version) => compareVersions(version, written);
  switch (operator) {
    case '>':
      return { written, test: (v) => from(v) > 0 };
    case '>=':
      return { written, test: (v) => from(v) >= 0 };
    case '<':
      return { written, test: (v) => from(v) < 0 };
    case '<=':
      return { written, test: (v) => from(v) <= 0 };
    case '^': {
      const upper = caretUpper(written);
      return { written, test: (v) => from(v) >= 0 && compareVersions(v, upper) < 0 };
    }
    case '~': {
      const upper = tildeUpper(written);
      return { written, test: (v) => from(v) >= 0 && compareVersions(v, upper) < 0 };
    }
    default: // 没有运算符，或者 =
      return { written, test: (v) => from(v) === 0 };
  }
}

function parseSet(part: string, range: string): Comparator[] {
  const text = part.trim();
  if (text === '') throw new Error(`范围中有空的一组：${range}`);
  return text.split(/\s+/).map(parseComparator);
}

/** 预发布规则：这一组中有条件写出了同一个 主.次.修订 的预发布版本 */
function allowsPrerelease(comparators: Comparator[], version: Version): boolean {
  return comparators.some(
    ({ written }) =>
      written !== null &&
      written.prerelease.length > 0 &&
      written.major === version.major &&
      written.minor === version.minor &&
      written.patch === version.patch,
  );
}

export function satisfies(version: string, range: string): boolean {
  const target = mustParse(version);
  // 先完整解析整个范围：任何一部分写错都抛出错误
  const sets = range.trim() === '' ? [[parseComparator('*')]] : range.split('||').map((part) => parseSet(part, range));
  const allowed = target.prerelease.length === 0 || sets.some((comparators) => allowsPrerelease(comparators, target));
  return allowed && sets.some((comparators) => comparators.every((c) => c.test(target)));
}
```
:::

:::variant{kind=wrong name=lazy-parse fails=tests reason="边解析边判断：前面的组满足之后，后面写错的组没有被检查，^1.0.0 || ^2 没有抛出错误"}
```ts file=ranges.ts
import { compareVersions, parseVersion, type Version } from './semver';

/** 一个条件：写出的版本（* 没有），以及判断一个版本是否满足它的函数 */
type Comparator = { written: Version | null; test: (version: Version) => boolean };

function mustParse(text: string): Version {
  const version = parseVersion(text);
  if (version === null) throw new Error(`无效的版本：${text}`);
  return version;
}

/** ^ 的上限：最左边非零的那一位加一，右边各位清零 */
function caretUpper({ major, minor, patch }: Version): Version {
  if (major > 0) return { major: major + 1, minor: 0, patch: 0, prerelease: [] };
  if (minor > 0) return { major: 0, minor: minor + 1, patch: 0, prerelease: [] };
  return { major: 0, minor: 0, patch: patch + 1, prerelease: [] };
}

/** ~ 的上限：次版本加一，修订号清零 */
function tildeUpper({ major, minor }: Version): Version {
  return { major, minor: minor + 1, patch: 0, prerelease: [] };
}

function parseComparator(token: string): Comparator {
  if (token === '*') return { written: null, test: () => true };
  // 这个正则总能匹配：运算符可以没有，其余部分交给 mustParse 检查
  const [, operator = '', rest = ''] = /^(>=|<=|>|<|=|\^|~)?(.*)$/.exec(token) ?? [];
  const written = mustParse(rest);
  const from = (version: Version) => compareVersions(version, written);
  switch (operator) {
    case '>':
      return { written, test: (v) => from(v) > 0 };
    case '>=':
      return { written, test: (v) => from(v) >= 0 };
    case '<':
      return { written, test: (v) => from(v) < 0 };
    case '<=':
      return { written, test: (v) => from(v) <= 0 };
    case '^': {
      const upper = caretUpper(written);
      return { written, test: (v) => from(v) >= 0 && compareVersions(v, upper) < 0 };
    }
    case '~': {
      const upper = tildeUpper(written);
      return { written, test: (v) => from(v) >= 0 && compareVersions(v, upper) < 0 };
    }
    default: // 没有运算符，或者 =
      return { written, test: (v) => from(v) === 0 };
  }
}

function parseSet(part: string, range: string): Comparator[] {
  const text = part.trim();
  if (text === '') throw new Error(`范围中有空的一组：${range}`);
  return text.split(/\s+/).map(parseComparator);
}

/** 预发布规则：这一组中有条件写出了同一个 主.次.修订 的预发布版本 */
function allowsPrerelease(comparators: Comparator[], version: Version): boolean {
  return comparators.some(
    ({ written }) =>
      written !== null &&
      written.prerelease.length > 0 &&
      written.major === version.major &&
      written.minor === version.minor &&
      written.patch === version.patch,
  );
}

export function satisfies(version: string, range: string): boolean {
  const target = mustParse(version);
  // 边检查边解析：前面的组满足之后，后面的组不再解析，写错了也发现不了
  const parts = range.trim() === '' ? ['*'] : range.split('||');
  return parts.some((part) => {
    const comparators = parseSet(part, range);
    return comparators.every((c) => c.test(target)) && (target.prerelease.length === 0 || allowsPrerelease(comparators, target));
  });
}
```
:::

:::variant{kind=wrong name=or-as-and fails=tests reason="把 || 当成“全部满足”：^1.0.0 || ^3.0.0 不接受任何版本"}
```ts file=ranges.ts
import { compareVersions, parseVersion, type Version } from './semver';

/** 一个条件：写出的版本（* 没有），以及判断一个版本是否满足它的函数 */
type Comparator = { written: Version | null; test: (version: Version) => boolean };

function mustParse(text: string): Version {
  const version = parseVersion(text);
  if (version === null) throw new Error(`无效的版本：${text}`);
  return version;
}

/** ^ 的上限：最左边非零的那一位加一，右边各位清零 */
function caretUpper({ major, minor, patch }: Version): Version {
  if (major > 0) return { major: major + 1, minor: 0, patch: 0, prerelease: [] };
  if (minor > 0) return { major: 0, minor: minor + 1, patch: 0, prerelease: [] };
  return { major: 0, minor: 0, patch: patch + 1, prerelease: [] };
}

/** ~ 的上限：次版本加一，修订号清零 */
function tildeUpper({ major, minor }: Version): Version {
  return { major, minor: minor + 1, patch: 0, prerelease: [] };
}

function parseComparator(token: string): Comparator {
  if (token === '*') return { written: null, test: () => true };
  // 这个正则总能匹配：运算符可以没有，其余部分交给 mustParse 检查
  const [, operator = '', rest = ''] = /^(>=|<=|>|<|=|\^|~)?(.*)$/.exec(token) ?? [];
  const written = mustParse(rest);
  const from = (version: Version) => compareVersions(version, written);
  switch (operator) {
    case '>':
      return { written, test: (v) => from(v) > 0 };
    case '>=':
      return { written, test: (v) => from(v) >= 0 };
    case '<':
      return { written, test: (v) => from(v) < 0 };
    case '<=':
      return { written, test: (v) => from(v) <= 0 };
    case '^': {
      const upper = caretUpper(written);
      return { written, test: (v) => from(v) >= 0 && compareVersions(v, upper) < 0 };
    }
    case '~': {
      const upper = tildeUpper(written);
      return { written, test: (v) => from(v) >= 0 && compareVersions(v, upper) < 0 };
    }
    default: // 没有运算符，或者 =
      return { written, test: (v) => from(v) === 0 };
  }
}

function parseSet(part: string, range: string): Comparator[] {
  const text = part.trim();
  if (text === '') throw new Error(`范围中有空的一组：${range}`);
  return text.split(/\s+/).map(parseComparator);
}

/** 预发布规则：这一组中有条件写出了同一个 主.次.修订 的预发布版本 */
function allowsPrerelease(comparators: Comparator[], version: Version): boolean {
  return comparators.some(
    ({ written }) =>
      written !== null &&
      written.prerelease.length > 0 &&
      written.major === version.major &&
      written.minor === version.minor &&
      written.patch === version.patch,
  );
}

export function satisfies(version: string, range: string): boolean {
  const target = mustParse(version);
  // 先完整解析整个范围：任何一部分写错都抛出错误
  const sets = range.trim() === '' ? [[parseComparator('*')]] : range.split('||').map((part) => parseSet(part, range));
  return sets.every(
    (comparators) =>
      comparators.every((c) => c.test(target)) && (target.prerelease.length === 0 || allowsPrerelease(comparators, target)),
  );
}
```
:::
