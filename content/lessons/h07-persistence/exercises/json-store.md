---
kind: challenge
title: 可靠的 JSON 文件存储
timeoutMs: 20000
---
在 `json-store.ts` 中实现 `createJsonStore(fs, path, options)`：把一份数据保存在一个 JSON 文件中，适合只有一台服务器的小项目。`fs` 是注入的文件操作（真实的程序中传入 `node:fs/promises`，测试中是一个假的），失败时抛出的错误带有 `code`（例如 `'ENOENT'`）。

1. `read()`：读取 `path`（不排队：写入是原子的，读到的总是完整的旧数据或者新数据）。文件不存在（`code` 是 `'ENOENT'`）时返回 `options.initial`；读取的其他错误原样抛出。内容不是合法的 JSON，或者 `options.parse(值)` 返回 `null` 时，抛出 `StoreCorruptError`（已经写好）：**不要**当作没有数据；
2. `update(change)`：读出当前的数据（规则和 `read` 一样），用 `change` 算出新的数据，写入文件，返回新的数据；
3. **排队**：所有的 `update` 按调用的顺序一个接一个地运行：前一个**整个**完成（包括 `rename`，不管成功还是失败）之后，后一个才开始读取。每个 `update` 都重新读取文件，不使用之前读到的数据。一个 `update` 失败（`change` 抛出错误、读取或写入失败）时，只有它自己的 Promise 失败，文件保持原样，后面的 `update` 照常进行；
4. **原子地写入**：先把 `JSON.stringify(数据)` 写到 `path + '.tmp'`，再 `rename(path + '.tmp', path)`；不要直接写 `path`；
5. **重试**：`rename` 失败并且 `code` 是 `'EPERM'` 或 `'EBUSY'` 时再试一次，最多一共试 4 次；其他的错误，或者 4 次都失败，把最后一次的错误交给调用方。

:::files{role=starter}
```ts file=json-store.ts
/** 需要用到的文件操作：和 node:fs/promises 的同名函数一样，测试中换成一个假的 */
export type FileSystem = Readonly<{
  readFile(path: string): Promise<string>;
  writeFile(path: string, data: string): Promise<void>;
  rename(from: string, to: string): Promise<void>;
}>;

export type StoreOptions<T> = Readonly<{
  /** 文件还不存在时的内容 */
  initial: T;
  /** 校验读出来的数据：不合法时返回 null */
  parse: (value: unknown) => T | null;
}>;

export type JsonStore<T> = Readonly<{
  read(): Promise<T>;
  update(change: (current: T) => T): Promise<T>;
}>;

/** 文件存在，但内容不是合法的数据：不能当作“没有数据”，否则下一次写入会把它覆盖掉 */
export class StoreCorruptError extends Error {
  constructor(path: string) {
    super(`数据文件已损坏：${path}`);
    this.name = 'StoreCorruptError';
  }
}

export function createJsonStore<T>(fs: FileSystem, path: string, options: StoreOptions<T>): JsonStore<T> {
  // TODO
  return {
    read: async () => options.initial,
    update: async (change) => change(options.initial),
  };
}
```
```ts file=main.ts readonly
import { createJsonStore, type FileSystem } from './json-store';

// 预览中没有真正的文件：用一个 Map 代替，每个操作等 5 毫秒
const files = new Map<string, string>();
const wait = () => new Promise((resolve) => setTimeout(resolve, 5));
const fs: FileSystem = {
  readFile: async (path) => {
    await wait();
    const text = files.get(path);
    if (text === undefined) throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    return text;
  },
  writeFile: async (path, text) => {
    await wait();
    files.set(path, text);
  },
  rename: async (from, to) => {
    await wait();
    files.set(to, files.get(from) ?? '');
    files.delete(from);
  },
};

const store = createJsonStore(fs, 'counter.json', {
  initial: { count: 0 },
  parse: (value) => (typeof value === 'object' && value !== null && 'count' in value && typeof value.count === 'number' ? { count: value.count } : null),
});

await Promise.all(Array.from({ length: 20 }, () => store.update((c) => ({ count: c.count + 1 }))));
console.log('20 次同时修改之后：', await store.read(), [...files.keys()]);
```
:::

