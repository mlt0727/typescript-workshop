---
kind: task
title: 解析并比较语义化版本
---
npm 判断“哪个版本更新”时，用的是语义化版本的规则，而不是字符串比较。在 `semver.ts` 中实现两个函数（规则来自 Semantic Versioning 2.0.0）。

**`parseVersion(text)`**：解析一个完整的版本号，格式不正确时返回 `null`。

- `主版本.次版本.修订号` 三个部分都必须有，每个都是十进制的非负整数，**不能有前导零**（`0` 可以，`01` 不行）；
- 后面可以有 `-预发布标签`：用 `.` 分隔的一个或多个标识符，每个标识符非空，只能包含 ASCII 字母、数字和 `-`。纯数字的标识符不能有前导零，并且转换成 `number`；其他的保留为字符串（例如 `0a`、`x-1`）；
- 最后可以有 `+构建信息`：用 `.` 分隔的一个或多个非空标识符（ASCII 字母、数字和 `-`，可以有前导零）。构建信息**不影响版本的先后**，解析后丢弃；
- 不允许任何其他字符：不能以 `v` 开头，前后不能有空白。

**`compareVersions(a, b)`**：`a` 排在 `b` 前面时返回 `-1`，相同时返回 `0`，排在后面时返回 `1`，可以直接用作 `toSorted` 的比较函数。

1. 依次按数值比较主版本、次版本、修订号；
2. 这三个都相同时，没有预发布标签的版本更大（`1.0.0-rc.1` 排在 `1.0.0` 前面）；
3. 都有预发布标签时，从左到右逐个比较标识符：两个数字按数值比较；两个字符串按字符的编码逐个比较（JavaScript 的 `<` 就是这样比较字符串的，所以 `'B' < 'a'`）；数字总是比字符串小；前面的标识符都相同时，标识符多的更大（`alpha` 排在 `alpha.1` 前面）。

:::files{role=starter}
```ts file=semver.ts
/** 预发布标签中的一个标识符：纯数字的是 number，其他的是 string */
export type Identifier = string | number;

export type Version = {
  major: number;
  minor: number;
  patch: number;
  prerelease: Identifier[];
};

export function parseVersion(text: string): Version | null {
  return null;
}

export function compareVersions(a: Version, b: Version): -1 | 0 | 1 {
  return 0;
}
```
```ts file=main.ts
import { compareVersions, parseVersion } from './semver';

console.log(parseVersion('1.0.0-alpha.1+exp.sha.5114f85'));
console.log(parseVersion('01.2.3'));

const texts = ['1.2.10', '1.0.0', '1.2.3', '1.0.0-rc.1', '1.0.0-beta.11', '1.0.0-beta.2'];
const sorted = texts
  .flatMap((text) => {
    const version = parseVersion(text);
    return version === null ? [] : [{ text, version }];
  })
  .toSorted((a, b) => compareVersions(a.version, b.version))
  .map((item) => item.text);
console.log(sorted);
```
:::

:::files{role=solution}
```ts file=semver.ts
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
```ts file=main.ts
import { compareVersions, parseVersion } from './semver';

console.log(parseVersion('1.0.0-alpha.1+exp.sha.5114f85'));
console.log(parseVersion('01.2.3'));

const texts = ['1.2.10', '1.0.0', '1.2.3', '1.0.0-rc.1', '1.0.0-beta.11', '1.0.0-beta.2'];
const sorted = texts
  .flatMap((text) => {
    const version = parseVersion(text);
    return version === null ? [] : [{ text, version }];
  })
  .toSorted((a, b) => compareVersions(a.version, b.version))
  .map((item) => item.text);
console.log(sorted);
```
:::

:::files{role=tests}
```ts file=semver.test.ts
import { describe, expect, test } from 'vitest';
import { compareVersions, parseVersion, type Version } from './semver';

function v(text: string): Version {
  const version = parseVersion(text);
  if (version === null) throw new Error(`没有解析出 ${text}`);
  return version;
}

