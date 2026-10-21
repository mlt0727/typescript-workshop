---
version: 1
mode: ts
estimatedMinutes: 60
review: self-reviewed
problem: 到目前为止，每个练习的测试都是别人写好的，你只负责让它们通过。真实的项目中，测试要自己写：写什么输入、期望什么结果、怎样知道测试本身写得够不够。一组好的测试能在你修改代码时立刻指出哪里坏了；一组差的测试即使全部通过，也什么都不能保证。这一课在本机装上 Vitest 并运行它，学会 describe、test、expect 和常用的匹配器，用 vi.fn 和假计时器测试回调与延时；这一课的练习反过来：代码是写好的，由你来写测试，平台会用故意写错的几个版本检查你的测试能不能发现它们。
objectives:
  - 在项目中安装并运行 Vitest，读懂失败时的输出，知道监视模式与 vitest run 的区别
  - 用 describe、test、expect 组织测试，区分 toBe、toEqual、toStrictEqual，测试异常与异步结果，用 test.each 覆盖一组输入
  - 用 vi.fn 记录调用，用 vi.useFakeTimers 控制时间，测试回调与延时的行为
  - 按正常值、边界、无效输入设计测试，并用“故意改错实现”的方法判断测试是否足够
references:
  - title: Getting Started — Vitest
    url: https://vitest.dev/guide/
    checked: 2026-10-20
  - title: expect — Vitest API
    url: https://vitest.dev/api/expect
    checked: 2026-10-20
  - title: Mocking（Timers）— Vitest
    url: https://vitest.dev/guide/mocking
    checked: 2026-10-20
  - title: Test API Reference（test.each）— Vitest
    url: https://vitest.dev/api/
    checked: 2026-10-20
---

## 为什么要自己写测试

f05 的最后一步是“写回归测试”：把复现 bug 的条件固定下来。测试的用处不止于此：

- **可以执行的规格**：`expect(slugify('Hello World')).toBe('hello-world')` 比一段文字说明更准确，而且永远不会过时；
- **放心地修改**：重构、升级依赖之后运行一遍测试，几秒钟就知道有没有改坏；
- **逼着你想清楚边界**：空数组怎么办？负数呢？写测试的时候，这些问题就躲不过去了。