:::files{role=solution}
```ts file=json-store.ts
/** 需要用到的文件操作：和 node:fs/promises 的同名函数一样，测试中换成一个假的 */
export type FileSystem = Readonly<{
  readFile(path: string): Promise<string>;
  writeFile(path: string, data: string): Promise<void>;
  rename(from: string, to: string): Promise<void>;
}>;

export type StoreOptions<T> = Readonly<{
  /** 文件还不存在时的内容 */
  initial: T;
  /** 校验读出来的数据：不合法时返回 null */
  parse: (value: unknown) => T | null;
}>;

export type JsonStore<T> = Readonly<{
  read(): Promise<T>;
  update(change: (current: T) => T): Promise<T>;
}>;

/** 文件存在，但内容不是合法的数据：不能当作“没有数据”，否则下一次写入会把它覆盖掉 */
export class StoreCorruptError extends Error {
  constructor(path: string) {
    super(`数据文件已损坏：${path}`);
    this.name = 'StoreCorruptError';
  }
}

/** rename 的目标文件正被别的程序打开时，Windows 上会暂时失败 */
const RETRYABLE = new Set(['EPERM', 'EBUSY']);
const RENAME_ATTEMPTS = 4;

const codeOf = (error: unknown) => (typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined);

export function createJsonStore<T>(fs: FileSystem, path: string, options: StoreOptions<T>): JsonStore<T> {
  /** 所有的 update 排成一队：前一个完成（不管成功还是失败）之后，后一个才开始 */
  let queue: Promise<unknown> = Promise.resolve();

  async function read(): Promise<T> {
    let text: string;
    try {
      text = await fs.readFile(path);
    } catch (error) {
      if (codeOf(error) === 'ENOENT') return options.initial;
      throw error;
    }
    let value: unknown;
    try {
      value = JSON.parse(text);
    } catch {
      throw new StoreCorruptError(path);
    }
    const data = options.parse(value);
    if (data === null) throw new StoreCorruptError(path);
    return data;
  }

  async function renameWithRetry(from: string, to: string): Promise<void> {
    for (let attempt = 1; ; attempt++) {
      try {
        await fs.rename(from, to);
        return;
      } catch (error) {
        const code = codeOf(error);
        if (typeof code !== 'string' || !RETRYABLE.has(code) || attempt === RENAME_ATTEMPTS) throw error;
      }
    }
  }

  async function write(data: T): Promise<void> {
    // 先写到旁边的临时文件，再用 rename 一步替换：读的人看到的要么是旧的文件，要么是新的文件
    const temporary = `${path}.tmp`;
    await fs.writeFile(temporary, JSON.stringify(data));
    await renameWithRetry(temporary, path);
  }

  return {
    read,
    update(change) {
      const run = queue.then(async () => {
        const next = change(await read());
        await write(next);
        return next;
      });
      // 队列不能因为一次失败而卡住
      queue = run.catch(() => {});
      return run;
    },
  };
}
```
```ts file=main.ts readonly
import { createJsonStore, type FileSystem } from './json-store';

// 预览中没有真正的文件：用一个 Map 代替，每个操作等 5 毫秒
const files = new Map<string, string>();
const wait = () => new Promise((resolve) => setTimeout(resolve, 5));
const fs: FileSystem = {
  readFile: async (path) => {
    await wait();
    const text = files.get(path);
    if (text === undefined) throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    return text;
  },
  writeFile: async (path, text) => {
    await wait();
    files.set(path, text);
  },
  rename: async (from, to) => {
    await wait();
    files.set(to, files.get(from) ?? '');
    files.delete(from);
  },
};

const store = createJsonStore(fs, 'counter.json', {
  initial: { count: 0 },
  parse: (value) => (typeof value === 'object' && value !== null && 'count' in value && typeof value.count === 'number' ? { count: value.count } : null),
});

await Promise.all(Array.from({ length: 20 }, () => store.update((c) => ({ count: c.count + 1 }))));
console.log('20 次同时修改之后：', await store.read(), [...files.keys()]);
```
:::

