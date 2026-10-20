/**
 * 构建沙箱运行时到 public/sandbox/：
 *   index.html          运行页（带 CSP）
 *   frame.js            核心运行时（经典脚本 IIFE；内联纯 TS 模式的 Worker）
 *   react-runtime.js    React 19 开发版 + @testing-library/react
 *
 * 经典脚本 + 不带 crossorigin 属性：不透明来源的页面加载它们不需要 CORS。
 * 用法：tsx scripts/build-sandbox.ts [--watch]
 */
import fs from 'node:fs';
import path from 'node:path';
import { build, type InlineConfig } from 'vite';

const root = path.resolve(import.meta.dirname, '..');
const outDir = path.join(root, 'public', 'sandbox');
const watch = process.argv.includes('--watch');

function config(name: string, entry: string, mode: 'development' | 'production', globals: Record<string, string> = {}): InlineConfig {
  return {
    configFile: false,
    root,
    logLevel: 'warn',
    mode,
    define: { 'process.env.NODE_ENV': JSON.stringify(mode) },
    worker: { format: 'iife' },
    build: {
      outDir,
      emptyOutDir: false,
      copyPublicDir: false,
      minify: true,
      sourcemap: false,
      target: 'es2022',
      watch: watch ? {} : null,
      lib: {
        entry: path.join(root, entry),
        name: `__tsw_${name.replace(/-/g, '_')}__`,
        formats: ['iife'],
        fileName: () => `${name}.js`,
      },
      rolldownOptions: {
        external: Object.keys(globals),
        output: { globals },
      },
    },
  };
}

fs.mkdirSync(outDir, { recursive: true });
fs.copyFileSync(path.join(root, 'sandbox', 'index.html'), path.join(outDir, 'index.html'));

await build(config('frame', 'sandbox/src/frame.ts', 'production'));
// 注意：@testing-library/react 使用 export * from '@testing-library/dom'，IIFE 下不能把它设为外部依赖
await build(config('react-runtime', 'sandbox/src/react-runtime.ts', 'development'));

for (const f of fs.readdirSync(outDir)) {
  const kb = Math.round(fs.statSync(path.join(outDir, f)).size / 1024);
  console.log(`  public/sandbox/${f}  ${kb} KB`);
}
