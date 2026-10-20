---
kind: task
title: 解析一行输入
mode: ts
---
在 `parse.ts` 中实现两个函数。它们都返回可辨识联合：成功时 `ok` 为 `true`，失败时返回 `{ ok: false, error }`（错误消息要一字不差）。

**`parseTitle(text)`**：标题的规则。添加任务时用它检查标题，以后改名（p1-03）也用它。

1. 按**任意空白**（空格、制表符、换行，正则 `\s+`）把文字切成词，忽略空的词，再用一个空格连起来（`#` 在这里没有特殊的含义）；
2. 结果为空：`标题不能为空`；超过 40 个字符：`标题不能超过 40 个字符`；
3. 成功时返回 `{ ok: true, title }`。

**`parseTaskInput(text)`**：把“写周报 #工作 #紧急”这样的一行输入解析成 `{ ok: true, title, tags }`。

1. 同样按任意空白切成词；
2. 以 `#` 开头的词是标签，标签是 `#` 后面的部分（`C#` 不以 `#` 开头，是标题的一部分）；重复的标签只保留第一次出现的，顺序不变；
3. 其他的词组成标题，用 `parseTitle` 检查；
4. 有多个问题时，按下面的顺序返回**第一个**，与这些词在输入中的位置无关：
   - 某个标签是空的（单独的 `#`）：`标签不能为空`；
   - 某个标签超过 10 个字符：`标签不能超过 10 个字符`；
   - 去重之后超过 3 个标签：`最多 3 个标签`；
   - 标题的问题（`parseTitle` 返回的错误）。

长度按**字符**计算：一个 emoji（例如 😀）算一个字符，用 `[...text].length`（a04、a09 讲过 `length` 统计的是 UTF-16 编码单元）。

:::files{role=starter}
```ts file=parse.ts
export type TitleResult = { ok: true; title: string } | { ok: false; error: string };
export type ParseResult = { ok: true; title: string; tags: readonly string[] } | { ok: false; error: string };

/** 标题的规则（添加任务和改名都用它） */
export function parseTitle(text: string): TitleResult {
  return { ok: true, title: text };
}

/** 把“写周报 #工作 #紧急”这样的一行输入解析成标题和标签 */
export function parseTaskInput(text: string): ParseResult {
  return { ok: true, title: text, tags: [] };
}
```
```ts file=main.ts
import { parseTaskInput, parseTitle } from './parse';

for (const input of ['写周报 #工作 #紧急', '  修   自行车 #家 ', '#工作', 'C# 入门']) {
  console.log(JSON.stringify(input), '→', parseTaskInput(input));
}
console.log(parseTitle('  修好   自行车 '), parseTitle('字'.repeat(41)));
```
:::

:::files{role=solution}
```ts file=parse.ts
export type TitleResult = { ok: true; title: string } | { ok: false; error: string };
export type ParseResult = { ok: true; title: string; tags: readonly string[] } | { ok: false; error: string };

const MAX_TITLE = 40;
const MAX_TAG = 10;
const MAX_TAGS = 3;

/** 按码点计算长度：emoji 这类基本平面以外的字符算一个（a04、a09） */
const charCount = (text: string) => [...text].length;

/** 标题的规则（添加任务和改名都用它）：任意空白分隔的词用一个空格连起来，不能为空，不超过 40 个字符 */
export function parseTitle(text: string): TitleResult {
  const title = text.split(/\s+/).filter((word) => word !== '').join(' ');
  if (title === '') return { ok: false, error: '标题不能为空' };
  if (charCount(title) > MAX_TITLE) return { ok: false, error: `标题不能超过 ${MAX_TITLE} 个字符` };
  return { ok: true, title };
}

/** 把“写周报 #工作 #紧急”这样的一行输入解析成标题和标签 */
export function parseTaskInput(text: string): ParseResult {
  const words = text.split(/\s+/).filter((word) => word !== '');
  const rawTags = words.filter((word) => word.startsWith('#')).map((word) => word.slice(1));
  // 先检查所有的标签，再检查标题；按规定的顺序报告第一个问题，与词在输入中的位置无关
  if (rawTags.includes('')) return { ok: false, error: '标签不能为空' };
  if (rawTags.some((tag) => charCount(tag) > MAX_TAG)) return { ok: false, error: `标签不能超过 ${MAX_TAG} 个字符` };
  const tags = [...new Set(rawTags)];
  if (tags.length > MAX_TAGS) return { ok: false, error: `最多 ${MAX_TAGS} 个标签` };
  const title = parseTitle(words.filter((word) => !word.startsWith('#')).join(' '));
  return title.ok ? { ok: true, title: title.title, tags } : title;
}
```
```ts file=main.ts
import { parseTaskInput, parseTitle } from './parse';

for (const input of ['写周报 #工作 #紧急', '  修   自行车 #家 ', '#工作', 'C# 入门']) {
  console.log(JSON.stringify(input), '→', parseTaskInput(input));
}
console.log(parseTitle('  修好   自行车 '), parseTitle('字'.repeat(41)));
```
:::