describe('parseVersion', () => {
  test('三个数字', () => {
    expect(parseVersion('1.2.3')).toEqual({ major: 1, minor: 2, patch: 3, prerelease: [] });
    expect(parseVersion('0.0.0')).toEqual({ major: 0, minor: 0, patch: 0, prerelease: [] });
    expect(parseVersion('10.20.30')).toEqual({ major: 10, minor: 20, patch: 30, prerelease: [] });
  });

  test('预发布标签：纯数字的标识符是 number', () => {
    expect(parseVersion('1.0.0-alpha.1')).toEqual({ major: 1, minor: 0, patch: 0, prerelease: ['alpha', 1] });
    expect(parseVersion('1.0.0-0a.10')).toEqual({ major: 1, minor: 0, patch: 0, prerelease: ['0a', 10] });
    expect(parseVersion('1.0.0-x-y-z.--')).toEqual({ major: 1, minor: 0, patch: 0, prerelease: ['x-y-z', '--'] });
    expect(parseVersion('2.0.0-0')).toEqual({ major: 2, minor: 0, patch: 0, prerelease: [0] });
  });

  test('构建信息被丢弃', () => {
    expect(parseVersion('1.0.0-alpha.1+exp.sha.5114f85')).toEqual({ major: 1, minor: 0, patch: 0, prerelease: ['alpha', 1] });
    expect(parseVersion('1.0.0+001')).toEqual({ major: 1, minor: 0, patch: 0, prerelease: [] });
    expect(parseVersion('1.0.0+build-7.x')).toEqual({ major: 1, minor: 0, patch: 0, prerelease: [] });
  });

  test('格式不正确时返回 null', () => {
    const invalid = [
      '', '1', '1.2', '1.2.3.4', '1..3', 'a.b.c', 'v1.2.3', ' 1.2.3', '1.2.3 ', '1.2.-3',
      '01.2.3', '1.02.3', '1.2.03', '1.2.3-', '1.2.3-alpha..1', '1.2.3-01', '1.2.3-alpha.01',
      '1.2.3-alpha_1', '1.2.3+', '1.2.3+build..1', '1.2.3+a+b',
    ];
    for (const text of invalid) expect(parseVersion(text), text).toBeNull();
  });
});

describe('compareVersions', () => {
  test('按数值比较，不是按字符串', () => {
    expect(compareVersions(v('1.2.3'), v('1.2.10'))).toBe(-1);
    expect(compareVersions(v('1.10.0'), v('1.9.9'))).toBe(1);
    expect(compareVersions(v('2.0.0'), v('10.0.0'))).toBe(-1);
    expect(compareVersions(v('1.2.3'), v('1.2.3'))).toBe(0);
  });

  test('构建信息不影响先后', () => {
    expect(compareVersions(v('1.2.3+build.5'), v('1.2.3'))).toBe(0);
  });

  test('预发布版本排在正式版本前面', () => {
    expect(compareVersions(v('1.0.0-alpha'), v('1.0.0'))).toBe(-1);
    expect(compareVersions(v('1.0.0'), v('1.0.0-rc.1'))).toBe(1);
    expect(compareVersions(v('1.0.0-rc.1'), v('0.9.9'))).toBe(1);
  });

  test('预发布标识符：数字按数值，字符串按编码，数字比字符串小，多的更大', () => {
    expect(compareVersions(v('1.0.0-2'), v('1.0.0-10'))).toBe(-1);
    expect(compareVersions(v('1.0.0-beta.2'), v('1.0.0-beta.11'))).toBe(-1);
    expect(compareVersions(v('1.0.0-a10'), v('1.0.0-a9'))).toBe(-1);
    expect(compareVersions(v('1.0.0-B'), v('1.0.0-a'))).toBe(-1);
    expect(compareVersions(v('1.0.0-alpha.1'), v('1.0.0-alpha.beta'))).toBe(-1);
    expect(compareVersions(v('1.0.0-0a'), v('1.0.0-0'))).toBe(1);
    expect(compareVersions(v('1.0.0-alpha'), v('1.0.0-alpha.1'))).toBe(-1);
    expect(compareVersions(v('1.0.0-x.1.0'), v('1.0.0-x.1'))).toBe(1);
    expect(compareVersions(v('1.0.0-alpha'), v('1.0.0-alpha-1'))).toBe(-1);
    expect(compareVersions(v('1.0.0-rc.1'), v('1.0.0-rc.1+build.2'))).toBe(0);
  });

  test('可以直接用来排序（语义化版本规范中的例子）', () => {
    const order = ['1.0.0-alpha', '1.0.0-alpha.1', '1.0.0-alpha.beta', '1.0.0-beta', '1.0.0-beta.2', '1.0.0-beta.11', '1.0.0-rc.1', '1.0.0'];
    const shuffled = ['1.0.0-beta.11', '1.0.0', '1.0.0-alpha.beta', '1.0.0-rc.1', '1.0.0-alpha', '1.0.0-beta', '1.0.0-alpha.1', '1.0.0-beta.2'];
    expect(shuffled.map(v).toSorted(compareVersions)).toEqual(order.map(v));

    const versions = order.map(v);
    versions.forEach((a, i) => {
      versions.forEach((b, j) => {
        expect(compareVersions(a, b), `${order[i]} 与 ${order[j]}`).toBe(Math.sign(i - j));
      });
    });
  });
});
```
```ts file=semver.test-d.ts
import { expectTypeOf } from 'vitest';
import { compareVersions, parseVersion, type Version } from './semver';

