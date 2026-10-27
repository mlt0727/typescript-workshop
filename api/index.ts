/**
 * Vercel Function 入口：所有 /api/* 请求经 vercel.json 的 rewrite 转到这里，由 server/handlers.ts 分发。
 * 环境变量：SYNC_PASSWORD_HASH、DATABASE_URL、ANTHROPIC_API_KEY（可选）、AI_MODEL（可选）、AI_EFFORT（可选）。
 */
import { aiConfigFromEnv, handleApi } from '../server/handlers.js';
import { formatErrorLog, secretsFromEnv } from '../server/log.js';
import { NeonStore } from '../server/sync-store.js';

const store = process.env.DATABASE_URL ? new NeonStore(process.env.DATABASE_URL) : undefined;
const secrets = secretsFromEnv(process.env);
// 一行 JSON：只有错误的名字和信息，密钥换成 [REDACTED]。写到标准错误，Vercel 的运行日志中级别为 error
const logError = (request: Request, error: unknown) => console.error(formatErrorLog(request, error, secrets));

export default {
  async fetch(request: Request): Promise<Response> {
    try {
      return await handleApi(request, {
        store,
        passwordHash: process.env.SYNC_PASSWORD_HASH,
        ai: aiConfigFromEnv(process.env),
        logError,
      });
    } catch (err) {
      logError(request, err);
      return new Response(JSON.stringify({ error: '服务器内部错误' }), {
        status: 500,
        headers: { 'content-type': 'application/json; charset=utf-8' },
      });
    }
  },
};
