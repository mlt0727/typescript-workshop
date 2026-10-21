// TypeScript 工坊内置测试 API：Vitest 的兼容子集（只声明平台真正实现了的部分）。
// 在浏览器沙箱中运行；本地项目请使用真正的 Vitest（课程 F06）。

type Awaitable<T> = T | PromiseLike<T>;
type Procedure = (...args: any[]) => any;

export type TestFunction = () => Awaitable<void>;

export interface TestAPI {
  (name: string, fn: TestFunction, timeout?: number): void;
  /** 跳过此测试（结果中显示为“跳过”）。 */
  skip(name: string, fn: TestFunction, timeout?: number): void;
  /**
   * 为每组参数生成一个测试；名称中的 %s / %d / %i / %j / %o 依次被参数替换。
   * 每组参数是数组时展开为多个参数（与 Vitest 相同）。
   */
  each<T extends readonly unknown[] | [unknown]>(cases: readonly T[]): (name: string, fn: (...args: T) => Awaitable<void>, timeout?: number) => void;
  each<T>(cases: readonly T[]): (name: string, fn: (arg: T) => Awaitable<void>, timeout?: number) => void;
}

export declare const test: TestAPI;
export declare const it: TestAPI;
export declare function describe(name: string, fn: () => void): void;
export declare function beforeEach(fn: () => Awaitable<void>): void;
export declare function afterEach(fn: () => Awaitable<void>): void;
export declare function beforeAll(fn: () => Awaitable<void>): void;
export declare function afterAll(fn: () => Awaitable<void>): void;

export interface Matchers<R> {
  toBe(expected: unknown): R;
  toEqual(expected: unknown): R;
  toStrictEqual(expected: unknown): R;
  toBeTruthy(): R;
  toBeFalsy(): R;
  toBeNull(): R;
  toBeUndefined(): R;
  toBeDefined(): R;
  toBeNaN(): R;
  toBeTypeOf(
    expected: 'bigint' | 'boolean' | 'function' | 'number' | 'object' | 'string' | 'symbol' | 'undefined',
  ): R;
  toBeInstanceOf(expected: abstract new (...args: any[]) => unknown): R;
  toContain(item: unknown): R;
  toContainEqual(item: unknown): R;
  toHaveLength(length: number): R;
  toHaveProperty(path: string | readonly (string | number)[], value?: unknown): R;
  toMatchObject(expected: object | readonly object[]): R;
  toBeGreaterThan(expected: number | bigint): R;
  toBeGreaterThanOrEqual(expected: number | bigint): R;
  toBeLessThan(expected: number | bigint): R;
  toBeLessThanOrEqual(expected: number | bigint): R;
  toBeCloseTo(expected: number, numDigits?: number): R;
  toMatch(expected: string | RegExp): R;
  toThrow(expected?: string | RegExp | (abstract new (...args: any[]) => Error) | Error): R;
  toThrowError(expected?: string | RegExp | (abstract new (...args: any[]) => Error) | Error): R;
  toHaveBeenCalled(): R;
  toHaveBeenCalledTimes(times: number): R;
  toHaveBeenCalledWith(...args: unknown[]): R;
  toHaveBeenLastCalledWith(...args: unknown[]): R;
  toHaveReturnedWith(value: unknown): R;

  // —— DOM 断言（与 @testing-library/jest-dom 同名同义的子集）——
  toBeInTheDocument(): R;
  toHaveTextContent(text: string | RegExp, options?: { normalizeWhitespace?: boolean }): R;
  toHaveValue(value?: string | number | readonly string[] | null): R;
  toBeDisabled(): R;
  toBeEnabled(): R;
  toBeRequired(): R;
  toBeChecked(): R;
  toBeVisible(): R;
  toBeEmptyDOMElement(): R;
  toHaveFocus(): R;
  toHaveAttribute(name: string, value?: string): R;
  toHaveClass(...classNames: string[]): R;
  toHaveAccessibleName(name?: string | RegExp): R;
  toHaveAccessibleDescription(description?: string | RegExp): R;
  toBeInvalid(): R;
  toBeValid(): R;
  toContainElement(element: Element | null): R;
  toHaveStyle(css: string | Record<string, string>): R;
}

export interface Assertion<T = unknown> extends Matchers<void> {
  not: Assertion<T>;
  resolves: PromisifyAssertion<Awaited<T>>;
  rejects: PromisifyAssertion<unknown>;
}

export interface PromisifyAssertion<T = unknown> extends Matchers<Promise<void>> {
  not: PromisifyAssertion<T>;
}

export interface ExpectStatic {
  <T>(actual: T, message?: string): Assertion<T>;
  /** 断言本测试中恰好执行了 n 次 expect（常用于检查异步回调确实被调用）。 */
  assertions(count: number): void;
}

export declare const expect: ExpectStatic;

export interface MockResult {
  type: 'return' | 'throw';
  value: unknown;
}

export interface MockContext<T extends Procedure> {
  calls: Parameters<T>[];
  results: MockResult[];
  lastCall: Parameters<T> | undefined;
}

export interface Mock<T extends Procedure = Procedure> {
  (...args: Parameters<T>): ReturnType<T>;
  mock: MockContext<T>;
  mockImplementation(fn: T): this;
  mockImplementationOnce(fn: T): this;
  mockReturnValue(value: ReturnType<T>): this;
  mockReturnValueOnce(value: ReturnType<T>): this;
  mockResolvedValue(value: Awaited<ReturnType<T>>): this;
  mockRejectedValue(error: unknown): this;
  mockClear(): this;
  mockReset(): this;
  mockRestore(): void;
}

export interface VitestUtils {
  fn<T extends Procedure = Procedure>(implementation?: T): Mock<T>;
  spyOn<O extends object, K extends keyof O>(
    object: O,
    method: K,
  ): O[K] extends Procedure ? Mock<O[K]> : never;
  restoreAllMocks(): void;
  /** 用可控的假计时器替换 setTimeout/setInterval/Date.now。 */
  useFakeTimers(): void;
  useRealTimers(): void;
  advanceTimersByTime(ms: number): void;
  advanceTimersByTimeAsync(ms: number): Promise<void>;
  runAllTimers(): void;
  runAllTimersAsync(): Promise<void>;
  getTimerCount(): number;
}

export declare const vi: VitestUtils;

export { expectTypeOf } from 'expect-type';

/** 只做类型层面的检查：参数必须可赋值给 T。运行时什么也不做。 */
export declare function assertType<T>(value: T): void;