这个网站的练习用的测试接口，就是 [Vitest](https://vitest.dev/) 的一个子集。Vitest 是 Vite 团队的测试框架，配置与 Vite 共用，TypeScript 不需要额外设置。编写本课时的版本是 5.0.5。

## 在自己的电脑上运行

1. 在一个项目中（例如 f02 的 `my-app`，或者 `npm init -y` 新建一个并把 `type` 设为 `module`）：`npm install --save-dev vitest`；
2. 在 `package.json` 的 `scripts` 中加上 `"test": "vitest"`；
3. 写一个函数和它的测试，测试文件的名字以 `.test.ts` 结尾，Vitest 会自动找到它们：

```ts
// src/slug.ts
export function slugify(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, '-');
}
```

```ts
// src/slug.test.ts
import { describe, expect, test } from 'vitest';
import { slugify } from './slug.ts';

describe('slugify', () => {
  test('转换成小写并用 - 连接', () => {
    expect(slugify('Hello World')).toBe('hello-world');
  });

  test('去掉首尾空白', () => {
    expect(slugify('  Vite  ')).toBe('vite ');
  });
});
```

4. 运行 `npx vitest run`。第二个测试的期望值故意多写了一个空格，实际得到的输出（去掉了颜色）：

```text
 ❯ src/slug.test.ts (2 tests | 1 failed) 5ms
   ❯ slugify (2)
     × 去掉首尾空白 3ms

 FAIL  src/slug.test.ts > slugify > 去掉首尾空白
AssertionError: expected 'vite' to be 'vite ' // Object.is equality

Expected: "vite "
Received: "vite"

 ❯ src/slug.test.ts:10:33

 Test Files  1 failed (1)
      Tests  1 failed | 1 passed (2)
```

输出告诉你：哪个文件、哪个 `describe` 下的哪个测试失败了，期望值和实际值分别是什么，失败的是哪一行。把期望值改成 `'vite'`，再运行一次，两个测试都通过。

`npm test`（也就是 `vitest`）在终端中以**监视模式**运行：保存文件后自动重新运行相关的测试，适合边写边测；在持续集成（f12）这类非交互的环境中，它只运行一次。`npx vitest run -t 空白` 只运行名字中含有“空白”的测试。

## 测试的结构与匹配器

- `test(名字, 函数)`（`it` 是它的别名）定义一个测试，名字写成一句规格；`describe(名字, 函数)` 把相关的测试分成一组；
- 每个测试通常分三段：准备数据，调用被测的函数，用 `expect` 检查结果。一个测试只检查一种行为，失败时从名字就能看出是哪种行为坏了。

常用的匹配器：

| 写法 | 含义 |
| --- | --- |
| `expect(x).toBe(y)` | `Object.is(x, y)`：原始值相等，或者是**同一个**对象 |
| `expect(x).toEqual(y)` | 结构相等：逐个比较属性和元素（值为 `undefined` 的属性被忽略） |
| `expect(x).toStrictEqual(y)` | 比 `toEqual` 更严格：`undefined` 属性、数组中的空位、类（原型）也要一致 |
| `expect(fn).toThrow(RangeError)` | 调用 `fn` 时抛出这种错误（也可以写错误信息的一部分或正则）。注意传的是**函数**：`expect(() => chunk([], 0))` |
| `expect(0.1 + 0.2).toBeCloseTo(0.3)` | 浮点数近似相等 |
| `expect(list).toContain(x)`、`toHaveLength(n)` | 包含某个元素、长度 |
| `expect(obj).toMatchObject({ ok: true })` | 只检查列出的属性 |
| `expect(x).not.toBe(y)` | 任何匹配器前加 `not` 取反 |

对象用 `toBe` 比较几乎总是错的。实际运行 `expect({ a: 1 }).toBe({ a: 1 })`，Vitest 的输出是 `expected { a: 1 } to be { a: 1 } // Object.is equality`，并提示 `If it should pass with deep equality, replace "toBe" with "toStrictEqual"`：两个对象内容相同，但不是同一个对象。

`toBe` 用的 `Object.is` 和 `===` 几乎一样，只在两个地方不同。运行下面的代码看看：

:::playground{#object-is expect="2845@main.ts:4"}
```ts file=main.ts
const a = { items: [1, 2] };
const b = { items: [1, 2] };
console.log('同一个对象：', Object.is(a, a), '内容相同的两个对象：', Object.is(a, b));
console.log('NaN：', Object.is(NaN, NaN), NaN === NaN);
console.log('0 与 -0：', Object.is(0, -0), 0 === -0);
```
- 第 3 行：`Object.is` 比较的是“是不是同一个”，所以 `expect(b).toBe(a)` 会失败，而 `toEqual` 逐个比较属性，会通过。
- 第 4、5 行是 `Object.is` 与 `===` 仅有的两处区别：`Object.is(NaN, NaN)` 为真，`Object.is(0, -0)` 为假。所以 `expect(NaN).toBe(NaN)` 能通过（`toBeNaN()` 更清楚）。第 4 行的 TS2845 是 TypeScript 在提醒：和 `NaN` 用 `===` 比较永远是 `false`，判断 `NaN` 要用 `Number.isNaN`。
:::

**异步**：测试函数可以是 `async` 的。`await expect(promise).resolves.toEqual(…)`、`await expect(promise).rejects.toThrow('…')`。**一定要 `await`**：不 `await` 的话，测试函数在 Promise 完成之前就结束了，断言不一定来得及执行。Vitest 5 会发现这种写法：测试结束时它等待还没完成的 `resolves`、`rejects` 断言，然后让这个测试失败，提示断言没有被 `await`（即使断言本身成立）。这个网站的测试运行器也是这样做的。

**一组输入**：`test.each` 用同一段代码测试多组输入，名字中的 `%s`（字符串）、`%j`（JSON 格式，空字符串、前后的空格都看得出来）依次被参数替换：

```ts
test.each([
  ['Hello World', 'hello-world'],
  ['  A  B ', 'a-b'],
  ['', ''],
])('slugify(%j) 是 %j', (input, expected) => {
  expect(slugify(input)).toBe(expected);
});
```

## 回调与时间：vi.fn 和假计时器

被测的函数会调用别的函数（回调、请求、日志）时，用 `vi.fn()` 创建一个**模拟函数**：它记录每一次调用，可以设定返回值。

```ts
const onSave = vi.fn();
saveAll(['a', 'b'], onSave);
expect(onSave).toHaveBeenCalledTimes(2);
expect(onSave).toHaveBeenLastCalledWith('b');
```

被测的代码用了 `setTimeout`（防抖、重试的等待、超时）时，真的去等待会让测试又慢又不稳定。`vi.useFakeTimers()` 把计时器换成可以手动推进的假计时器：

```ts
beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

test('300 毫秒之后才保存', () => {
  const save = vi.fn();
  const debounced = debounce(save, 300);
  debounced('草稿');
  vi.advanceTimersByTime(299);
  expect(save).not.toHaveBeenCalled();
  vi.advanceTimersByTime(1);
  expect(save).toHaveBeenCalledWith('草稿');
});
```

`vi.advanceTimersByTime(299)` 让时间前进 299 毫秒，到期的计时器同步执行。用 299 和 1 两步推进，正好检查了“不早也不晚”这个边界。

## 测试写得够不够

所有测试都通过，只能说明代码满足了**你写下的**这些检查。判断测试是否足够的一个直接的办法：**故意把实现改错，看有没有测试失败**。

- 把 `slice(i, i + size)` 改成 `slice(i, i + size - 1)`：如果没有测试失败，说明没有测试检查每一块的大小；
- 把“抛出 `RangeError`”改成“返回空数组”：如果没有测试失败，说明没有测试检查无效的输入；
- 把 `toSorted` 改成 `sort`：如果没有测试失败，说明没有测试检查“不修改传入的数组”。

下面用普通的代码模拟这个过程：同一组“测试”分别在正确的实现和一个故意写错的实现上运行。

:::playground{#mini-mutation}
```ts file=main.ts
type Chunk = (items: readonly number[], size: number) => number[][];

const correct: Chunk = (items, size) => {
  const out: number[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
};
// 故意写错：最后一组不满时被丢掉
const dropsLast: Chunk = (items, size) => {
  const out: number[][] = [];
  for (let i = 0; i + size <= items.length; i += size) out.push(items.slice(i, i + size));
  return out;
};

const same = (x: unknown, y: unknown) => JSON.stringify(x) === JSON.stringify(y);
const tests: [name: string, check: (chunk: Chunk) => boolean][] = [
  ['两个一组', (chunk) => same(chunk([1, 2, 3, 4], 2), [[1, 2], [3, 4]])],
  ['空数组', (chunk) => same(chunk([], 2), [])],
];

for (const [label, chunk] of [['正确的实现', correct], ['丢掉最后一组', dropsLast]] as const) {
  const failed = tests.filter(([, check]) => !check(chunk)).map(([name]) => name);
  console.log(label, failed.length === 0 ? '全部通过' : `失败：${failed.join('、')}`);
}
```
- 两组测试在错误的实现上也全部通过：它们没有用到“最后一组不满”的数据，所以发现不了这个错误。
- 在 `tests` 中加一项 `['最后一组不满', (chunk) => same(chunk([1, 2, 3], 2), [[1, 2], [3]])]`，再运行：错误的实现失败了，正确的实现仍然通过。这一项测试就是“有用的”。
:::

这种方法叫**变异测试**（mutation testing），有专门的工具自动生成这些“变异体”。这一课的练习就是这样判题的：你写的测试先要在正确的实现上全部通过，然后平台会换上几个故意写错的实现，你的测试要能发现（至少有一个测试失败）每一个。没有发现的，结果中会说明它错在哪里，提示你还缺少哪种测试。

设计测试时，对每个输入按三类去想：

1. **正常值**：最典型的用法；
2. **边界**：空的、只有一个的、正好等于限制的、最后不满一组的；
3. **无效的输入**：规格说要报错的情况，确认它真的报错，而且是规格要求的那种错误。

另外别忘了**没有发生的事**：不修改传入的参数，没有多调用一次回调，取消之后确实没有调用。

::exercise{#test-chunk}

## 编程挑战

::exercise{#test-debounce}

::quiz

## 常见错误

- **用 `toBe` 比较对象和数组**：比较的是“是不是同一个”。比较内容用 `toEqual` 或 `toStrictEqual`。
- **`expect(fn()).toThrow()`**：`fn()` 在 `expect` 之前就抛出了，测试直接失败。要传函数：`expect(() => fn()).toThrow()`。
- **异步的断言没有 `await`**：`expect(p).rejects.toThrow()` 不 `await` 时，测试在它完成之前就结束了。Vitest 5 会因此让测试失败；在不检查这一点的测试工具中，这个断言的失败可能完全不被报告。
- **测试之间互相依赖**：一个测试修改了共享的数据，另一个测试的结果取决于运行顺序。每个测试自己准备数据，假计时器在 `afterEach` 中恢复。
- **只测试正常值**：大部分 bug 在边界和无效输入上（f05）。
- **测试实现细节而不是行为**：检查“调用了几次内部的辅助函数”，重构时测试就会无故失败。检查输入和输出，以及规格中说明的副作用。