:::files{role=tests}
```ts file=parse.test.ts
import { describe, expect, test } from 'vitest';
import { parseTaskInput, parseTitle } from './parse';

describe('parseTitle', () => {
  test('任意空白分隔的词用一个空格连起来', () => {
    expect(parseTitle('  修   自行车\t')).toEqual({ ok: true, title: '修 自行车' });
    expect(parseTitle('买\n牛奶')).toEqual({ ok: true, title: '买 牛奶' });
    expect(parseTitle('买牛奶 #家')).toEqual({ ok: true, title: '买牛奶 #家' });
  });

  test('不能为空，不超过 40 个字符（按码点计算）', () => {
    expect(parseTitle('')).toEqual({ ok: false, error: '标题不能为空' });
    expect(parseTitle(' \t ')).toEqual({ ok: false, error: '标题不能为空' });
    expect(parseTitle('字'.repeat(40))).toEqual({ ok: true, title: '字'.repeat(40) });
    expect(parseTitle('字'.repeat(41))).toEqual({ ok: false, error: '标题不能超过 40 个字符' });
    expect(parseTitle('😀'.repeat(40)).ok).toBe(true);
  });
});

describe('parseTaskInput', () => {
  test('# 开头的词是标签，其余的词组成标题', () => {
    expect(parseTaskInput('写周报 #工作 #紧急')).toEqual({ ok: true, title: '写周报', tags: ['工作', '紧急'] });
    expect(parseTaskInput('#工作 写 周报')).toEqual({ ok: true, title: '写 周报', tags: ['工作'] });
    expect(parseTaskInput('C# 入门')).toEqual({ ok: true, title: 'C# 入门', tags: [] });
  });

  test('任意空白分隔词语：首尾空白去掉，中间的空白变成一个空格', () => {
    expect(parseTaskInput('  修   自行车\t#家 ')).toEqual({ ok: true, title: '修 自行车', tags: ['家'] });
    expect(parseTaskInput('买\n牛奶')).toEqual({ ok: true, title: '买 牛奶', tags: [] });
  });

  test('重复的标签只保留第一次出现的', () => {
    expect(parseTaskInput('写周报 #工作 #紧急 #工作')).toEqual({ ok: true, title: '写周报', tags: ['工作', '紧急'] });
    expect(parseTaskInput('写周报 #a #b #a #c')).toEqual({ ok: true, title: '写周报', tags: ['a', 'b', 'c'] });
  });

  test('标签的错误', () => {
    expect(parseTaskInput('写周报 #')).toEqual({ ok: false, error: '标签不能为空' });
    expect(parseTaskInput('写周报 #a #b #c #d')).toEqual({ ok: false, error: '最多 3 个标签' });
    expect(parseTaskInput('写周报 #一二三四五六七八九十')).toEqual({ ok: true, title: '写周报', tags: ['一二三四五六七八九十'] });
    expect(parseTaskInput('写周报 #一二三四五六七八九十一')).toEqual({ ok: false, error: '标签不能超过 10 个字符' });
  });

  test('标题的错误', () => {
    expect(parseTaskInput('#工作 #紧急')).toEqual({ ok: false, error: '标题不能为空' });
    expect(parseTaskInput('   ')).toEqual({ ok: false, error: '标题不能为空' });
    expect(parseTaskInput('字'.repeat(40))).toEqual({ ok: true, title: '字'.repeat(40), tags: [] });
    expect(parseTaskInput('字'.repeat(41))).toEqual({ ok: false, error: '标题不能超过 40 个字符' });
  });

  test('长度按字符（码点）计算，一个 emoji 算一个字符', () => {
    expect(parseTaskInput('😀'.repeat(40)).ok).toBe(true);
    expect(parseTaskInput('😀'.repeat(41))).toEqual({ ok: false, error: '标题不能超过 40 个字符' });
    expect(parseTaskInput('出游 #' + '🎉'.repeat(10))).toEqual({ ok: true, title: '出游', tags: ['🎉'.repeat(10)] });
  });

  test('有多个问题时，按规定的顺序报告第一个（与词在输入中的位置无关）', () => {
    expect(parseTaskInput('#')).toEqual({ ok: false, error: '标签不能为空' });
    expect(parseTaskInput('#a #b #c #d')).toEqual({ ok: false, error: '最多 3 个标签' });
    expect(parseTaskInput('写周报 #一二三四五六七八九十一 #')).toEqual({ ok: false, error: '标签不能为空' });
    expect(parseTaskInput('写周报 #a #b #c #一二三四五六七八九十一')).toEqual({ ok: false, error: '标签不能超过 10 个字符' });
    expect(parseTaskInput('字'.repeat(41) + ' #一二三四五六七八九十一')).toEqual({ ok: false, error: '标签不能超过 10 个字符' });
  });
});
```
```ts file=parse.test-d.ts
import { expectTypeOf } from 'vitest';
import { parseTaskInput, parseTitle } from './parse';

const title = parseTitle('写周报');
if (title.ok) expectTypeOf(title.title).toEqualTypeOf<string>();
else expectTypeOf(title.error).toEqualTypeOf<string>();

const result = parseTaskInput('写周报 #工作');
// @ts-expect-error 先检查 ok，才能读取 title
console.log(result.title);
if (result.ok) {
  expectTypeOf(result.title).toEqualTypeOf<string>();
  expectTypeOf(result.tags).toEqualTypeOf<readonly string[]>();
} else {
  expectTypeOf(result.error).toEqualTypeOf<string>();
}
```
:::

