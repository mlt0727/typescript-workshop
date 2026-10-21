import { describe, expect, test } from 'vitest';
import { LIMITS } from '../../../src/shared/limits.ts';
import { testResultSchema } from '../../../src/shared/sandbox-protocol.ts';
import { TestCollector } from './runner.ts';

type Api = { test: (name: string, body: () => unknown) => void };
type AsyncExpect = (actual: unknown) => {
  resolves: { toBe(v: unknown): PromiseLike<void> };
  rejects: { toThrow(v: string): PromiseLike<void> };
};

describe('没有 await 的 resolves/rejects（与 Vitest 5 一致）', () => {
  test('断言成立但没有 await：测试失败并说明原因；await、return、Promise.all 都算 await', async () => {
    const collector = new TestCollector();
    const api = collector.api() as unknown as Api & { expect: AsyncExpect };
    const e = api.expect;
    api.test('没有 await', () => {
      void e(Promise.resolve(1)).resolves.toBe(1);
    });
    api.test('await', async () => {
      await e(Promise.resolve(1)).resolves.toBe(1);
    });
    api.test('return', () => e(Promise.reject(new Error('x'))).rejects.toThrow('x'));
    api.test('Promise.all', async () => {
      await Promise.all([e(Promise.resolve(1)).resolves.toBe(1), e(Promise.resolve(2)).resolves.toBe(2)]);
    });
    api.test('没有 await，断言也不成立：报告断言的失败', () => {
      void e(Promise.resolve(1)).resolves.toBe(2);
    });
    const results = await collector.run({ locate: () => undefined }, 1000);
    expect(results.map((r) => r.status)).toEqual(['fail', 'pass', 'pass', 'pass', 'fail']);
    expect(results[0]?.error?.message).toContain('没有被 await');
    expect(results[4]?.error?.message).toContain('toBe(2)');
  });
});

describe('TestCollector 的结果', () => {
  test('很长的失败信息被截断，结果仍然符合协议（否则主页面会丢弃整条消息）', async () => {
    const collector = new TestCollector();
    const api = collector.api() as unknown as Api;
    api.test('名字'.repeat(600), () => {
      throw new Error('页面的 DOM：'.repeat(5000));
    });
    const [result] = await collector.run({ locate: () => undefined }, 1000);
    expect(result?.status).toBe('fail');
    expect(result?.error?.message.length).toBeLessThanOrEqual(LIMITS.maxLogEntryChars);
    expect(result?.error?.message).toContain('已截断');
    expect(testResultSchema.safeParse(result).success).toBe(true);
  });
});
