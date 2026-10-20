---
kind: task
title: 抽象图形类
compiler:
  overrides: { noImplicitOverride: true }
  note: 本题开启 noImplicitOverride，覆盖已有实现的方法时必须写 override；实现抽象方法时推荐写。
---
抽象类 `Shape` 已经写好：它要求子类实现 `area()`，并提供了一个使用 `area()` 的 `describe()` 方法。

实现两个子类：

- `Circle`：构造函数接收半径 `radius`，`area()` 返回 `Math.PI * radius²`；
- `Rect`：构造函数接收 `width` 和 `height`，`area()` 返回 `width * height`。

两个子类都要调用父类的构造函数传入名称（`'圆'`、`'矩形'`）。

:::files{role=starter}
```ts file=shapes.ts
export abstract class Shape {
  readonly name: string;

  constructor(name: string) {
    this.name = name;
  }

  abstract area(): number;

  describe(): string {
    return `${this.name}，面积 ${this.area().toFixed(2)}`;
  }
}

export class Circle extends Shape {}

export class Rect extends Shape {}
```
:::

:::files{role=solution}
```ts file=shapes.ts
export abstract class Shape {
  readonly name: string;

  constructor(name: string) {
    this.name = name;
  }

  abstract area(): number;

  describe(): string {
    return `${this.name}，面积 ${this.area().toFixed(2)}`;
  }
}

export class Circle extends Shape {
  readonly radius: number;

  constructor(radius: number) {
    super('圆');
    this.radius = radius;
  }

  override area(): number {
    return Math.PI * this.radius ** 2;
  }
}

export class Rect extends Shape {
  readonly width: number;
  readonly height: number;

  constructor(width: number, height: number) {
    super('矩形');
    this.width = width;
    this.height = height;
  }

  override area(): number {
    return this.width * this.height;
  }
}
```
:::

:::files{role=tests}
```ts file=shapes.test.ts
import { expect, test } from 'vitest';
import { Circle, Rect, Shape } from './shapes';

test('圆', () => {
  const c = new Circle(1);
  expect(c.area()).toBeCloseTo(Math.PI);
  expect(c.describe()).toBe('圆，面积 3.14');
  expect(c).toBeInstanceOf(Shape);
});

test('矩形', () => {
  const r = new Rect(3, 4);
  expect(r.area()).toBe(12);
  expect(r.describe()).toBe('矩形，面积 12.00');
  expect(r.name).toBe('矩形');
});
```
:::

:::hint{level=1}
每个子类要：声明自己的字段；在构造函数里先 `super('名称')`，再给字段赋值；实现 `area()`（推荐写上 `override`）。
:::

:::hint{level=2}
```ts
export class Rect extends Shape {
  readonly width: number;
  readonly height: number;
  constructor(width: number, height: number) {
    super('矩形');
    this.width = width;
    this.height = height;
  }
  override area(): number {
    return this.width * this.height;
  }
}
```
:::

:::explanation
`Shape` 的 `describe()` 调用了抽象方法 `area()`：基类定义“怎么描述”，子类负责“怎么算面积”。子类没有实现 `area()` 时，TypeScript 报 TS2515（起始代码就是这样）。

子类构造函数先调用 `super('圆')`，父类给 `name` 赋值；之后才能给自己的字段赋值。

实现抽象方法时，`override` 是可写可不写的：`noImplicitOverride` 只强制要求覆盖**已有实现**的方法写 `override`。写上它仍然是好习惯，读代码的人一眼就知道这个方法来自父类的约定。
:::

:::variant{kind=alt name=private-fields-no-override}
```ts file=shapes.ts
export abstract class Shape {
  readonly name: string;

  constructor(name: string) {
    this.name = name;
  }

  abstract area(): number;

  describe(): string {
    return `${this.name}，面积 ${this.area().toFixed(2)}`;
  }
}

export class Circle extends Shape {
  #r: number;
  constructor(radius: number) {
    super('圆');
    this.#r = radius;
  }
  area(): number {
    return Math.PI * this.#r * this.#r;
  }
}

export class Rect extends Shape {
  #w: number;
  #h: number;
  constructor(w: number, h: number) {
    super('矩形');
    this.#w = w;
    this.#h = h;
  }
  area(): number {
    return this.#w * this.#h;
  }
}
```
:::

:::variant{kind=wrong name=this-before-super fails=types reason="在 super(…) 之前给字段赋值"}
```ts file=shapes.ts
export abstract class Shape {
  readonly name: string;

  constructor(name: string) {
    this.name = name;
  }

  abstract area(): number;

  describe(): string {
    return `${this.name}，面积 ${this.area().toFixed(2)}`;
  }
}

export class Circle extends Shape {
  readonly radius: number;
  constructor(radius: number) {
    this.radius = radius;
    super('圆');
  }
  override area(): number {
    return Math.PI * this.radius ** 2;
  }
}

export class Rect extends Shape {
  readonly width: number;
  readonly height: number;
  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    super('矩形');
  }
  override area(): number {
    return this.width * this.height;
  }
}
```
:::

:::variant{kind=wrong name=missing-area fails=types reason="Rect 没有实现抽象方法 area"}
```ts file=shapes.ts
export abstract class Shape {
  readonly name: string;

  constructor(name: string) {
    this.name = name;
  }

  abstract area(): number;

  describe(): string {
    return `${this.name}，面积 ${this.area().toFixed(2)}`;
  }
}

export class Circle extends Shape {
  readonly radius: number;
  constructor(radius: number) {
    super('圆');
    this.radius = radius;
  }
  override area(): number {
    return Math.PI * this.radius ** 2;
  }
}

export class Rect extends Shape {
  readonly width: number;
  readonly height: number;
  constructor(width: number, height: number) {
    super('矩形');
    this.width = width;
    this.height = height;
  }
}
```
:::