:::files{role=tests}
```ts file=json-store.test.ts
import { describe, expect, test } from 'vitest';
import { createJsonStore, StoreCorruptError, type FileSystem } from './json-store';

type Counter = { count: number };
const parseCounter = (value: unknown): Counter | null =>
  typeof value === 'object' && value !== null && 'count' in value && typeof value.count === 'number' ? { count: value.count } : null;

const errorWithCode = (code: string) => Object.assign(new Error(code), { code });

/**
 * 内存中的假文件系统：每个操作都要等一会儿（像真的磁盘那样），并且记录下来。
 * fail 中可以安排某个操作在第几次调用时失败。
 */
function fakeFs(files: Record<string, string> = {}, renameDelay = 1) {
  const data = new Map(Object.entries(files));
  const log: string[] = [];
  const fail: { writeFile?: Error; rename?: Error[] } = {};
  const tick = (ms = 1) => new Promise((resolve) => setTimeout(resolve, ms));
  const fs: FileSystem = {
    async readFile(path) {
      log.push(`read ${path}`);
      await tick();
      const text = data.get(path);
      if (text === undefined) throw errorWithCode('ENOENT');
      return text;
    },
    async writeFile(path, text) {
      log.push(`write ${path}`);
      await tick();
      if (fail.writeFile !== undefined) throw fail.writeFile;
      data.set(path, text);
    },
    async rename(from, to) {
      log.push(`rename ${from} -> ${to}`);
      await tick(renameDelay);
      const error = fail.rename?.shift();
      if (error !== undefined) throw error;
      const text = data.get(from);
      if (text === undefined) throw errorWithCode('ENOENT');
      data.set(to, text);
      data.delete(from);
    },
  };
  return { fs, data, log, fail };
}

const options = { initial: { count: 0 }, parse: parseCounter };

describe('createJsonStore', () => {
  test('文件不存在：返回初始的内容', async () => {
    const { fs } = fakeFs();
    expect(await createJsonStore(fs, 'data.json', options).read()).toStrictEqual({ count: 0 });
  });

  test('读取：解析并校验', async () => {
    const { fs } = fakeFs({ 'data.json': '{"count":3}' });
    expect(await createJsonStore(fs, 'data.json', options).read()).toStrictEqual({ count: 3 });
  });

  test('内容损坏或者不合法：StoreCorruptError，而不是当作没有数据', async () => {
    for (const text of ['{"count":', '', '{"count":"3"}', 'null']) {
      const { fs } = fakeFs({ 'data.json': text });
      let caught: unknown;
      try {
        await createJsonStore(fs, 'data.json', options).read();
      } catch (error) {
        caught = error;
      }
      expect(caught, text).toBeInstanceOf(StoreCorruptError);
    }
  });

  test('读取的其他错误原样抛出', async () => {
    const denied = errorWithCode('EACCES');
    const fs: FileSystem = {
      readFile: async () => {
        throw denied;
      },
      writeFile: async () => {},
      rename: async () => {},
    };
    await expect(createJsonStore(fs, 'data.json', options).read()).rejects.toBe(denied);
  });

  test('写入：先写临时文件 data.json.tmp，再 rename 成 data.json', async () => {
    const { fs, data, log } = fakeFs();
    const store = createJsonStore(fs, 'data.json', options);
    expect(await store.update((c) => ({ count: c.count + 1 }))).toStrictEqual({ count: 1 });
    expect(log).toStrictEqual(['read data.json', 'write data.json.tmp', 'rename data.json.tmp -> data.json']);
    expect(data.get('data.json')).toBe('{"count":1}');
    expect(data.has('data.json.tmp')).toBe(false);
  });

  test('20 次同时发出的修改：一个接一个，一次也不丢', async () => {
    const { fs, data } = fakeFs();
    const store = createJsonStore(fs, 'data.json', options);
    const results = await Promise.all(Array.from({ length: 20 }, () => store.update((c) => ({ count: c.count + 1 }))));
    expect(results.map((r) => r.count)).toStrictEqual(Array.from({ length: 20 }, (_, i) => i + 1));
    expect(data.get('data.json')).toBe('{"count":20}');
  });

  test('rename 比读写慢：前一个修改 rename 完成之前，后一个修改不能开始读取', async () => {
    const { fs, data } = fakeFs({}, 5);
    const store = createJsonStore(fs, 'data.json', options);
    await Promise.all(Array.from({ length: 5 }, () => store.update((c) => ({ count: c.count + 1 }))));
    expect(data.get('data.json')).toBe('{"count":5}');
  });

  test('每次修改都重新读取文件：别的程序修改过的内容不会被旧的数据覆盖', async () => {
    const { fs, data } = fakeFs({ 'data.json': '{"count":1}' });
    const store = createJsonStore(fs, 'data.json', options);
    await store.update((c) => ({ count: c.count + 1 }));
    data.set('data.json', '{"count":100}');
    expect(await store.update((c) => ({ count: c.count + 1 }))).toStrictEqual({ count: 101 });
  });

  test('修改函数抛出错误：这次修改失败，文件不变，后面的修改照常进行', async () => {
    const { fs, data } = fakeFs({ 'data.json': '{"count":5}' });
    const store = createJsonStore(fs, 'data.json', options);
    const failing = store.update(() => {
      throw new Error('不能修改');
    });
    const next = store.update((c) => ({ count: c.count + 1 }));
    await expect(failing).rejects.toThrow('不能修改');
    expect(await next).toStrictEqual({ count: 6 });
    expect(data.get('data.json')).toBe('{"count":6}');
  });

  test('写临时文件失败：原来的文件完好，错误交给调用方，队列继续', async () => {
    const { fs, data, fail } = fakeFs({ 'data.json': '{"count":5}' });
    const store = createJsonStore(fs, 'data.json', options);
    fail.writeFile = errorWithCode('ENOSPC');
    await expect(store.update((c) => ({ count: c.count + 1 }))).rejects.toBe(fail.writeFile);
    expect(data.get('data.json')).toBe('{"count":5}');
    fail.writeFile = undefined;
    expect(await store.update((c) => ({ count: c.count + 1 }))).toStrictEqual({ count: 6 });
  });

  test('rename 暂时失败（EPERM、EBUSY）：再试，最多一共 4 次', async () => {
    const { fs, data, fail, log } = fakeFs();
    const store = createJsonStore(fs, 'data.json', options);
    fail.rename = [errorWithCode('EPERM'), errorWithCode('EBUSY'), errorWithCode('EPERM')];
    expect(await store.update(() => ({ count: 1 }))).toStrictEqual({ count: 1 });
    expect(log.filter((line) => line.startsWith('rename'))).toHaveLength(4);
    expect(data.get('data.json')).toBe('{"count":1}');
  });

  test('rename 一直失败，或者是别的错误：不再重试，错误交给调用方', async () => {
    const { fs, fail, log } = fakeFs();
    const store = createJsonStore(fs, 'data.json', options);
    const last = errorWithCode('EPERM');
    fail.rename = [errorWithCode('EPERM'), errorWithCode('EBUSY'), errorWithCode('EPERM'), last];
    await expect(store.update(() => ({ count: 1 }))).rejects.toBe(last);
    expect(log.filter((line) => line.startsWith('rename'))).toHaveLength(4);
    expect(await store.update(() => ({ count: 2 }))).toStrictEqual({ count: 2 });

    const other = fakeFs();
    other.fail.rename = [errorWithCode('EXDEV')];
    await expect(createJsonStore(other.fs, 'data.json', options).update(() => ({ count: 1 }))).rejects.toMatchObject({ code: 'EXDEV' });
    expect(other.log.filter((line) => line.startsWith('rename'))).toHaveLength(1);
  });

  test('文件损坏时 update 也失败，不会用初始的内容覆盖它', async () => {
    const { fs, data } = fakeFs({ 'data.json': '{"count":' });
    const store = createJsonStore(fs, 'data.json', options);
    let caught: unknown;
    try {
      await store.update((c) => ({ count: c.count + 1 }));
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(StoreCorruptError);
    expect(data.get('data.json')).toBe('{"count":');
  });
});
```
:::