expectTypeOf(parseVersion).returns.toEqualTypeOf<Version | null>();
expectTypeOf(compareVersions).returns.toEqualTypeOf<-1 | 0 | 1>();
expectTypeOf<Version['prerelease']>().toEqualTypeOf<(string | number)[]>();
```
:::

:::hint{level=1}
先把字符串切成三段：`+` 之后是构建信息（检查格式后丢掉），剩下部分中第一个 `-` 之后是预发布标签，再前面是 `主.次.修订`。每段再用 `split('.')` 分成标识符，用正则检查：没有前导零的整数是 `/^(?:0|[1-9]\d*)$/`，标识符是 `/^[0-9A-Za-z-]+$/`。
:::

:::hint{level=2}
`compareVersions`：先比较三个数字，可以写一个 `sign(n)` 把差值变成 `-1 | 0 | 1`，然后 `sign(a.major - b.major) || sign(a.minor - b.minor) || …`（`0` 是假值，所以 `||` 会继续比较下一位）。三个数字相同时，先处理“有没有预发布标签”，再逐个比较标识符：用 `typeof` 区分数字和字符串，字符串直接用 `<`、`>` 比较。
:::

:::explanation
**为什么不能按字符串比较**：字符串是逐个字符比较的，`'1.2.10' < '1.2.3'`（因为 `'1' < '3'`），`'10.0.0' < '2.0.0'`。版本号的每一段都要转换成数字再比较。

**预发布标签**的规则看起来零碎，其实都有原因：

- 没有预发布标签的版本更大：`2.0.0-rc.1` 是 `2.0.0` 发布之前的测试版；
- 纯数字的标识符按数值比较，所以 `beta.2` < `beta.11`。这就是解析时把它们转换成 `number` 的原因：类型 `Identifier = string | number` 记录了“这是哪一种标识符”，比较时用 `typeof` 就能区分；
- 数字比字符串小、标识符多的更大：规范中的例子 `alpha < alpha.1 < alpha.beta < beta < beta.2 < beta.11 < rc.1 < 1.0.0` 就是这两条规则的结果；
- 字符串按字符编码比较（`'B' < 'a'`），而不是 `localeCompare`：版本的顺序不能随用户的语言环境变化。

**前导零**：`01.2.3` 不是有效的版本，否则 `1.2.3` 和 `01.2.3` 就成了两种写法的同一个版本。构建信息不受这个限制，因为它不参与比较。

返回类型写成 `-1 | 0 | 1` 而不是 `number`，调用方就知道只有三种结果；`sign` 函数的返回类型保证了这一点，`a || b || c` 的类型也仍然是 `-1 | 0 | 1`。

真实的项目中直接用 npm 自己使用的 [`semver`](https://github.com/npm/node-semver) 包（`semver.compare`、`semver.valid`），这个练习的规则与它一致。
:::

:::variant{kind=alt name=regex-and-loop}
```ts file=semver.ts
/** 预发布标签中的一个标识符：纯数字的是 number，其他的是 string */
export type Identifier = string | number;

export type Version = {
  major: number;
  minor: number;
  patch: number;
  prerelease: Identifier[];
};

const ID = '[0-9A-Za-z-]+';
const NUM = '0|[1-9]\\d*';
const VERSION = new RegExp(`^(${NUM})\\.(${NUM})\\.(${NUM})(?:-(${ID}(?:\\.${ID})*))?(?:\\+${ID}(?:\\.${ID})*)?$`);

export function parseVersion(text: string): Version | null {
  const match = VERSION.exec(text);
  if (match === null) return null;
  const [, major, minor, patch, pre] = match;
  const ids = pre === undefined ? [] : pre.split('.');
  if (ids.some((id) => /^0\d+$/.test(id))) return null;
  return {
    major: Number(major),
    minor: Number(minor),
    patch: Number(patch),
    prerelease: ids.map((id) => (/^\d+$/.test(id) ? Number(id) : id)),
  };
}