:::hint{level=1}
`text.split(/\s+/).filter((w) => w !== '')` 得到所有的词。`parseTitle` 把它们 `join(' ')` 之后检查。`parseTaskInput` 先用 `filter` 把词分成两组：以 `#` 开头的（去掉 `#` 就是标签）和其他的（交给 `parseTitle`）。
:::

:::hint{level=2}
分好组之后再按规定的顺序逐项检查：`rawTags.includes('')`、`rawTags.some(过长)`、去重（`[...new Set(rawTags)]`）之后的个数，最后才是标题。不要在遍历时一遇到问题就返回：那样报告的是输入中先出现的问题，而不是规定顺序中的第一个。`parseTitle` 失败时，它的结果 `{ ok: false, error }` 本身就符合 `ParseResult`，可以直接返回。
:::

:::explanation
返回 `{ ok: true, … } | { ok: false, error }` 而不是抛出异常，是因为“输入不合法”是预期中的情况：用户经常会输错，界面要把原因显示出来。可辨识联合让调用方必须先检查 `ok`（类型测试中，没有检查就读取 `title` 会报错），不会忘记处理失败。

**标题的规则只写在一处**。改名（p1-03）和读取保存的数据（p1-05）也要求标题不为空、不超过 40 个字符。如果改名时只检查“不为空”，就能存进去一个 41 个字符的标题，而读取存储时的验证会拒绝它：同一条规则写在两个地方，迟早会不一致。

几个容易出错的细节：