:::hint{level=1}
排队用一个 Promise 链：`let queue = Promise.resolve()`，每次 `update` 时 `const run = queue.then(async () => { … })`，然后 `queue = run.catch(() => {})`，返回 `run`。这样调用方能看到自己那次的失败，而队列本身永远不会停在失败的状态。
:::

:::hint{level=2}
读取时分两层 `try`：第一层包住 `fs.readFile`，`ENOENT` 返回初始值，其他的重新抛出；第二层包住 `JSON.parse`，失败时抛出 `StoreCorruptError`。错误的 `code`：先判断 `typeof error === 'object' && error !== null && 'code' in error`，再读 `error.code`。
:::

:::explanation
这三条规则分别对付正文中实测的三个问题：

- **丢失更新**：两个请求同时“读出 → 修改 → 写回”，都读到了旧值，后写的覆盖了先写的。实测 20 次同时的修改最后只留下了 1 次。排队让“读出 → 修改 → 写回”成为一个不会被打断的整体。这只在**一个进程**中有效：两个进程（或者两台服务器）写同一个文件，排队就没用了，那是数据库的事；
- **读到写了一半的文件**：`writeFile` 是一点一点写进去的，实测在写一个较大的文件时同时读取，几乎每次都读到了不完整的 JSON。先写到临时文件、再用 `rename` 替换：`rename` 在同一个文件系统中是一步完成的，读的人看到的要么是旧的文件，要么是新的文件。写到一半时出错（例如磁盘满了），原来的文件也完好无损；
- **Windows 上 rename 偶尔失败**：目标文件正被另一个操作打开时，Windows 不允许替换它（实测 10 次中失败 1 到 2 次，错误是 `EPERM`）。这是暂时的，稍后再试就好。`EXDEV`（跨文件系统）这样的错误重试多少次也不会好，所以只重试那两种。

文件损坏时抛出错误，而不是当作“没有数据”：后者会让下一次写入用初始的内容覆盖损坏的文件，原来的数据就再也找不回来了。让程序停下来，人还有机会去修复它。

替代解用一个数组保存等待的修改，由一个循环逐个取出来运行；重试写成递归的函数。
:::

:::variant{kind=alt name=task-loop}
```ts file=json-store.ts
/** 需要用到的文件操作：和 node:fs/promises 的同名函数一样，测试中换成一个假的 */
export type FileSystem = Readonly<{
  readFile(path: string): Promise<string>;
  writeFile(path: string, data: string): Promise<void>;
  rename(from: string, to: string): Promise<void>;
}>;

export type StoreOptions<T> = Readonly<{
  /** 文件还不存在时的内容 */
  initial: T;
  /** 校验读出来的数据：不合法时返回 null */
  parse: (value: unknown) => T | null;
}>;

export type JsonStore<T> = Readonly<{
  read(): Promise<T>;
  update(change: (current: T) => T): Promise<T>;
}>;

/** 文件存在，但内容不是合法的数据：不能当作“没有数据”，否则下一次写入会把它覆盖掉 */
export class StoreCorruptError extends Error {
  constructor(path: string) {
    super(`数据文件已损坏：${path}`);
    this.name = 'StoreCorruptError';
  }
}

const hasCode = (error: unknown, ...codes: string[]) => error instanceof Error && 'code' in error && typeof error.code === 'string' && codes.includes(error.code);

/** 递归地重试：还剩几次机会就再试几次 */
async function retrying(operation: () => Promise<void>, attemptsLeft: number): Promise<void> {
  try {
    await operation();
  } catch (error) {
    if (attemptsLeft <= 1 || !hasCode(error, 'EPERM', 'EBUSY')) throw error;
    await retrying(operation, attemptsLeft - 1);
  }
}

export function createJsonStore<T>(fs: FileSystem, path: string, options: StoreOptions<T>): JsonStore<T> {
  /** 等待运行的修改：一个循环逐个取出来运行，同一时间只有一个 */
  const waiting: (() => Promise<void>)[] = [];
  let running = false;

  async function drain(): Promise<void> {
    if (running) return;
    running = true;
    for (let task = waiting.shift(); task !== undefined; task = waiting.shift()) await task();
    running = false;
  }

  const read = async (): Promise<T> => {
    const text = await fs.readFile(path).catch((error: unknown) => {
      if (hasCode(error, 'ENOENT')) return null;
      throw error;
    });
    if (text === null) return options.initial;
    let parsed: T | null = null;
    try {
      parsed = options.parse(JSON.parse(text));
    } catch {
      // JSON 不合法：和校验不通过一样处理
    }
    if (parsed === null) throw new StoreCorruptError(path);
    return parsed;
  };

  return {
    read,
    update(change) {
      return new Promise<T>((resolve, reject) => {
        waiting.push(async () => {
          try {
            const next = change(await read());
            await fs.writeFile(`${path}.tmp`, JSON.stringify(next));
            await retrying(() => fs.rename(`${path}.tmp`, path), 4);
            resolve(next);
          } catch (error) {
            reject(error);
          }
        });
        void drain();
      });
    },
  };
}
```
:::