export function compareVersions(a: Version, b: Version): -1 | 0 | 1 {
  const pairs: [number, number][] = [[a.major, b.major], [a.minor, b.minor], [a.patch, b.patch]];
  for (const [x, y] of pairs) if (x !== y) return x < y ? -1 : 1;

  if (a.prerelease.length === 0 || b.prerelease.length === 0) {
    if (a.prerelease.length === b.prerelease.length) return 0;
    return a.prerelease.length === 0 ? 1 : -1;
  }
  const length = Math.max(a.prerelease.length, b.prerelease.length);
  for (let i = 0; i < length; i++) {
    const x = a.prerelease[i];
    const y = b.prerelease[i];
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    if (x === y) continue;
    if (typeof x === 'number' && typeof y === 'number') return x < y ? -1 : 1;
    if (typeof x === 'string' && typeof y === 'string') return x < y ? -1 : 1;
    return typeof x === 'number' ? -1 : 1;
  }
  return 0;
}
```
:::

:::variant{kind=wrong name=string-compare fails=tests reason="把三个数字拼成字符串再比较：'1.2.10' 排在 '1.2.3' 前面"}
```ts file=semver.ts
export type Identifier = string | number;

export type Version = {
  major: number;
  minor: number;
  patch: number;
  prerelease: Identifier[];
};

const NUMERIC = /^(?:0|[1-9]\d*)$/;
const IDENTIFIER = /^[0-9A-Za-z-]+$/;

function identifiers(text: string): string[] | null {
  const ids = text.split('.');
  return ids.every((id) => IDENTIFIER.test(id)) ? ids : null;
}

export function parseVersion(text: string): Version | null {
  const plus = text.indexOf('+');
  if (plus !== -1 && identifiers(text.slice(plus + 1)) === null) return null;
  const main = plus === -1 ? text : text.slice(0, plus);
  const dash = main.indexOf('-');
  const core = dash === -1 ? main : main.slice(0, dash);
  const pre = dash === -1 ? [] : identifiers(main.slice(dash + 1));
  if (pre === null) return null;
  const numbers = core.split('.');
  if (numbers.length !== 3 || !numbers.every((n) => NUMERIC.test(n))) return null;
  const [major = 0, minor = 0, patch = 0] = numbers.map(Number);
  const prerelease: Identifier[] = [];
  for (const id of pre) {
    if (!/^\d+$/.test(id)) prerelease.push(id);
    else if (NUMERIC.test(id)) prerelease.push(Number(id));
    else return null;
  }
  return { major, minor, patch, prerelease };
}

function compareIdentifiers(a: Identifier, b: Identifier): -1 | 0 | 1 {
  if (typeof a === 'number' && typeof b === 'number') return a < b ? -1 : a > b ? 1 : 0;
  if (typeof a === 'number') return -1;
  if (typeof b === 'number') return 1;
  return a < b ? -1 : a > b ? 1 : 0;
}

export function compareVersions(a: Version, b: Version): -1 | 0 | 1 {
  const ca = `${a.major}.${a.minor}.${a.patch}`;
  const cb = `${b.major}.${b.minor}.${b.patch}`;
  if (ca !== cb) return ca < cb ? -1 : 1;
  const pa = a.prerelease;
  const pb = b.prerelease;
  if (pa.length === 0 && pb.length === 0) return 0;
  if (pa.length === 0) return 1;
  if (pb.length === 0) return -1;
  for (const [i, id] of pa.entries()) {
    const other = pb[i];
    if (other === undefined) return 1;
    const result = compareIdentifiers(id, other);
    if (result !== 0) return result;
  }
  return pa.length < pb.length ? -1 : 0;
}
```
:::

:::variant{kind=wrong name=ignore-prerelease fails=tests reason="只比较三个数字：1.0.0-alpha 和 1.0.0 被当成同一个版本"}
```ts file=semver.ts
export type Identifier = string | number;

export type Version = {
  major: number;
  minor: number;
  patch: number;
  prerelease: Identifier[];
};

const NUMERIC = /^(?:0|[1-9]\d*)$/;
const IDENTIFIER = /^[0-9A-Za-z-]+$/;

function identifiers(text: string): string[] | null {
  const ids = text.split('.');
  return ids.every((id) => IDENTIFIER.test(id)) ? ids : null;
}

