import { describe, expect, test } from 'vitest';
import { LIMITS } from '../../../src/shared/limits.ts';
import { testResultSchema } from '../../../src/shared/sandbox-protocol.ts';
import { TestCollector } from './runner.ts';

type Api = { test: (name: string, body: () => unknown) => void };

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