:::variant{kind=wrong name=overwrite-in-place fails=tests reason="直接覆盖原来的文件：写到一半时读的人会读到不完整的 JSON（正文中实测几乎每次都是）"}
```ts file=json-store.ts
/** 需要用到的文件操作：和 node:fs/promises 的同名函数一样，测试中换成一个假的 */
export type FileSystem = Readonly<{
  readFile(path: string): Promise<string>;
  writeFile(path: string, data: string): Promise<void>;
  rename(from: string, to: string): Promise<void>;
}>;

export type StoreOptions<T> = Readonly<{
  /** 文件还不存在时的内容 */
  initial: T;
  /** 校验读出来的数据：不合法时返回 null */
  parse: (value: unknown) => T | null;
}>;

export type JsonStore<T> = Readonly<{
  read(): Promise<T>;
  update(change: (current: T) => T): Promise<T>;
}>;

/** 文件存在，但内容不是合法的数据：不能当作“没有数据”，否则下一次写入会把它覆盖掉 */
export class StoreCorruptError extends Error {
  constructor(path: string) {
    super(`数据文件已损坏：${path}`);
    this.name = 'StoreCorruptError';
  }
}

/** rename 的目标文件正被别的程序打开时，Windows 上会暂时失败 */
const RETRYABLE = new Set(['EPERM', 'EBUSY']);
const RENAME_ATTEMPTS = 4;

const codeOf = (error: unknown) => (typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined);

export function createJsonStore<T>(fs: FileSystem, path: string, options: StoreOptions<T>): JsonStore<T> {
  /** 所有的 update 排成一队：前一个完成（不管成功还是失败）之后，后一个才开始 */
  let queue: Promise<unknown> = Promise.resolve();

  async function read(): Promise<T> {
    let text: string;
    try {
      text = await fs.readFile(path);
    } catch (error) {
      if (codeOf(error) === 'ENOENT') return options.initial;
      throw error;
    }
    let value: unknown;
    try {
      value = JSON.parse(text);
    } catch {
      throw new StoreCorruptError(path);
    }
    const data = options.parse(value);
    if (data === null) throw new StoreCorruptError(path);
    return data;
  }

  async function renameWithRetry(from: string, to: string): Promise<void> {
    for (let attempt = 1; ; attempt++) {
      try {
        await fs.rename(from, to);
        return;
      } catch (error) {
        const code = codeOf(error);
        if (typeof code !== 'string' || !RETRYABLE.has(code) || attempt === RENAME_ATTEMPTS) throw error;
      }
    }
  }

  async function write(data: T): Promise<void> {
    // 先写到旁边的临时文件，再用 rename 一步替换：读的人看到的要么是旧的文件，要么是新的文件
    const temporary = `${path}.tmp`;
    void temporary;
    await fs.writeFile(path, JSON.stringify(data));
  }

  return {
    read,
    update(change) {
      const run = queue.then(async () => {
        const next = change(await read());
        await write(next);
        return next;
      });
      // 队列不能因为一次失败而卡住
      queue = run.catch(() => {});
      return run;
    },
  };
}
```
:::

:::variant{kind=wrong name=no-queue fails=tests reason="修改没有排队：同时发出的修改读到同一个旧值，后写的覆盖先写的（正文中实测 20 次只剩 1 次）"}
```ts file=json-store.ts
/** 需要用到的文件操作：和 node:fs/promises 的同名函数一样，测试中换成一个假的 */
export type FileSystem = Readonly<{
  readFile(path: string): Promise<string>;
  writeFile(path: string, data: string): Promise<void>;
  rename(from: string, to: string): Promise<void>;
}>;

export type StoreOptions<T> = Readonly<{
  /** 文件还不存在时的内容 */
  initial: T;
  /** 校验读出来的数据：不合法时返回 null */
  parse: (value: unknown) => T | null;
}>;

export type JsonStore<T> = Readonly<{
  read(): Promise<T>;
  update(change: (current: T) => T): Promise<T>;
}>;

/** 文件存在，但内容不是合法的数据：不能当作“没有数据”，否则下一次写入会把它覆盖掉 */
export class StoreCorruptError extends Error {
  constructor(path: string) {
    super(`数据文件已损坏：${path}`);
    this.name = 'StoreCorruptError';
  }
}

/** rename 的目标文件正被别的程序打开时，Windows 上会暂时失败 */
const RETRYABLE = new Set(['EPERM', 'EBUSY']);
const RENAME_ATTEMPTS = 4;

const codeOf = (error: unknown) => (typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined);

export function createJsonStore<T>(fs: FileSystem, path: string, options: StoreOptions<T>): JsonStore<T> {
  /** 所有的 update 排成一队：前一个完成（不管成功还是失败）之后，后一个才开始 */
  let queue: Promise<unknown> = Promise.resolve();

  async function read(): Promise<T> {
    let text: string;
    try {
      text = await fs.readFile(path);
    } catch (error) {
      if (codeOf(error) === 'ENOENT') return options.initial;
      throw error;
    }
    let value: unknown;
    try {
      value = JSON.parse(text);
    } catch {
      throw new StoreCorruptError(path);
    }
    const data = options.parse(value);
    if (data === null) throw new StoreCorruptError(path);
    return data;
  }

  async function renameWithRetry(from: string, to: string): Promise<void> {
    for (let attempt = 1; ; attempt++) {
      try {
        await fs.rename(from, to);
        return;
      } catch (error) {
        const code = codeOf(error);
        if (typeof code !== 'string' || !RETRYABLE.has(code) || attempt === RENAME_ATTEMPTS) throw error;
      }
    }
  }

  async function write(data: T): Promise<void> {
    // 先写到旁边的临时文件，再用 rename 一步替换：读的人看到的要么是旧的文件，要么是新的文件
    const temporary = `${path}.tmp`;
    await fs.writeFile(temporary, JSON.stringify(data));
    await renameWithRetry(temporary, path);
  }

  return {
    read,
    update(change) {
      const run = (async () => {
        const next = change(await read());
        await write(next);
        return next;
      })();
      // 队列不能因为一次失败而卡住
      queue = run.catch(() => {});
      return run;
    },
  };
}
```
:::

