import { describe, expect, test } from 'vitest';
import { formatErrorLog, secretsFromEnv } from './log.ts';

const DATABASE_URL = 'postgresql://neondb_owner:npg_p%40ss-w0rd-1234@ep-example-123.us-east-1.aws.neon.tech/neondb?sslmode=require';
const env = { DATABASE_URL, SYNC_PASSWORD_HASH: 'a'.repeat(64), ANTHROPIC_API_KEY: 'sk-ant-test-0123456789', AI_MODEL: 'claude-opus-5-5' };
const time = new Date('2026-10-27T00:00:00.000Z');
const request = new Request('https://example.com/api/sync?token=abc', { method: 'PUT' });

describe('secretsFromEnv', () => {
  test('连接串、其中的密码（编码前后）、密码哈希、API 密钥；不包括普通的配置；长的在前', () => {
    const secrets = secretsFromEnv(env);
    expect(secrets).toEqual([DATABASE_URL, env.SYNC_PASSWORD_HASH, 'sk-ant-test-0123456789', 'npg_p%40ss-w0rd-1234', 'npg_p@ss-w0rd-1234']);
    expect(secretsFromEnv({})).toEqual([]);
    // 太短的值不替换（否则普通的文字也会被换掉）；不是网址的连接串整串替换
    expect(secretsFromEnv({ ANTHROPIC_API_KEY: 'short', DATABASE_URL: 'not a url at all' })).toEqual(['not a url at all']);
  });
});

describe('formatErrorLog', () => {
  const secrets = secretsFromEnv(env);
  const parse = (line: string) => JSON.parse(line) as Record<string, unknown>;

  test('一行 JSON：时间、级别、方法、只有路径；错误的名字、信息和 cause', () => {
    const error = new TypeError('fetch failed', { cause: new Error('ECONNRESET') });
    const line = formatErrorLog(request, error, secrets, time);
    expect(line).not.toContain('\n');
    expect(parse(line)).toEqual({
      time: '2026-10-27T00:00:00.000Z',
      level: 'error',
      message: 'PUT /api/sync 出错',
      method: 'PUT',
      path: '/api/sync',
      error: { name: 'TypeError', message: 'fetch failed', cause: { name: 'Error', message: 'ECONNRESET' } },
    });
    expect(line).not.toContain('token');
    expect(line).not.toContain('stack');
  });

  test('密钥在错误信息、名字和 cause 中都被替换', () => {
    const error = new Error(`connect failed: ${DATABASE_URL}`, { cause: new Error('password authentication failed: npg_p@ss-w0rd-1234') });
    error.name = `Neon ${env.ANTHROPIC_API_KEY}`;
    const line = formatErrorLog(request, error, secrets, time);
    for (const secret of secrets) expect(line).not.toContain(secret);
    expect(parse(line).error).toEqual({
      name: 'Neon [REDACTED]',
      message: 'connect failed: [REDACTED]',
      cause: { name: 'Error', message: 'password authentication failed: [REDACTED]' },
    });
  });

  test('抛出的不是 Error；读取时抛出错误的值；循环的 cause；过长的信息', () => {
    expect(parse(formatErrorLog(request, 'boom', secrets, time)).error).toBe('boom');
    const hostile = { toString: () => { throw new Error('no'); } };
    expect(parse(formatErrorLog(request, hostile, secrets, time)).error).toBe('[Unreadable]');
    const loop = new Error('a');
    loop.cause = loop;
    expect(JSON.stringify(parse(formatErrorLog(request, loop, secrets, time)).error)).toContain('[Too deep]');
    const long = parse(formatErrorLog(request, new Error('字'.repeat(600)), secrets, time)).error as { message: string };
    expect(long.message).toBe(`${'字'.repeat(500)}…（共 600 个字符）`);
  });
});
