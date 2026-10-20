import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  worker: { format: 'es' },
  // 预先打包（含编译器 Worker 用到的 typescript），避免首次访问时依赖重新优化导致整页刷新
  optimizeDeps: {
    include: ['typescript', 'zod', 'idb', 'react', 'react-dom/client', 'react-router'],
  },
  build: {
    target: 'es2022',
    rolldownOptions: {
      input: {
        main: path.resolve(import.meta.dirname, 'index.html'),
        verify: path.resolve(import.meta.dirname, 'verify.html'),
      },
    },
  },
});
