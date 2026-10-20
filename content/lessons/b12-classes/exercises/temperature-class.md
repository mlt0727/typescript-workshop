---
kind: task
title: 温度类
---
实现 `Temperature` 类：

- `new Temperature(celsius)` 创建一个温度；
- `celsius` 是 getter/setter：读取当前摄氏度；赋值时如果低于绝对零度 `-273.15`，抛出 `RangeError`，温度保持不变；
- `fahrenheit` 是 getter/setter：读取时换算成华氏度（`C × 9 / 5 + 32`）；赋值时换算回摄氏度保存（同样要检查绝对零度）；
- 构造函数也要检查绝对零度。

温度值必须保存在 JavaScript 的 `#` 私有字段里：实例上不应该有任何可以直接读写的属性（`Object.keys(t)` 是空数组）。

:::files{role=starter}
```ts file=temperature.ts
export class Temperature {
  constructor(private value: number) {}

  get celsius(): number {
    return this.value;
  }
}
```
:::

:::files{role=solution}
```ts file=temperature.ts
const ABSOLUTE_ZERO = -273.15;

export class Temperature {
  #celsius: number;

  constructor(celsius: number) {
    this.#celsius = Temperature.#check(celsius);
  }

  static #check(celsius: number): number {
    if (celsius < ABSOLUTE_ZERO) {
      throw new RangeError(`低于绝对零度：${celsius}`);
    }
    return celsius;
  }

  get celsius(): number {
    return this.#celsius;
  }

  set celsius(value: number) {
    this.#celsius = Temperature.#check(value);
  }

  get fahrenheit(): number {
    return (this.#celsius * 9) / 5 + 32;
  }

  set fahrenheit(value: number) {
    this.celsius = ((value - 32) * 5) / 9;
  }
}
```
:::

:::files{role=tests}
```ts file=temperature.test.ts
import { describe, expect, test } from 'vitest';
import { Temperature } from './temperature';

describe('Temperature', () => {
  test('读取与换算', () => {
    const t = new Temperature(100);
    expect(t.celsius).toBe(100);
    expect(t.fahrenheit).toBe(212);
  });

  test('通过华氏度赋值', () => {
    const t = new Temperature(0);
    t.fahrenheit = 32;
    expect(t.celsius).toBe(0);
    t.fahrenheit = 212;
    expect(t.celsius).toBe(100);
  });

  test('低于绝对零度时抛出 RangeError，并保持原值', () => {
    expect(() => new Temperature(-300)).toThrow(RangeError);
    const t = new Temperature(20);
    expect(() => {
      t.celsius = -274;
    }).toThrow(RangeError);
    expect(() => {
      t.fahrenheit = -500;
    }).toThrow(RangeError);
    expect(t.celsius).toBe(20);
  });

  test('绝对零度本身是允许的', () => {
    expect(new Temperature(-273.15).celsius).toBe(-273.15);
  });

  test('实例上没有可直接访问的属性', () => {
    const t = new Temperature(25);
    expect(Object.keys(t)).toEqual([]);
    expect(JSON.stringify(t)).toBe('{}');
  });
});
```
:::

:::hint{level=1}
起始代码用了参数属性（本平台不允许）和 TypeScript 的 `private`（运行时仍然是普通属性）。改成 `#celsius` 字段，在构造函数里赋值；然后补上 `celsius` 的 setter 和 `fahrenheit` 的 getter/setter。
:::

:::hint{level=2}
把绝对零度的检查写成一个函数（例如私有的静态方法 `static #check(value: number): number`，不合法就抛出，合法就返回原值），构造函数和两个 setter 都调用它。`fahrenheit` 的 setter 可以直接 `this.celsius = (value - 32) * 5 / 9;`，复用 `celsius` setter 里的检查。
:::

:::explanation
`#celsius` 是真正的私有字段：`Object.keys`、`JSON.stringify`、外部代码都看不到它，只能通过 getter/setter 访问——这正是 setter 中的检查能够生效的前提。如果用 TypeScript 的 `private`，字段在运行时仍然是普通属性，测试中的 `Object.keys(t)` 会包含它。

setter 先检查、后赋值：检查失败时抛出错误，原值不受影响。`fahrenheit` 的 setter 复用了 `celsius` 的 setter，检查逻辑只写一次。

方法名也可以用 `#` 开头，表示私有方法（参考答案中的 `static #check`）。
:::

:::variant{kind=alt name=module-function}
```ts file=temperature.ts
const ABSOLUTE_ZERO = -273.15;

function valid(celsius: number): number {
  if (celsius < ABSOLUTE_ZERO) throw new RangeError('低于绝对零度');
  return celsius;
}

export class Temperature {
  #value = 0;

  constructor(celsius: number) {
    this.celsius = celsius;
  }

  get celsius(): number {
    return this.#value;
  }
  set celsius(c: number) {
    this.#value = valid(c);
  }

  get fahrenheit(): number {
    return this.#value * 1.8 + 32;
  }
  set fahrenheit(f: number) {
    this.#value = valid((f - 32) / 1.8);
  }
}
```
:::

:::variant{kind=wrong name=ts-private fails=tests reason="用 TypeScript 的 private 字段，运行时仍然是普通属性"}
```ts file=temperature.ts
export class Temperature {
  private value: number;

  constructor(celsius: number) {
    if (celsius < -273.15) throw new RangeError('低于绝对零度');
    this.value = celsius;
  }

  get celsius(): number {
    return this.value;
  }
  set celsius(c: number) {
    if (c < -273.15) throw new RangeError('低于绝对零度');
    this.value = c;
  }

  get fahrenheit(): number {
    return (this.value * 9) / 5 + 32;
  }
  set fahrenheit(f: number) {
    this.celsius = ((f - 32) * 5) / 9;
  }
}
```
:::

:::variant{kind=wrong name=parameter-property fails=types reason="使用了参数属性，erasableSyntaxOnly 下不允许"}
```ts file=temperature.ts
export class Temperature {
  #value: number;

  constructor(public readonly initial: number) {
    if (initial < -273.15) throw new RangeError('低于绝对零度');
    this.#value = initial;
  }

  get celsius(): number {
    return this.#value;
  }
  set celsius(c: number) {
    if (c < -273.15) throw new RangeError('低于绝对零度');
    this.#value = c;
  }

  get fahrenheit(): number {
    return (this.#value * 9) / 5 + 32;
  }
  set fahrenheit(f: number) {
    this.celsius = ((f - 32) * 5) / 9;
  }
}
```
:::

:::variant{kind=wrong name=fahrenheit-unchecked fails=tests reason="通过华氏度赋值时没有检查绝对零度"}
```ts file=temperature.ts
export class Temperature {
  #value: number;

  constructor(celsius: number) {
    if (celsius < -273.15) throw new RangeError('低于绝对零度');
    this.#value = celsius;
  }

  get celsius(): number {
    return this.#value;
  }
  set celsius(c: number) {
    if (c < -273.15) throw new RangeError('低于绝对零度');
    this.#value = c;
  }

  get fahrenheit(): number {
    return (this.#value * 9) / 5 + 32;
  }
  set fahrenheit(f: number) {
    this.#value = ((f - 32) * 5) / 9;
  }
}
```
:::