- `split(' ')` 只认空格：制表符、多个连续的空格都会留在词里，标题中会出现奇怪的空白。`/\s+/` 把任意长度的空白都当作分隔符，再过滤掉首尾产生的空字符串；
- **报告哪一个问题**是规格的一部分：界面一次只显示一条错误，按固定的顺序报告，用户和测试才能预期看到哪一条；
- 去重要在计数之前：`#a #b #a #c` 只有 3 个不同的标签，是合法的；
- 长度：`'😀'.length` 是 2。用 `length` 判断，40 个 emoji 的标题会被当成 80 个字符而拒绝。`[...text]` 按码点展开（`for…of` 也是），一个 emoji 是一项。由多个码点组成的 emoji（带肤色的 👍🏽、国旗）仍会被算成多个字符，要按“用户看到的字符”计算需要 `Intl.Segmenter`，这里不要求。
:::

:::variant{kind=alt name=filter-and-set}
```ts file=parse.ts
export type TitleResult = { ok: true; title: string } | { ok: false; error: string };
export type ParseResult = { ok: true; title: string; tags: readonly string[] } | { ok: false; error: string };

const count = (text: string) => Array.from(text).length;

export function parseTitle(text: string): TitleResult {
  const title = text.trim().replace(/\s+/g, ' ');
  if (!title) return { ok: false, error: '标题不能为空' };
  return count(title) > 40 ? { ok: false, error: '标题不能超过 40 个字符' } : { ok: true, title };
}

export function parseTaskInput(text: string): ParseResult {
  let emptyTag = false;
  let longTag = false;
  const tags: string[] = [];
  const titleWords: string[] = [];
  for (const word of text.trim().split(/\s+/)) {
    if (!word.startsWith('#')) {
      if (word) titleWords.push(word);
      continue;
    }
    const tag = word.slice(1);
    if (tag === '') emptyTag = true;
    else if (count(tag) > 10) longTag = true;
    if (!tags.includes(tag)) tags.push(tag);
  }
  if (emptyTag) return { ok: false, error: '标签不能为空' };
  if (longTag) return { ok: false, error: '标签不能超过 10 个字符' };
  if (tags.length > 3) return { ok: false, error: '最多 3 个标签' };
  const title = parseTitle(titleWords.join(' '));
  if (!title.ok) return title;
  return { ok: true, title: title.title, tags };
}
```
:::

:::variant{kind=wrong name=code-units fails=tests reason="用 length 计算长度，一个 emoji 算成了两个字符"}
```ts file=parse.ts
export type TitleResult = { ok: true; title: string } | { ok: false; error: string };
export type ParseResult = { ok: true; title: string; tags: readonly string[] } | { ok: false; error: string };

const MAX_TITLE = 40;
const MAX_TAG = 10;
const MAX_TAGS = 3;

/** 按码点计算长度：emoji 这类基本平面以外的字符算一个（a04、a09） */
const charCount = (text: string) => text.length;

/** 标题的规则（添加任务和改名都用它）：任意空白分隔的词用一个空格连起来，不能为空，不超过 40 个字符 */
export function parseTitle(text: string): TitleResult {
  const title = text.split(/\s+/).filter((word) => word !== '').join(' ');
  if (title === '') return { ok: false, error: '标题不能为空' };
  if (charCount(title) > MAX_TITLE) return { ok: false, error: `标题不能超过 ${MAX_TITLE} 个字符` };
  return { ok: true, title };
}

/** 把“写周报 #工作 #紧急”这样的一行输入解析成标题和标签 */
export function parseTaskInput(text: string): ParseResult {
  const words = text.split(/\s+/).filter((word) => word !== '');
  const rawTags = words.filter((word) => word.startsWith('#')).map((word) => word.slice(1));
  // 先检查所有的标签，再检查标题；按规定的顺序报告第一个问题，与词在输入中的位置无关
  if (rawTags.includes('')) return { ok: false, error: '标签不能为空' };
  if (rawTags.some((tag) => charCount(tag) > MAX_TAG)) return { ok: false, error: `标签不能超过 ${MAX_TAG} 个字符` };
  const tags = [...new Set(rawTags)];
  if (tags.length > MAX_TAGS) return { ok: false, error: `最多 ${MAX_TAGS} 个标签` };
  const title = parseTitle(words.filter((word) => !word.startsWith('#')).join(' '));
  return title.ok ? { ok: true, title: title.title, tags } : title;
}
```
:::