export function parseVersion(text: string): Version | null {
  const plus = text.indexOf('+');
  if (plus !== -1 && identifiers(text.slice(plus + 1)) === null) return null;
  const main = plus === -1 ? text : text.slice(0, plus);
  const dash = main.indexOf('-');
  const core = dash === -1 ? main : main.slice(0, dash);
  const pre = dash === -1 ? [] : identifiers(main.slice(dash + 1));
  if (pre === null) return null;
  const numbers = core.split('.');
  if (numbers.length !== 3 || !numbers.every((n) => NUMERIC.test(n))) return null;
  const [major = 0, minor = 0, patch = 0] = numbers.map(Number);
  const prerelease: Identifier[] = [];
  for (const id of pre) {
    if (!/^\d+$/.test(id)) prerelease.push(id);
    else if (NUMERIC.test(id)) prerelease.push(Number(id));
    else return null;
  }
  return { major, minor, patch, prerelease };
}

const sign = (n: number): -1 | 0 | 1 => (n < 0 ? -1 : n > 0 ? 1 : 0);

export function compareVersions(a: Version, b: Version): -1 | 0 | 1 {
  return sign(a.major - b.major) || sign(a.minor - b.minor) || sign(a.patch - b.patch);
}
```
:::

:::variant{kind=wrong name=numeric-ids-as-strings fails=tests reason="预发布标识符都按字符串比较：beta.11 排在 beta.2 前面"}
```ts file=semver.ts
export type Identifier = string | number;

export type Version = {
  major: number;
  minor: number;
  patch: number;
  prerelease: Identifier[];
};

const NUMERIC = /^(?:0|[1-9]\d*)$/;
const IDENTIFIER = /^[0-9A-Za-z-]+$/;

function identifiers(text: string): string[] | null {
  const ids = text.split('.');
  return ids.every((id) => IDENTIFIER.test(id)) ? ids : null;
}

export function parseVersion(text: string): Version | null {
  const plus = text.indexOf('+');
  if (plus !== -1 && identifiers(text.slice(plus + 1)) === null) return null;
  const main = plus === -1 ? text : text.slice(0, plus);
  const dash = main.indexOf('-');
  const core = dash === -1 ? main : main.slice(0, dash);
  const pre = dash === -1 ? [] : identifiers(main.slice(dash + 1));
  if (pre === null) return null;
  const numbers = core.split('.');
  if (numbers.length !== 3 || !numbers.every((n) => NUMERIC.test(n))) return null;
  const [major = 0, minor = 0, patch = 0] = numbers.map(Number);
  const prerelease: Identifier[] = [];
  for (const id of pre) {
    if (!/^\d+$/.test(id)) prerelease.push(id);
    else if (NUMERIC.test(id)) prerelease.push(Number(id));
    else return null;
  }
  return { major, minor, patch, prerelease };
}

const sign = (n: number): -1 | 0 | 1 => (n < 0 ? -1 : n > 0 ? 1 : 0);

export function compareVersions(a: Version, b: Version): -1 | 0 | 1 {
  const core = sign(a.major - b.major) || sign(a.minor - b.minor) || sign(a.patch - b.patch);
  if (core !== 0) return core;
  const pa = a.prerelease;
  const pb = b.prerelease;
  if (pa.length === 0 && pb.length === 0) return 0;
  if (pa.length === 0) return 1;
  if (pb.length === 0) return -1;
  for (const [i, id] of pa.entries()) {
    const other = pb[i];
    if (other === undefined) return 1;
    const x = String(id);
    const y = String(other);
    if (x !== y) return x < y ? -1 : 1;
  }
  return pa.length < pb.length ? -1 : 0;
}
```
:::

:::variant{kind=wrong name=leading-zeros fails=tests reason="用 /^\d+$/ 检查数字：01.2.3 和 1.2.3-01 也被当成有效的版本"}
```ts file=semver.ts
export type Identifier = string | number;

export type Version = {
  major: number;
  minor: number;
  patch: number;
  prerelease: Identifier[];
};

const IDENTIFIER = /^[0-9A-Za-z-]+$/;

function identifiers(text: string): string[] | null {
  const ids = text.split('.');
  return ids.every((id) => IDENTIFIER.test(id)) ? ids : null;
}

