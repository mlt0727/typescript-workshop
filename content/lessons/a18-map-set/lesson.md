---
version: 1
mode: ts
estimatedMinutes: 35
review: ai-draft
problem: 统计每个单词出现了几次、按城市给用户分组、给一列标签去重——这些任务需要“字典”和“集合”。a11 讲过，普通对象当字典用有不少限制。JavaScript 提供了专门的 Map 和 Set，相当于 Python 的 dict / set、Java 的 HashMap / HashSet，但有几处容易踩的不同。
objectives:
  - 用 Map 存取键值对，知道 get 返回 V | undefined，会用 ?? 处理不存在的键
  - 用 Set 去重和判断成员，认识 union、intersection、difference 等集合方法
  - 知道对象作为键时按引用比较，以及 Map 不能直接 JSON.stringify
  - 用 Map.groupBy 分组，并能判断什么时候该用 Map、什么时候用普通对象
references:
  - title: Map — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map
    checked: 2026-10-20
  - title: Set — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set
    checked: 2026-10-20
  - title: Map.groupBy() — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map/groupBy
    checked: 2026-10-20
  - title: Keyed collections — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Keyed_collections
    checked: 2026-10-20
---

## Map：真正的字典

`new Map<键类型, 值类型>()` 创建一个空的 Map。尖括号里写键和值的类型（这种写法叫泛型，b14 详讲）；有初始数据时可以由 TypeScript 推断。

- `set(键, 值)` 添加或覆盖，返回 Map 本身，所以可以连着写；
- `get(键)` 读取，**不存在时返回 `undefined`**，类型是 `V | undefined`；
- `has`、`delete`、`size`（属性，不是方法）；
- 用 `for (const [键, 值] of map)` 遍历，顺序就是**插入的顺序**。

:::playground{#map-basics}
```ts file=main.ts
const stock = new Map<string, number>();
stock.set('苹果', 3).set('香蕉', 0);
stock.set('苹果', 5);

console.log(stock.get('苹果'), stock.get('葡萄'), stock.has('香蕉'), stock.size);

for (const [fruit, count] of stock) {
  console.log(fruit, count);
}

stock.delete('香蕉');
console.log(stock, [...stock.keys()]);
```
- 第 3 行：同一个键再次 `set` 会覆盖旧值。
- 第 5 行：`stock.get('葡萄')` 是 `undefined`，不会像 Python 的 `dict['葡萄']` 那样抛出 `KeyError`。
- 第 12 行：`keys()`、`values()`、`entries()` 返回的是迭代器，用展开语法转成数组。
:::

## get 可能是 undefined

最常见的用法是计数或累积：先读出旧值，再写回新值。因为 `get` 的类型包含 `undefined`，直接计算会报错，用 a08 的 `??` 提供默认值：

:::playground{#counting expect="2532@main.ts:4"}
```ts file=main.ts
function countWords(words: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const word of words) {
    counts.set(word, counts.get(word) + 1);
  }
  return counts;
}

console.log(countWords(['to', 'be', 'or', 'not', 'to', 'be']));
```
- 第 4 行报 TS2532：`counts.get(word)` 可能是 `undefined`。运行一下：`undefined + 1` 是 `NaN`，所有计数都变成了 `NaN`。
- 改成 `(counts.get(word) ?? 0) + 1` 再运行。
- 不要写成 `counts.get(word)! + 1`：第一次遇到某个单词时，值确实是 `undefined`。
:::

## Set：去重与集合运算

`new Set(可迭代对象)` 创建集合，重复的值只保留一个，并保持第一次出现的顺序。`[...new Set(arr)]` 是数组去重的常用写法。

ES2025 为 Set 增加了集合运算方法：`union`（并集）、`intersection`（交集）、`difference`（差集）、`symmetricDifference`、`isSubsetOf` 等，它们都返回新的 Set，不修改原集合。

:::playground{#set}
```ts file=main.ts
const tags = ['ts', 'js', 'ts', 'react', 'js'];
const unique = new Set(tags);
console.log(unique.size, [...unique]);
console.log(unique.has('react'));

const a = new Set([1, 2, 3]);
const b = new Set([2, 3, 4]);
console.log(a.union(b), a.intersection(b), a.difference(b));
console.log(new Set([1, 1, '1', NaN, NaN]).size);
```
- 第 9 行结果是 `3`：数字 `1` 和字符串 `'1'` 是不同的值；`NaN` 虽然不等于自身，但在 Set 和 Map 里被视为同一个值。
:::

## 对象作为键：按引用比较

Map 的键和 Set 的值可以是任何类型，包括对象。但比较用的是和 `===` 几乎相同的规则：**对象按引用比较**（a06），内容相同的两个对象字面量是不同的键。需要按 id 查找时，就用 id 作为键。

还有一个实际的坑：`JSON.stringify` 不认识 Map，结果是 `{}`。需要发送或保存时，先转换成普通对象或数组。

:::playground{#pitfalls}
```ts file=main.ts
const visits = new Map<{ id: number }, number>();
visits.set({ id: 1 }, 10);
console.log(visits.get({ id: 1 }));

const byId = new Map<number, number>();
byId.set(1, 10);
console.log(byId.get(1));

console.log(JSON.stringify(byId));
console.log(JSON.stringify(Object.fromEntries(byId)), JSON.stringify([...byId]));
```
- 第 3 行输出 `undefined`：查找时写的 `{ id: 1 }` 是一个新对象，和存进去的不是同一个。
- 第 9 行输出 `{}`。第 10 行先转换：`Object.fromEntries` 得到 `{"1":10}`（键变成了字符串），`[...byId]` 得到 `[[1,10]]`。
:::

## 分组：Map.groupBy

`Map.groupBy(数组, 回调)`（ES2024）按回调的返回值把元素分组，返回一个 Map：键是分组依据，值是这一组的元素数组。

:::playground{#group-by}
```ts file=main.ts
const people = [
  { name: 'Ada', city: '伦敦' },
  { name: 'Grace', city: '纽约' },
  { name: 'Alan', city: '伦敦' },
];

const byCity = Map.groupBy(people, (p) => p.city);
console.log([...byCity.keys()]);
console.log(byCity.get('伦敦')?.map((p) => p.name));
```
- 第 9 行：`get` 可能返回 `undefined`，所以用了 `?.`。
- 另有 `Object.groupBy`，返回普通对象。
:::

**怎么选？** 属性固定、形状事先知道的数据（一个用户、一个订单）用普通对象；键在运行时才知道、需要频繁增删、或者键不是字符串时，用 Map。只关心“有没有”时用 Set。

::exercise{#word-count}

## 编程挑战

::exercise{#visit-stats}

::quiz

## 常见错误

- **忘了 `get` 可能返回 `undefined`**：用 `??` 提供默认值，或先 `has` 再处理。
- **用新写的对象字面量去 `get`**：对象键按引用比较。
- **直接 `JSON.stringify(map)`**：得到 `{}`。先用 `Object.fromEntries` 或展开成数组。
- **用 `map.size()`**：`size` 是属性，不是方法。

## 下一步

下一课讲模块：`import` 与 `export`，以及 `import type`。