:::variant{kind=wrong name=no-dedupe fails=tests reason="没有去掉重复的标签"}
```ts file=parse.ts
export type TitleResult = { ok: true; title: string } | { ok: false; error: string };
export type ParseResult = { ok: true; title: string; tags: readonly string[] } | { ok: false; error: string };

const MAX_TITLE = 40;
const MAX_TAG = 10;
const MAX_TAGS = 3;

/** 按码点计算长度：emoji 这类基本平面以外的字符算一个（a04、a09） */
const charCount = (text: string) => [...text].length;

/** 标题的规则（添加任务和改名都用它）：任意空白分隔的词用一个空格连起来，不能为空，不超过 40 个字符 */
export function parseTitle(text: string): TitleResult {
  const title = text.split(/\s+/).filter((word) => word !== '').join(' ');
  if (title === '') return { ok: false, error: '标题不能为空' };
  if (charCount(title) > MAX_TITLE) return { ok: false, error: `标题不能超过 ${MAX_TITLE} 个字符` };
  return { ok: true, title };
}

/** 把“写周报 #工作 #紧急”这样的一行输入解析成标题和标签 */
export function parseTaskInput(text: string): ParseResult {
  const words = text.split(/\s+/).filter((word) => word !== '');
  const rawTags = words.filter((word) => word.startsWith('#')).map((word) => word.slice(1));
  // 先检查所有的标签，再检查标题；按规定的顺序报告第一个问题，与词在输入中的位置无关
  if (rawTags.includes('')) return { ok: false, error: '标签不能为空' };
  if (rawTags.some((tag) => charCount(tag) > MAX_TAG)) return { ok: false, error: `标签不能超过 ${MAX_TAG} 个字符` };
  const tags = rawTags;
  if (tags.length > MAX_TAGS) return { ok: false, error: `最多 ${MAX_TAGS} 个标签` };
  const title = parseTitle(words.filter((word) => !word.startsWith('#')).join(' '));
  return title.ok ? { ok: true, title: title.title, tags } : title;
}
```
:::

:::variant{kind=wrong name=split-on-space fails=tests reason="只按空格切分，制表符、连续的空格留在了标题中"}
```ts file=parse.ts
export type TitleResult = { ok: true; title: string } | { ok: false; error: string };
export type ParseResult = { ok: true; title: string; tags: readonly string[] } | { ok: false; error: string };

const MAX_TITLE = 40;
const MAX_TAG = 10;
const MAX_TAGS = 3;

/** 按码点计算长度：emoji 这类基本平面以外的字符算一个（a04、a09） */
const charCount = (text: string) => [...text].length;

/** 标题的规则（添加任务和改名都用它）：任意空白分隔的词用一个空格连起来，不能为空，不超过 40 个字符 */
export function parseTitle(text: string): TitleResult {
  const title = text.split(' ').filter((word) => word !== '').join(' ');
  if (title === '') return { ok: false, error: '标题不能为空' };
  if (charCount(title) > MAX_TITLE) return { ok: false, error: `标题不能超过 ${MAX_TITLE} 个字符` };
  return { ok: true, title };
}

/** 把“写周报 #工作 #紧急”这样的一行输入解析成标题和标签 */
export function parseTaskInput(text: string): ParseResult {
  const words = text.split(' ').filter((word) => word !== '');
  const rawTags = words.filter((word) => word.startsWith('#')).map((word) => word.slice(1));
  // 先检查所有的标签，再检查标题；按规定的顺序报告第一个问题，与词在输入中的位置无关
  if (rawTags.includes('')) return { ok: false, error: '标签不能为空' };
  if (rawTags.some((tag) => charCount(tag) > MAX_TAG)) return { ok: false, error: `标签不能超过 ${MAX_TAG} 个字符` };
  const tags = [...new Set(rawTags)];
  if (tags.length > MAX_TAGS) return { ok: false, error: `最多 ${MAX_TAGS} 个标签` };
  const title = parseTitle(words.filter((word) => !word.startsWith('#')).join(' '));
  return title.ok ? { ok: true, title: title.title, tags } : title;
}
```
:::