:::variant{kind=wrong name=queue-stuck fails=tests reason="队列接上了失败的 Promise：一次失败之后，后面所有的修改都失败了"}
```ts file=json-store.ts
/** 需要用到的文件操作：和 node:fs/promises 的同名函数一样，测试中换成一个假的 */
export type FileSystem = Readonly<{
  readFile(path: string): Promise<string>;
  writeFile(path: string, data: string): Promise<void>;
  rename(from: string, to: string): Promise<void>;
}>;

export type StoreOptions<T> = Readonly<{
  /** 文件还不存在时的内容 */
  initial: T;
  /** 校验读出来的数据：不合法时返回 null */
  parse: (value: unknown) => T | null;
}>;

export type JsonStore<T> = Readonly<{
  read(): Promise<T>;
  update(change: (current: T) => T): Promise<T>;
}>;

/** 文件存在，但内容不是合法的数据：不能当作“没有数据”，否则下一次写入会把它覆盖掉 */
export class StoreCorruptError extends Error {
  constructor(path: string) {
    super(`数据文件已损坏：${path}`);
    this.name = 'StoreCorruptError';
  }
}

/** rename 的目标文件正被别的程序打开时，Windows 上会暂时失败 */
const RETRYABLE = new Set(['EPERM', 'EBUSY']);
const RENAME_ATTEMPTS = 4;

const codeOf = (error: unknown) => (typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined);

export function createJsonStore<T>(fs: FileSystem, path: string, options: StoreOptions<T>): JsonStore<T> {
  /** 所有的 update 排成一队：前一个完成（不管成功还是失败）之后，后一个才开始 */
  let queue: Promise<unknown> = Promise.resolve();

  async function read(): Promise<T> {
    let text: string;
    try {
      text = await fs.readFile(path);
    } catch (error) {
      if (codeOf(error) === 'ENOENT') return options.initial;
      throw error;
    }
    let value: unknown;
    try {
      value = JSON.parse(text);
    } catch {
      throw new StoreCorruptError(path);
    }
    const data = options.parse(value);
    if (data === null) throw new StoreCorruptError(path);
    return data;
  }

  async function renameWithRetry(from: string, to: string): Promise<void> {
    for (let attempt = 1; ; attempt++) {
      try {
        await fs.rename(from, to);
        return;
      } catch (error) {
        const code = codeOf(error);
        if (typeof code !== 'string' || !RETRYABLE.has(code) || attempt === RENAME_ATTEMPTS) throw error;
      }
    }
  }

  async function write(data: T): Promise<void> {
    // 先写到旁边的临时文件，再用 rename 一步替换：读的人看到的要么是旧的文件，要么是新的文件
    const temporary = `${path}.tmp`;
    await fs.writeFile(temporary, JSON.stringify(data));
    await renameWithRetry(temporary, path);
  }

  return {
    read,
    update(change) {
      const run = queue.then(async () => {
        const next = change(await read());
        await write(next);
        return next;
      });
      // 队列不能因为一次失败而卡住
      queue = run;
      return run;
    },
  };
}
```
:::

