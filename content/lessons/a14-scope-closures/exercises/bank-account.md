---
kind: challenge
title: 只能通过接口修改的账户
---
实现 `createAccount(initial)`：创建一个账户，余额只能通过下面的函数读取和修改（单位：分，均为整数）。

- `deposit(amount)`：存款。`amount` 必须大于 0，否则什么也不做并返回 `false`；成功时返回 `true`。
- `withdraw(amount)`：取款。`amount` 必须大于 0 且不超过当前余额，否则什么也不做并返回 `false`；成功时返回 `true`。
- `balance()`：返回当前余额。
- `history()`：返回所有**成功**交易的记录数组，按发生顺序排列：存款记为正数，取款记为负数。调用方修改这个数组，不能影响账户内部的记录。

不同账户之间互不影响。起始代码里的 `type Account = { … }` 给返回值的对象类型起了一个名字，B 阶段会详细讲 `type`。

:::files{role=starter}
```ts file=account.ts
type Account = {
  deposit: (amount: number) => boolean;
  withdraw: (amount: number) => boolean;
  balance: () => number;
  history: () => number[];
};

export function createAccount(initial: number): Account {
  // 在这里实现
}

const account = createAccount(1000);
account.deposit(500);
console.log(account.balance(), account.history());
```
:::

:::files{role=solution}
```ts file=account.ts
type Account = {
  deposit: (amount: number) => boolean;
  withdraw: (amount: number) => boolean;
  balance: () => number;
  history: () => number[];
};

export function createAccount(initial: number): Account {
  let current = initial;
  const records: number[] = [];

  return {
    deposit: (amount) => {
      if (amount <= 0) {
        return false;
      }
      current += amount;
      records.push(amount);
      return true;
    },
    withdraw: (amount) => {
      if (amount <= 0 || amount > current) {
        return false;
      }
      current -= amount;
      records.push(-amount);
      return true;
    },
    balance: () => current,
    history: () => [...records],
  };
}

const account = createAccount(1000);
account.deposit(500);
console.log(account.balance(), account.history());
```
:::

:::files{role=tests}
```ts file=account.test.ts
import { describe, expect, test } from 'vitest';
import { createAccount } from './account';

describe('createAccount', () => {
  test('存款与取款', () => {
    const acc = createAccount(1000);
    expect(acc.deposit(500)).toBe(true);
    expect(acc.withdraw(300)).toBe(true);
    expect(acc.balance()).toBe(1200);
    expect(acc.history()).toEqual([500, -300]);
  });

  test('非正数金额被拒绝', () => {
    const acc = createAccount(1000);
    expect(acc.deposit(0)).toBe(false);
    expect(acc.deposit(-50)).toBe(false);
    expect(acc.withdraw(0)).toBe(false);
    expect(acc.withdraw(-50)).toBe(false);
    expect(acc.balance()).toBe(1000);
    expect(acc.history()).toEqual([]);
  });

  test('不能透支，但可以正好取完', () => {
    const acc = createAccount(100);
    expect(acc.withdraw(101)).toBe(false);
    expect(acc.balance()).toBe(100);
    expect(acc.withdraw(100)).toBe(true);
    expect(acc.balance()).toBe(0);
    expect(acc.history()).toEqual([-100]);
  });

  test('修改 history 的返回值不影响账户', () => {
    const acc = createAccount(0);
    acc.deposit(10);
    const records = acc.history();
    records.push(999999);
    records[0] = -1;
    expect(acc.history()).toEqual([10]);
  });

  test('不同账户互不影响', () => {
    const a = createAccount(100);
    const b = createAccount(0);
    a.deposit(50);
    b.deposit(7);
    expect(a.balance()).toBe(150);
    expect(b.balance()).toBe(7);
    expect(a.history()).toEqual([50]);
    expect(b.history()).toEqual([7]);
  });
});
```
:::

:::hint{level=1}
在 `createAccount` 内部用 `let` 保存余额、用一个数组保存记录，然后返回一个对象，对象里的四个函数都是闭包，共享这两个变量。
:::

:::hint{level=2}
取款的检查是 `amount <= 0 || amount > current` 时返回 `false`。`history` 要返回副本：`() => [...records]`。返回对象里的函数参数不用写类型，TypeScript 会根据返回类型 `Account` 推断出 `amount` 是 `number`。
:::

