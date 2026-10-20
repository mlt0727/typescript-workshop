---
version: 1
mode: ts
estimatedMinutes: 30
review: ai-draft
problem: "[10, 9, 1].sort() 的结果是 [1, 10, 9]，而且 sort 会直接改掉原数组。前一个问题让排序结果出错，后一个问题会悄悄改掉调用方或界面状态里的数据。ES2023 增加了 toSorted 等不修改原数组的版本，TypeScript 的 readonly 数组则能在编译期挡住意外的修改。"
objectives:
  - 知道 sort 默认按字符串比较，排序数字时一定要写比较函数
  - 写出升序、降序和多个条件的比较函数，用 localeCompare 比较文字
  - 知道 sort、reverse、splice 会修改原数组并返回它，改用 toSorted、toReversed、toSpliced、with
  - 用 readonly 数组类型防止函数修改传入的数组
references:
  - title: Array.prototype.sort() — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort
    checked: 2026-10-20
  - title: Array.prototype.toSorted() — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/toSorted
    checked: 2026-10-20
  - title: String.prototype.localeCompare() — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/localeCompare
    checked: 2026-10-20
  - title: Object Types（The ReadonlyArray Type）— TypeScript Handbook
    url: https://www.typescriptlang.org/docs/handbook/2/objects.html
    checked: 2026-10-20
---

## sort 默认按字符串排序

不传参数时，`sort` 会把元素**转换成字符串**再按 UTF-16 编码比较。对字符串来说这还算接近字典序（但大写字母排在所有小写字母前面）；对数字来说，`10` 会排在 `9` 前面，因为字符 `'1'` 小于 `'9'`。

排序数字时，**一定要传比较函数** `(a, b) => 数字`：返回负数表示 `a` 排在前面，正数表示 `b` 排在前面，`0` 表示两者相等（与 Java 的 `compareTo` 约定相同）。

:::playground{#default-sort}
```ts file=main.ts
const nums = [10, 9, 1, 100];
nums.sort();
console.log(nums);

nums.sort((a, b) => a - b);
console.log(nums);
nums.sort((a, b) => b - a);
console.log(nums);

const words = ['banana', 'apple', 'Cherry'];
console.log(words.sort());
console.log(words.sort((a, b) => a.localeCompare(b)));
```
- 第 3 行：`[ 1, 10, 100, 9 ]`，按字符串排序的结果。
- 第 5、7 行：`a - b` 升序，`b - a` 降序。
- 第 11 行：大写的 `'Cherry'` 排在最前面。第 12 行的 `localeCompare` 按语言习惯比较文字，结果是 `apple`、`banana`、`Cherry`。
- Python 的 `sorted()` 和 Java 的 `Collections.sort()` 都按元素的自然顺序排序，JavaScript 的默认行为是少见的例外。
:::

## sort 会修改原数组

`sort` **在原数组上**排序，并且返回**同一个数组**。`const sorted = arr.sort(…)` 看起来像得到了一个新数组，其实 `sorted` 和 `arr` 是同一个对象（a11 的引用）。`reverse` 和 a10 的 `splice` 也是这样。

ES2023 为它们增加了**不修改原数组**的版本：`toSorted`、`toReversed`、`toSpliced`，以及替换单个元素的 `with(下标, 值)`。旧代码里常见的写法是先复制再排序：`[...arr].sort(…)`。

:::playground{#mutation}
```ts file=main.ts
const original = [3, 1, 2];
const sorted = original.sort((a, b) => a - b);
console.log(sorted === original, original);

const scores = [5, 4, 6];
console.log(scores.toSorted((a, b) => a - b));
console.log(scores.toReversed(), scores.with(0, 99));
console.log(scores);
```
- 第 3 行：`true [ 1, 2, 3 ]`，原数组已经被排好了序。
- 第 8 行：`scores` 仍然是 `[ 5, 4, 6 ]`。
- 函数修改传入的数组是很隐蔽的 bug：调用方的数据在“只是想看看排序结果”时被改掉了。在 React 里，直接 `sort` 状态数组还会导致界面不更新（G 阶段会讲）。
:::

## 按对象的属性排序

比较函数可以比较任何东西。比较数字属性用减法；比较文字用 `localeCompare`，需要按中文拼音排序时传入 `'zh-CN'`。多个条件时，前一个条件相等再比较下一个。

`sort` 是**稳定**的（ES2019 起规范要求）：比较结果为 0 的元素保持原来的相对顺序。

:::playground{#sort-objects}
```ts file=main.ts
const people = [
  { name: '张三', age: 30 },
  { name: '李四', age: 25 },
  { name: '王五', age: 30 },
];

const byAge = people.toSorted((a, b) => a.age - b.age);
console.log(byAge.map((p) => p.name));

const byAgeDescThenName = people.toSorted((a, b) => {
  if (a.age !== b.age) {
    return b.age - a.age;
  }
  return a.name.localeCompare(b.name, 'zh-CN');
});
console.log(byAgeDescThenName.map((p) => p.name));

console.log(['张三', '李四', '王五'].toSorted());
```
- 第 8 行：`[ '李四', '张三', '王五' ]`。张三和王五同岁，保持了原来的顺序（稳定排序）。
- 第 16 行：先按年龄降序；同岁的张三和王五再按拼音比较，王（wang）排在张（zhang）前面，输出 `[ '王五', '张三', '李四' ]`。
- 第 18 行：不传比较函数时按编码排序，汉字的编码顺序和拼音无关。
:::

## 用 readonly 防止修改

TypeScript 的 `readonly T[]`（也可以写作 `ReadonlyArray<T>`）表示**只读数组**：它上面没有 `sort`、`push`、`splice` 这些会修改数组的方法。把函数参数声明成只读数组，函数内部就不可能意外修改调用方的数据。`toSorted` 等不修改原数组的方法在只读数组上照样可用。

:::playground{#readonly expect="2339@main.ts:2, 7006@main.ts:2, 7006@main.ts:2"}
```ts file=main.ts
function topTwoBad(scores: readonly number[]): number[] {
  return scores.sort((a, b) => b - a).slice(0, 2);
}

function topTwo(scores: readonly number[]): number[] {
  return scores.toSorted((a, b) => b - a).slice(0, 2);
}

const results = [70, 95, 88];
console.log(topTwo(results), results);
```
- 第 2 行：只读数组没有 `sort`，报 TS2339；因为找不到 `sort`，回调参数的类型也推断不出来，又带出两个 TS7006。
- 第 6 行用 `toSorted`，类型检查通过，`results` 也没有被修改。
- 普通的 `number[]` 可以直接传给 `readonly number[]` 参数；反过来不行。
:::

::exercise{#sort-prices}

## 编程挑战

::exercise{#ranking}

::quiz

## 常见错误

- **排序数字不写比较函数**：`[10, 9, 1].sort()` 得到 `[1, 10, 9]`。
- **以为 `sort` 返回新数组**：它返回的就是原数组。不想修改原数组时用 `toSorted`。
- **比较函数返回布尔值**：`(a, b) => a > b` 是错误的，比较函数必须返回负数、0 或正数。
- **用 `<`、`>` 比较中文**：按的是编码，不是拼音，用 `localeCompare(…, 'zh-CN')`。

## 下一步

下一课讲 `Map` 与 `Set`：键可以是任意值的字典，以及自动去重的集合。