:::variant{kind=wrong name=reset-on-corrupt fails=tests reason="文件损坏时当作没有数据：下一次修改用初始的内容覆盖了它，原来的数据彻底没了"}
```ts file=json-store.ts
/** 需要用到的文件操作：和 node:fs/promises 的同名函数一样，测试中换成一个假的 */
export type FileSystem = Readonly<{
  readFile(path: string): Promise<string>;
  writeFile(path: string, data: string): Promise<void>;
  rename(from: string, to: string): Promise<void>;
}>;

export type StoreOptions<T> = Readonly<{
  /** 文件还不存在时的内容 */
  initial: T;
  /** 校验读出来的数据：不合法时返回 null */
  parse: (value: unknown) => T | null;
}>;

export type JsonStore<T> = Readonly<{
  read(): Promise<T>;
  update(change: (current: T) => T): Promise<T>;
}>;

/** 文件存在，但内容不是合法的数据：不能当作“没有数据”，否则下一次写入会把它覆盖掉 */
export class StoreCorruptError extends Error {
  constructor(path: string) {
    super(`数据文件已损坏：${path}`);
    this.name = 'StoreCorruptError';
  }
}

/** rename 的目标文件正被别的程序打开时，Windows 上会暂时失败 */
const RETRYABLE = new Set(['EPERM', 'EBUSY']);
const RENAME_ATTEMPTS = 4;

const codeOf = (error: unknown) => (typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined);

export function createJsonStore<T>(fs: FileSystem, path: string, options: StoreOptions<T>): JsonStore<T> {
  /** 所有的 update 排成一队：前一个完成（不管成功还是失败）之后，后一个才开始 */
  let queue: Promise<unknown> = Promise.resolve();

  async function read(): Promise<T> {
    let text: string;
    try {
      text = await fs.readFile(path);
    } catch (error) {
      if (codeOf(error) === 'ENOENT') return options.initial;
      throw error;
    }
    let value: unknown;
    try {
      value = JSON.parse(text);
    } catch {
      return options.initial;
    }
    const data = options.parse(value);
    if (data === null) throw new StoreCorruptError(path);
    return data;
  }

  async function renameWithRetry(from: string, to: string): Promise<void> {
    for (let attempt = 1; ; attempt++) {
      try {
        await fs.rename(from, to);
        return;
      } catch (error) {
        const code = codeOf(error);
        if (typeof code !== 'string' || !RETRYABLE.has(code) || attempt === RENAME_ATTEMPTS) throw error;
      }
    }
  }

  async function write(data: T): Promise<void> {
    // 先写到旁边的临时文件，再用 rename 一步替换：读的人看到的要么是旧的文件，要么是新的文件
    const temporary = `${path}.tmp`;
    await fs.writeFile(temporary, JSON.stringify(data));
    await renameWithRetry(temporary, path);
  }

  return {
    read,
    update(change) {
      const run = queue.then(async () => {
        const next = change(await read());
        await write(next);
        return next;
      });
      // 队列不能因为一次失败而卡住
      queue = run.catch(() => {});
      return run;
    },
  };
}
```
:::

:::variant{kind=wrong name=no-retry fails=tests reason="rename 失败一次就放弃：Windows 上目标文件正被读取时，写入会偶尔失败（正文中实测）"}
```ts file=json-store.ts
/** 需要用到的文件操作：和 node:fs/promises 的同名函数一样，测试中换成一个假的 */
export type FileSystem = Readonly<{
  readFile(path: string): Promise<string>;
  writeFile(path: string, data: string): Promise<void>;
  rename(from: string, to: string): Promise<void>;
}>;

export type StoreOptions<T> = Readonly<{
  /** 文件还不存在时的内容 */
  initial: T;
  /** 校验读出来的数据：不合法时返回 null */
  parse: (value: unknown) => T | null;
}>;

export type JsonStore<T> = Readonly<{
  read(): Promise<T>;
  update(change: (current: T) => T): Promise<T>;
}>;

/** 文件存在，但内容不是合法的数据：不能当作“没有数据”，否则下一次写入会把它覆盖掉 */
export class StoreCorruptError extends Error {
  constructor(path: string) {
    super(`数据文件已损坏：${path}`);
    this.name = 'StoreCorruptError';
  }
}

/** rename 的目标文件正被别的程序打开时，Windows 上会暂时失败 */
const RETRYABLE = new Set(['EPERM', 'EBUSY']);
const RENAME_ATTEMPTS = 4;

const codeOf = (error: unknown) => (typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined);

export function createJsonStore<T>(fs: FileSystem, path: string, options: StoreOptions<T>): JsonStore<T> {
  /** 所有的 update 排成一队：前一个完成（不管成功还是失败）之后，后一个才开始 */
  let queue: Promise<unknown> = Promise.resolve();

  async function read(): Promise<T> {
    let text: string;
    try {
      text = await fs.readFile(path);
    } catch (error) {
      if (codeOf(error) === 'ENOENT') return options.initial;
      throw error;
    }
    let value: unknown;
    try {
      value = JSON.parse(text);
    } catch {
      throw new StoreCorruptError(path);
    }
    const data = options.parse(value);
    if (data === null) throw new StoreCorruptError(path);
    return data;
  }

  async function renameWithRetry(from: string, to: string): Promise<void> {
    for (let attempt = 1; ; attempt++) {
      try {
        await fs.rename(from, to);
        return;
      } catch (error) {
        const code = codeOf(error);
        if (typeof code !== 'string' || !RETRYABLE.has(code) || attempt === RENAME_ATTEMPTS) throw error;
      }
    }
  }

  async function write(data: T): Promise<void> {
    // 先写到旁边的临时文件，再用 rename 一步替换：读的人看到的要么是旧的文件，要么是新的文件
    const temporary = `${path}.tmp`;
    await fs.writeFile(temporary, JSON.stringify(data));
    await fs.rename(temporary, path);
  }

  return {
    read,
    update(change) {
      const run = queue.then(async () => {
        const next = change(await read());
        await write(next);
        return next;
      });
      // 队列不能因为一次失败而卡住
      queue = run.catch(() => {});
      return run;
    },
  };
}
```
:::

