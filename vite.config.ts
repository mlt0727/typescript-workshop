import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { devApiPlugin } from './server/dev-plugin.ts';

interface VercelConfig {
  headers: { source: string; headers: { key: string; value: string }[] }[];
  rewrites: { source: string; destination: string }[];
}

const vercel = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, 'vercel.json'), 'utf8')) as VercelConfig;

/** 把 Vercel 的 source 模式（path-to-regexp 的常用子集）转换成正则 */
function toRegExp(source: string): RegExp {
  const pattern = source
    .replace(/:\w+\*/g, '.*')
    .replace(/:\w+/g, '[^/]+');
  return new RegExp(`^${pattern}$`);
}

/**
 * vite preview 模拟 vercel.json：同样的安全响应头（包括 CSP）与 SPA 路由重写，
 * 让本地的生产构建测试能发现 CSP 或路由问题。
 */
function vercelPreviewPlugin(): Plugin {
  return {
    name: 'tsw-vercel-preview',
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = new URL(req.url ?? '/', 'http://localhost');
        for (const rule of vercel.headers) {
          if (toRegExp(rule.source).test(url.pathname)) {
            for (const h of rule.headers) res.setHeader(h.key, h.value);
          }
        }
        for (const r of vercel.rewrites) {
          if (r.destination.startsWith('/api')) continue;
          if (toRegExp(r.source).test(url.pathname)) {
            req.url = r.destination;
            break;
          }
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), devApiPlugin(), vercelPreviewPlugin()],
  worker: { format: 'es' },
  // 预先打包（含编译器 Worker 用到的 typescript），避免首次访问时依赖重新优化导致整页刷新
  optimizeDeps: {
    include: ['typescript', 'zod', 'idb', 'react', 'react-dom/client', 'react-router'],
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 4000,
    rolldownOptions: {
      input: {
        main: path.resolve(import.meta.dirname, 'index.html'),
        verify: path.resolve(import.meta.dirname, 'verify.html'),
      },
    },
  },
});
