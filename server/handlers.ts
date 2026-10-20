/**
 * API 路由（Web 标准 Request → Response），同时用于 Vercel Function 与本地开发服务器：
 *   GET  /api/health
 *   GET  /api/sync          拉取同步文档
 *   PUT  /api/sync          推送（乐观并发：baseRevision 不一致返回 409）
 *   GET  /api/ai/status     AI 是否已配置
 *   POST /api/ai            问 AI（流式文本）
 */
import { z } from 'zod';
import { validateState } from '../src/storage/transfer.js';
import { aiConfigFromEnv, askSchema, streamAnswer, type AiConfig } from './ai.js';
import { bearerToken, verifyPassword } from './auth.js';
import type { SyncStore } from './sync-store.js';

export const MAX_SYNC_BYTES = 2 * 1024 * 1024;
const MAX_AI_BYTES = 200 * 1024;

export interface Deps {
  store: SyncStore | undefined;
  passwordHash: string | undefined;
  ai: AiConfig;
}

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };

function json(status: number, body: unknown, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...JSON_HEADERS, ...extra } });
}

const putSchema = z.object({
  baseRevision: z.number().int().min(0),
  epoch: z.string().regex(/^[a-z0-9]{8,40}$/),
  state: z.unknown(),
});

async function readBody(request: Request, limit: number): Promise<{ ok: true; text: string } | { ok: false; response: Response }> {
  const declared = Number(request.headers.get('content-length') ?? '0');
  if (declared > limit) return { ok: false, response: json(413, { error: '请求体太大' }) };
  const text = await request.text();
  if (new TextEncoder().encode(text).length > limit) return { ok: false, response: json(413, { error: '请求体太大' }) };
  return { ok: true, text };
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

async function authorize(request: Request, deps: Deps): Promise<Response | undefined> {
  if (!deps.passwordHash) return json(503, { error: '服务器没有配置同步密码（SYNC_PASSWORD_HASH）' });
  if (!verifyPassword(bearerToken(request), deps.passwordHash)) {
    // 固定延迟，减缓在线猜测
    await new Promise((r) => setTimeout(r, 400));
    return json(401, { error: '同步密码不正确' });
  }
  return undefined;
}

export async function handleApi(request: Request, deps: Deps): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '');

  if (path === '/api/health') {
    return json(200, { ok: true, sync: Boolean(deps.store && deps.passwordHash), ai: Boolean(deps.ai.apiKey) });
  }

  if (path === '/api/sync') {
    const denied = await authorize(request, deps);
    if (denied) return denied;
    if (!deps.store) return json(503, { error: '服务器没有配置数据库（DATABASE_URL）' });

    if (request.method === 'GET') {
      const doc = await deps.store.get();
      return json(200, doc ?? { revision: 0, epoch: null, state: null, updatedAt: null });
    }
    if (request.method === 'PUT') {
      const body = await readBody(request, MAX_SYNC_BYTES);
      if (!body.ok) return body.response;
      const parsed = putSchema.safeParse(parseJson(body.text));
      if (!parsed.success) return json(400, { error: '请求格式不正确' });
      const state = validateState(parsed.data.state);
      if (!state.ok) return json(400, { error: state.error });
      const result = await deps.store.put(parsed.data.baseRevision, parsed.data.epoch, state.state);
      if (!result.ok) return json(409, result.current ?? { revision: 0, epoch: null, state: null, updatedAt: null });
      return json(200, { revision: result.doc.revision, epoch: result.doc.epoch, updatedAt: result.doc.updatedAt });
    }
    return json(405, { error: '不支持的方法' }, { allow: 'GET, PUT' });
  }

  if (path === '/api/ai/status') {
    return json(200, { configured: Boolean(deps.ai.apiKey && deps.passwordHash), model: deps.ai.apiKey ? deps.ai.model : null });
  }

  if (path === '/api/ai') {
    if (request.method !== 'POST') return json(405, { error: '不支持的方法' }, { allow: 'POST' });
    const denied = await authorize(request, deps);
    if (denied) return denied;
    if (!deps.ai.apiKey) return json(503, { error: '服务器没有配置 ANTHROPIC_API_KEY' });
    const body = await readBody(request, MAX_AI_BYTES);
    if (!body.ok) return body.response;
    const parsed = askSchema.safeParse(parseJson(body.text));
    if (!parsed.success) return json(400, { error: '请求格式不正确' });
    return new Response(streamAnswer(deps.ai, parsed.data, request.signal), {
      status: 200,
      headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' },
    });
  }

  return json(404, { error: '未知的 API 路径' });
}

export { aiConfigFromEnv };
