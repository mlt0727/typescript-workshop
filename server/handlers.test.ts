import { describe, expect, test } from 'vitest';
import { generatePassword, hashPassword, verifyPassword } from './auth.ts';
import { handleApi, MAX_SYNC_BYTES, type Deps } from './handlers.ts';
import { MemoryStore } from './sync-store.ts';

const password = generatePassword();
const deps = (): Deps => ({
  store: new MemoryStore(),
  passwordHash: hashPassword(password),
  ai: { apiKey: undefined, model: 'claude-opus-5-5', effort: 'medium' },
});

const req = (method: string, path: string, body?: unknown, auth: string | null = password) =>
  new Request(`http://localhost${path}`, {
    method,
    headers: { ...(auth ? { authorization: `Bearer ${auth}` } : {}), 'content-type': 'application/json' },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });

const emptyState = { lessons: {}, drafts: {}, meta: {} };
const stateWithLesson = {
  lessons: { l1: { lessonId: 'l1', lessonVersion: 1, readBlocks: ['p1'], exercises: {}, quiz: {}, playgrounds: {}, updatedAt: 1 } },
  drafts: {},
  meta: {},
};

describe('密码', () => {
  test('生成的密码格式与校验', () => {
    expect(password).toMatch(/^tsw-([0-9A-HJKMNP-TV-Z]{5}-){4}[0-9A-HJKMNP-TV-Z]{5}$/);
    expect(verifyPassword(password, hashPassword(password))).toBe(true);
    expect(verifyPassword(`${password}x`, hashPassword(password))).toBe(false);
    expect(verifyPassword(password, undefined)).toBe(false);
    expect(verifyPassword(undefined, hashPassword(password))).toBe(false);
  });
});

describe('/api/sync', () => {
  test('没有或错误的密码返回 401', async () => {
    const d = deps();
    expect((await handleApi(req('GET', '/api/sync', undefined, null), d)).status).toBe(401);
    expect((await handleApi(req('GET', '/api/sync', undefined, 'wrong'), d)).status).toBe(401);
  });

  test('未配置密码哈希时返回 503，而不是放行', async () => {
    const res = await handleApi(req('GET', '/api/sync'), { ...deps(), passwordHash: undefined });
    expect(res.status).toBe(503);
  });

  test('拉取空文档、推送、再拉取', async () => {
    const d = deps();
    const empty = await (await handleApi(req('GET', '/api/sync'), d)).json();
    expect(empty).toMatchObject({ revision: 0, state: null });
    const put = await handleApi(req('PUT', '/api/sync', { baseRevision: 0, epoch: 'abcdefgh', state: stateWithLesson }), d);
    expect(put.status).toBe(200);
    expect(await put.json()).toMatchObject({ revision: 1, epoch: 'abcdefgh' });
    const got = await (await handleApi(req('GET', '/api/sync'), d)).json();
    expect(got).toMatchObject({ revision: 1, state: stateWithLesson });
  });

  test('baseRevision 过期时返回 409 与当前文档（乐观并发）', async () => {
    const d = deps();
    await handleApi(req('PUT', '/api/sync', { baseRevision: 0, epoch: 'abcdefgh', state: stateWithLesson }), d);
    const stale = await handleApi(req('PUT', '/api/sync', { baseRevision: 0, epoch: 'abcdefgh', state: emptyState }), d);
    expect(stale.status).toBe(409);
    expect(await stale.json()).toMatchObject({ revision: 1, state: stateWithLesson });
  });

  test('拒绝结构不合法的进度数据', async () => {
    const d = deps();
    const bad = await handleApi(req('PUT', '/api/sync', { baseRevision: 0, epoch: 'abcdefgh', state: { lessons: { x: 1 } } }), d);
    expect(bad.status).toBe(400);
    const notJson = await handleApi(req('PUT', '/api/sync', '{nope'), d);
    expect(notJson.status).toBe(400);
  });

  test('拒绝过大的请求体', async () => {
    const big = 'x'.repeat(MAX_SYNC_BYTES + 10);
    const res = await handleApi(req('PUT', '/api/sync', big), deps());
    expect(res.status).toBe(413);
  });
});

describe('/api/ai', () => {
  test('未配置密钥时 status 显示未配置，调用返回 503', async () => {
    const d = deps();
    expect(await (await handleApi(req('GET', '/api/ai/status'), d)).json()).toEqual({ configured: false, model: null });
    const res = await handleApi(req('POST', '/api/ai', { question: 'hi' }), d);
    expect(res.status).toBe(503);
  });

  test('需要同步密码', async () => {
    const d = { ...deps(), ai: { apiKey: 'sk-test', model: 'claude-opus-5-5', effort: 'medium' as const } };
    expect((await handleApi(req('POST', '/api/ai', { question: 'hi' }, 'wrong'), d)).status).toBe(401);
  });
});

test('未知路径返回 404', async () => {
  expect((await handleApi(req('GET', '/api/nope'), deps())).status).toBe(404);
});