:::variant{kind=wrong name=throw-errors fails=tests reason="输入不合法时抛出了异常，而不是返回 ok: false"}
```ts file=parse.ts
export type TitleResult = { ok: true; title: string } | { ok: false; error: string };
export type ParseResult = { ok: true; title: string; tags: readonly string[] } | { ok: false; error: string };

const MAX_TITLE = 40;
const MAX_TAG = 10;
const MAX_TAGS = 3;

/** 按码点计算长度：emoji 这类基本平面以外的字符算一个（a04、a09） */
const charCount = (text: string) => [...text].length;

/** 标题的规则（添加任务和改名都用它）：任意空白分隔的词用一个空格连起来，不能为空，不超过 40 个字符 */
export function parseTitle(text: string): TitleResult {
  const title = text.split(/\s+/).filter((word) => word !== '').join(' ');
  if (title === '') throw new Error('标题不能为空');
  if (charCount(title) > MAX_TITLE) return { ok: false, error: `标题不能超过 ${MAX_TITLE} 个字符` };
  return { ok: true, title };
}

/** 把“写周报 #工作 #紧急”这样的一行输入解析成标题和标签 */
export function parseTaskInput(text: string): ParseResult {
  const words = text.split(/\s+/).filter((word) => word !== '');
  const rawTags = words.filter((word) => word.startsWith('#')).map((word) => word.slice(1));
  // 先检查所有的标签，再检查标题；按规定的顺序报告第一个问题，与词在输入中的位置无关
  if (rawTags.includes('')) throw new Error('标签不能为空');
  if (rawTags.some((tag) => charCount(tag) > MAX_TAG)) return { ok: false, error: `标签不能超过 ${MAX_TAG} 个字符` };
  const tags = [...new Set(rawTags)];
  if (tags.length > MAX_TAGS) return { ok: false, error: `最多 ${MAX_TAGS} 个标签` };
  const title = parseTitle(words.filter((word) => !word.startsWith('#')).join(' '));
  return title.ok ? { ok: true, title: title.title, tags } : title;
}
```
:::

:::variant{kind=wrong name=report-in-word-order fails=tests reason="遍历时一遇到问题就返回，报告的是输入中先出现的问题，而不是规定顺序中的第一个"}
```ts file=parse.ts
export type TitleResult = { ok: true; title: string } | { ok: false; error: string };
export type ParseResult = { ok: true; title: string; tags: readonly string[] } | { ok: false; error: string };

const MAX_TITLE = 40;
const MAX_TAG = 10;
const MAX_TAGS = 3;

/** 按码点计算长度：emoji 这类基本平面以外的字符算一个（a04、a09） */
const charCount = (text: string) => [...text].length;

/** 标题的规则（添加任务和改名都用它）：任意空白分隔的词用一个空格连起来，不能为空，不超过 40 个字符 */
export function parseTitle(text: string): TitleResult {
  const title = text.split(/\s+/).filter((word) => word !== '').join(' ');
  if (title === '') return { ok: false, error: '标题不能为空' };
  if (charCount(title) > MAX_TITLE) return { ok: false, error: `标题不能超过 ${MAX_TITLE} 个字符` };
  return { ok: true, title };
}

/** 把“写周报 #工作 #紧急”这样的一行输入解析成标题和标签 */
export function parseTaskInput(text: string): ParseResult {
  const words = text.split(/\s+/).filter((word) => word !== '');
  const tags: string[] = [];
  const titleWords: string[] = [];
  for (const word of words) {
    if (!word.startsWith('#')) {
      titleWords.push(word);
      continue;
    }
    const tag = word.slice(1);
    if (tag === '') return { ok: false, error: '标签不能为空' };
    if (charCount(tag) > MAX_TAG) return { ok: false, error: `标签不能超过 ${MAX_TAG} 个字符` };
    if (!tags.includes(tag)) tags.push(tag);
  }
  if (tags.length > MAX_TAGS) return { ok: false, error: `最多 ${MAX_TAGS} 个标签` };
  const title = parseTitle(titleWords.join(' '));
  return title.ok ? { ok: true, title: title.title, tags } : title;
}
```
:::