export function parseVersion(text: string): Version | null {
  const plus = text.indexOf('+');
  if (plus !== -1 && identifiers(text.slice(plus + 1)) === null) return null;
  const main = plus === -1 ? text : text.slice(0, plus);
  const dash = main.indexOf('-');
  const core = dash === -1 ? main : main.slice(0, dash);
  const pre = dash === -1 ? [] : identifiers(main.slice(dash + 1));
  if (pre === null) return null;
  const numbers = core.split('.');
  if (numbers.length !== 3 || !numbers.every((n) => /^\d+$/.test(n))) return null;
  const [major = 0, minor = 0, patch = 0] = numbers.map(Number);
  const prerelease = pre.map((id) => (/^\d+$/.test(id) ? Number(id) : id));
  return { major, minor, patch, prerelease };
}

const sign = (n: number): -1 | 0 | 1 => (n < 0 ? -1 : n > 0 ? 1 : 0);

function compareIdentifiers(a: Identifier, b: Identifier): -1 | 0 | 1 {
  if (typeof a === 'number' && typeof b === 'number') return sign(a - b);
  if (typeof a === 'number') return -1;
  if (typeof b === 'number') return 1;
  return a < b ? -1 : a > b ? 1 : 0;
}

export function compareVersions(a: Version, b: Version): -1 | 0 | 1 {
  const core = sign(a.major - b.major) || sign(a.minor - b.minor) || sign(a.patch - b.patch);
  if (core !== 0) return core;
  const pa = a.prerelease;
  const pb = b.prerelease;
  if (pa.length === 0 && pb.length === 0) return 0;
  if (pa.length === 0) return 1;
  if (pb.length === 0) return -1;
  for (const [i, id] of pa.entries()) {
    const other = pb[i];
    if (other === undefined) return 1;
    const result = compareIdentifiers(id, other);
    if (result !== 0) return result;
  }
  return pa.length < pb.length ? -1 : 0;
}
```
:::

:::variant{kind=wrong name=locale-compare fails=tests reason="用 localeCompare 比较字符串标识符：结果随语言环境变化，'B' 排在了 'a' 后面"}
```ts file=semver.ts
export type Identifier = string | number;

export type Version = {
  major: number;
  minor: number;
  patch: number;
  prerelease: Identifier[];
};

const NUMERIC = /^(?:0|[1-9]\d*)$/;
const IDENTIFIER = /^[0-9A-Za-z-]+$/;

function identifiers(text: string): string[] | null {
  const ids = text.split('.');
  return ids.every((id) => IDENTIFIER.test(id)) ? ids : null;
}

export function parseVersion(text: string): Version | null {
  const plus = text.indexOf('+');
  if (plus !== -1 && identifiers(text.slice(plus + 1)) === null) return null;
  const main = plus === -1 ? text : text.slice(0, plus);
  const dash = main.indexOf('-');
  const core = dash === -1 ? main : main.slice(0, dash);
  const pre = dash === -1 ? [] : identifiers(main.slice(dash + 1));
  if (pre === null) return null;
  const numbers = core.split('.');
  if (numbers.length !== 3 || !numbers.every((n) => NUMERIC.test(n))) return null;
  const [major = 0, minor = 0, patch = 0] = numbers.map(Number);
  const prerelease: Identifier[] = [];
  for (const id of pre) {
    if (!/^\d+$/.test(id)) prerelease.push(id);
    else if (NUMERIC.test(id)) prerelease.push(Number(id));
    else return null;
  }
  return { major, minor, patch, prerelease };
}

const sign = (n: number): -1 | 0 | 1 => (n < 0 ? -1 : n > 0 ? 1 : 0);

function compareIdentifiers(a: Identifier, b: Identifier): -1 | 0 | 1 {
  if (typeof a === 'number' && typeof b === 'number') return sign(a - b);
  if (typeof a === 'number') return -1;
  if (typeof b === 'number') return 1;
  return sign(a.localeCompare(b));
}

export function compareVersions(a: Version, b: Version): -1 | 0 | 1 {
  const core = sign(a.major - b.major) || sign(a.minor - b.minor) || sign(a.patch - b.patch);
  if (core !== 0) return core;
  const pa = a.prerelease;
  const pb = b.prerelease;
  if (pa.length === 0 && pb.length === 0) return 0;
  if (pa.length === 0) return 1;
  if (pb.length === 0) return -1;
  for (const [i, id] of pa.entries()) {
    const other = pb[i];
    if (other === undefined) return 1;
    const result = compareIdentifiers(id, other);
    if (result !== 0) return result;
  }
  return pa.length < pb.length ? -1 : 0;
}
```
:::
