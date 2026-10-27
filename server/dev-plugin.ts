/**
 * 本地开发：把 /api/* 交给与线上相同的 handlers，存储用 .data/sync.json。
 * 读取 .env.local 中的 SYNC_PASSWORD_HASH / ANTHROPIC_API_KEY 等（该文件已被 .gitignore 忽略）。
 */
import path from 'node:path';
import { Readable } from 'node:stream';
import type { Plugin } from 'vite';
import { loadEnv } from 'vite';
import { aiConfigFromEnv, handleApi } from './handlers.js';
import { formatErrorLog, secretsFromEnv } from './log.js';
import { FileStore } from './sync-store.js';

export function devApiPlugin(): Plugin {
  return {
    name: 'tsw-dev-api',
    configureServer(server) {
      const env = loadEnv(server.config.mode, server.config.root, '');
      const store = new FileStore(env.TSW_SYNC_FILE || path.join(server.config.root, '.data', 'sync.json'));
      const secrets = secretsFromEnv(env);
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next();
        try {
          const chunks: Buffer[] = [];
          for await (const c of req) chunks.push(c as Buffer);
          const body = chunks.length ? Buffer.concat(chunks) : undefined;
          const controller = new AbortController();
          res.on('close', () => controller.abort());
          const request = new Request(`http://${req.headers.host ?? 'localhost'}${req.url}`, {
            method: req.method,
            headers: req.headers as Record<string, string>,
            body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body,
            signal: controller.signal,
          });
          const response = await handleApi(request, {
            store,
            passwordHash: env.SYNC_PASSWORD_HASH,
            ai: aiConfigFromEnv(env),
            logError: (req, error) => console.error(formatErrorLog(req, error, secrets)),
          });
          res.statusCode = response.status;
          response.headers.forEach((v, k) => res.setHeader(k, v));
          if (response.body) Readable.fromWeb(response.body as never).pipe(res);
          else res.end();
        } catch (err) {
          next(err);
        }
      });
    },
  };
}