:::variant{kind=wrong name=retry-everything fails=tests reason="所有的错误都重试：EXDEV 这样不会自己好的错误也试了 4 次"}
```ts file=json-store.ts
/** 需要用到的文件操作：和 node:fs/promises 的同名函数一样，测试中换成一个假的 */
export type FileSystem = Readonly<{
  readFile(path: string): Promise<string>;
  writeFile(path: string, data: string): Promise<void>;
  rename(from: string, to: string): Promise<void>;
}>;

export type StoreOptions<T> = Readonly<{
  /** 文件还不存在时的内容 */
  initial: T;
  /** 校验读出来的数据：不合法时返回 null */
  parse: (value: unknown) => T | null;
}>;

export type JsonStore<T> = Readonly<{
  read(): Promise<T>;
  update(change: (current: T) => T): Promise<T>;
}>;

/** 文件存在，但内容不是合法的数据：不能当作“没有数据”，否则下一次写入会把它覆盖掉 */
export class StoreCorruptError extends Error {
  constructor(path: string) {
    super(`数据文件已损坏：${path}`);
    this.name = 'StoreCorruptError';
  }
}

/** rename 的目标文件正被别的程序打开时，Windows 上会暂时失败 */
const RETRYABLE = new Set(['EPERM', 'EBUSY']);
const RENAME_ATTEMPTS = 4;

const codeOf = (error: unknown) => (typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined);

export function createJsonStore<T>(fs: FileSystem, path: string, options: StoreOptions<T>): JsonStore<T> {
  /** 所有的 update 排成一队：前一个完成（不管成功还是失败）之后，后一个才开始 */
  let queue: Promise<unknown> = Promise.resolve();

  async function read(): Promise<T> {
    let text: string;
    try {
      text = await fs.readFile(path);
    } catch (error) {
      if (codeOf(error) === 'ENOENT') return options.initial;
      throw error;
    }
    let value: unknown;
    try {
      value = JSON.parse(text);
    } catch {
      throw new StoreCorruptError(path);
    }
    const data = options.parse(value);
    if (data === null) throw new StoreCorruptError(path);
    return data;
  }

  async function renameWithRetry(from: string, to: string): Promise<void> {
    for (let attempt = 1; ; attempt++) {
      try {
        await fs.rename(from, to);
        return;
      } catch (error) {
        const code = codeOf(error);
        if (attempt === RENAME_ATTEMPTS) throw error;
      }
    }
  }

  async function write(data: T): Promise<void> {
    // 先写到旁边的临时文件，再用 rename 一步替换：读的人看到的要么是旧的文件，要么是新的文件
    const temporary = `${path}.tmp`;
    await fs.writeFile(temporary, JSON.stringify(data));
    await renameWithRetry(temporary, path);
  }

  return {
    read,
    update(change) {
      const run = queue.then(async () => {
        const next = change(await read());
        await write(next);
        return next;
      });
      // 队列不能因为一次失败而卡住
      queue = run.catch(() => {});
      return run;
    },
  };
}
```
:::

:::variant{kind=wrong name=swallow-read-errors fails=tests reason="读取的所有错误都当作文件不存在：没有权限读取时也返回了初始的内容"}
```ts file=json-store.ts
/** 需要用到的文件操作：和 node:fs/promises 的同名函数一样，测试中换成一个假的 */
export type FileSystem = Readonly<{
  readFile(path: string): Promise<string>;
  writeFile(path: string, data: string): Promise<void>;
  rename(from: string, to: string): Promise<void>;
}>;

export type StoreOptions<T> = Readonly<{
  /** 文件还不存在时的内容 */
  initial: T;
  /** 校验读出来的数据：不合法时返回 null */
  parse: (value: unknown) => T | null;
}>;

export type JsonStore<T> = Readonly<{
  read(): Promise<T>;
  update(change: (current: T) => T): Promise<T>;
}>;

/** 文件存在，但内容不是合法的数据：不能当作“没有数据”，否则下一次写入会把它覆盖掉 */
export class StoreCorruptError extends Error {
  constructor(path: string) {
    super(`数据文件已损坏：${path}`);
    this.name = 'StoreCorruptError';
  }
}

/** rename 的目标文件正被别的程序打开时，Windows 上会暂时失败 */
const RETRYABLE = new Set(['EPERM', 'EBUSY']);
const RENAME_ATTEMPTS = 4;

const codeOf = (error: unknown) => (typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined);

export function createJsonStore<T>(fs: FileSystem, path: string, options: StoreOptions<T>): JsonStore<T> {
  /** 所有的 update 排成一队：前一个完成（不管成功还是失败）之后，后一个才开始 */
  let queue: Promise<unknown> = Promise.resolve();

  async function read(): Promise<T> {
    let text: string;
    try {
      text = await fs.readFile(path);
    } catch (error) {
      void error;
      return options.initial;
    }
    let value: unknown;
    try {
      value = JSON.parse(text);
    } catch {
      throw new StoreCorruptError(path);
    }
    const data = options.parse(value);
    if (data === null) throw new StoreCorruptError(path);
    return data;
  }

  async function renameWithRetry(from: string, to: string): Promise<void> {
    for (let attempt = 1; ; attempt++) {
      try {
        await fs.rename(from, to);
        return;
      } catch (error) {
        const code = codeOf(error);
        if (typeof code !== 'string' || !RETRYABLE.has(code) || attempt === RENAME_ATTEMPTS) throw error;
      }
    }
  }

  async function write(data: T): Promise<void> {
    // 先写到旁边的临时文件，再用 rename 一步替换：读的人看到的要么是旧的文件，要么是新的文件
    const temporary = `${path}.tmp`;
    await fs.writeFile(temporary, JSON.stringify(data));
    await renameWithRetry(temporary, path);
  }

  return {
    read,
    update(change) {
      const run = queue.then(async () => {
        const next = change(await read());
        await write(next);
        return next;
      });
      // 队列不能因为一次失败而卡住
      queue = run.catch(() => {});
      return run;
    },
  };
}
```
:::