:::explanation
余额 `current` 和记录 `records` 都是 `createAccount` 内部的变量，外部代码看不到它们，只能通过返回的四个函数操作。每次调用 `createAccount` 都会创建新的一对变量，所以账户之间互不影响。

`history` 返回 `[...records]` 而不是 `records`：如果直接返回内部数组，调用方拿到的是同一个引用，`push` 一下就能伪造交易记录。返回副本后，内部状态只能通过 `deposit` 和 `withdraw` 修改。

所有检查都放在修改状态**之前**：不满足条件时直接返回 `false`，余额和记录都保持不变。
:::

:::variant{kind=alt name=named-helpers}
```ts file=account.ts
type Account = {
  deposit: (amount: number) => boolean;
  withdraw: (amount: number) => boolean;
  balance: () => number;
  history: () => number[];
};

export function createAccount(initial: number): Account {
  const state: { balance: number; records: number[] } = { balance: initial, records: [] };

  function apply(change: number): void {
    state.balance += change;
    state.records.push(change);
  }

  return {
    deposit(amount: number): boolean {
      if (amount > 0) {
        apply(amount);
        return true;
      }
      return false;
    },
    withdraw(amount: number): boolean {
      if (amount > 0 && amount <= state.balance) {
        apply(-amount);
        return true;
      }
      return false;
    },
    balance: () => state.balance,
    history: () => state.records.slice(),
  };
}
```
:::

:::variant{kind=wrong name=leak-records fails=tests reason="history 直接返回了内部数组"}
```ts file=account.ts
type Account = {
  deposit: (amount: number) => boolean;
  withdraw: (amount: number) => boolean;
  balance: () => number;
  history: () => number[];
};

export function createAccount(initial: number): Account {
  let current = initial;
  const records: number[] = [];
  return {
    deposit: (amount) => {
      if (amount <= 0) return false;
      current += amount;
      records.push(amount);
      return true;
    },
    withdraw: (amount) => {
      if (amount <= 0 || amount > current) return false;
      current -= amount;
      records.push(-amount);
      return true;
    },
    balance: () => current,
    history: () => records,
  };
}
```
:::

:::variant{kind=wrong name=overdraft fails=tests reason="没有检查余额，允许透支"}
```ts file=account.ts
type Account = {
  deposit: (amount: number) => boolean;
  withdraw: (amount: number) => boolean;
  balance: () => number;
  history: () => number[];
};

export function createAccount(initial: number): Account {
  let current = initial;
  const records: number[] = [];
  return {
    deposit: (amount) => {
      if (amount <= 0) return false;
      current += amount;
      records.push(amount);
      return true;
    },
    withdraw: (amount) => {
      if (amount <= 0) return false;
      current -= amount;
      records.push(-amount);
      return true;
    },
    balance: () => current,
    history: () => [...records],
  };
}
```
:::

:::variant{kind=wrong name=shared-records fails=tests reason="记录数组放在函数外面，所有账户共用"}
```ts file=account.ts
type Account = {
  deposit: (amount: number) => boolean;
  withdraw: (amount: number) => boolean;
  balance: () => number;
  history: () => number[];
};

const records: number[] = [];

export function createAccount(initial: number): Account {
  let current = initial;
  return {
    deposit: (amount) => {
      if (amount <= 0) return false;
      current += amount;
      records.push(amount);
      return true;
    },
    withdraw: (amount) => {
      if (amount <= 0 || amount > current) return false;
      current -= amount;
      records.push(-amount);
      return true;
    },
    balance: () => current,
    history: () => [...records],
  };
}
```
:::

:::variant{kind=wrong name=record-failed fails=tests reason="失败的交易也被记录了下来"}
```ts file=account.ts
type Account = {
  deposit: (amount: number) => boolean;
  withdraw: (amount: number) => boolean;
  balance: () => number;
  history: () => number[];
};

export function createAccount(initial: number): Account {
  let current = initial;
  const records: number[] = [];
  return {
    deposit: (amount) => {
      records.push(amount);
      if (amount <= 0) return false;
      current += amount;
      return true;
    },
    withdraw: (amount) => {
      records.push(-amount);
      if (amount <= 0 || amount > current) return false;
      current -= amount;
      return true;
    },
    balance: () => current,
    history: () => [...records],
  };
}
```
:::
