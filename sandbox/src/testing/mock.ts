type Procedure = (...args: unknown[]) => unknown;

export interface MockState {
  calls: unknown[][];
  results: { type: 'return' | 'throw'; value: unknown }[];
  lastCall: unknown[] | undefined;
}

export interface MockFn extends Procedure {
  mock: MockState;
  __isMock: true;
  mockImplementation(fn: Procedure): MockFn;
  mockImplementationOnce(fn: Procedure): MockFn;
  mockReturnValue(v: unknown): MockFn;
  mockReturnValueOnce(v: unknown): MockFn;
  mockResolvedValue(v: unknown): MockFn;
  mockRejectedValue(e: unknown): MockFn;
  mockClear(): MockFn;
  mockReset(): MockFn;
  mockRestore(): void;
}

const restorers = new Set<() => void>();

export function isMock(value: unknown): value is MockFn {
  return typeof value === 'function' && (value as Partial<MockFn>).__isMock === true;
}

export function fn(implementation?: Procedure, restore?: () => void): MockFn {
  let impl = implementation;
  const original = implementation;
  let once: Procedure[] = [];
  const state: MockState = { calls: [], results: [], lastCall: undefined };

  const mock = function (this: unknown, ...args: unknown[]) {
    state.calls.push(args);
    state.lastCall = args;
    const current = once.shift() ?? impl;
    try {
      const value = current ? current.apply(this, args) : undefined;
      state.results.push({ type: 'return', value });
      return value;
    } catch (error) {
      state.results.push({ type: 'throw', value: error });
      throw error;
    }
  } as MockFn;

  Object.assign(mock, {
    mock: state,
    __isMock: true as const,
    mockImplementation(f: Procedure) {
      impl = f;
      return mock;
    },
    mockImplementationOnce(f: Procedure) {
      once.push(f);
      return mock;
    },
    mockReturnValue(v: unknown) {
      impl = () => v;
      return mock;
    },
    mockReturnValueOnce(v: unknown) {
      once.push(() => v);
      return mock;
    },
    mockResolvedValue(v: unknown) {
      impl = () => Promise.resolve(v);
      return mock;
    },
    mockRejectedValue(e: unknown) {
      impl = () => Promise.reject(e);
      return mock;
    },
    mockClear() {
      state.calls = [];
      state.results = [];
      state.lastCall = undefined;
      return mock;
    },
    mockReset() {
      mock.mockClear();
      impl = original;
      once = [];
      return mock;
    },
    mockRestore() {
      mock.mockReset();
      restore?.();
      if (restore) restorers.delete(restore);
    },
  });
  return mock;
}

export function spyOn(object: Record<PropertyKey, unknown>, method: PropertyKey): MockFn {
  const original = object[method];
  if (typeof original !== 'function') {
    throw new TypeError(`vi.spyOn：${String(method)} 不是函数`);
  }
  const restore = () => {
    object[method] = original;
  };
  restorers.add(restore);
  const spy = fn((...args: unknown[]) => (original as Procedure).apply(object, args), restore);
  object[method] = spy;
  return spy;
}

export function restoreAllMocks() {
  for (const r of [...restorers]) r();
  restorers.clear();
}
