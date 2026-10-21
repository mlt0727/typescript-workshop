/**
 * 把一道练习（学生当前的代码、支持文件、测试）转换成一个可以在本机运行的 Vite + Vitest 项目。
 * 纯函数：输入文件，输出“路径 → 内容”，由界面打包成 zip 下载。
 */
import { rawCheckOptions, type CompilerOverrides, type RunMode } from '../../compiler/config.ts';
import type { FetchFixture } from './local-mock-fetch.ts';

/** 生成的 package.json 使用的版本（与这个网站的仓库一致，2026-10-20 核对过 npm 上的最新版本） */
export const LOCAL_VERSIONS = {
  typescript: '6.0.3',
  vite: '^8.3.4',
  vitest: '^5.0.5',
  tsx: '^4.23.15',
  jsdom: '^30.1.3',
  '@testing-library/dom': '^10.4.2',
  '@testing-library/user-event': '^14.6.8',
  '@testing-library/jest-dom': '^7.0.1',
  '@testing-library/react': '^16.3.3',
  react: '^19.3.1',
  'react-dom': '^19.3.1',
  'react-router': '^8.5.0',
  '@types/react': '^19.3.0',
  '@types/react-dom': '^19.3.0',
  '@vitejs/plugin-react': '^6.1.2',
} as const;

type Package = keyof typeof LOCAL_VERSIONS;

export interface LocalProjectInput {
  lessonId: string;
  exerciseId: string;
  title: string;
  mode: RunMode;
  /** 入口文件（练习的 entry） */
  entry: string;
  /** 学生的文件、支持文件与测试（路径 → 内容） */
  files: Readonly<Record<string, string>>;
  overrides?: CompilerOverrides;
  /** 网站为这道题模拟的网络请求 */
  fixtures?: readonly FetchFixture[];
  /** local-mock-fetch.ts 的源代码（有 fixtures 时复制到项目中，作为测试中的 fetch） */
  mockFetchSource?: string;
  /** 课程页面的地址（写进 README） */
  lessonUrl?: string;
}

/** 文件夹 / 包名：只保留小写字母、数字和 - */
export function localProjectName(lessonId: string, exerciseId: string): string {
  return `${lessonId}-${exerciseId}`
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');
}

const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;

/** index.html 中 `<script type="module" src="./main.ts">` 指向的文件（去掉开头的 ./ 或 /） */
export function scriptEntry(html: string): string | undefined {
  for (const tag of html.match(/<script\b[^>]*>/gi) ?? []) {
    if (!/\btype\s*=\s*["']?module\b/i.test(tag)) continue;
    const src = /\bsrc\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];
    if (src !== undefined) return src.replace(/^\.?\//, '');
  }
  return undefined;
}

const escapeHtml = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function versions(names: readonly Package[]): Record<string, string> {
  return Object.fromEntries([...names].sort().map((name) => [name, LOCAL_VERSIONS[name]]));
}

/** DOM 模式：每个测试前恢复页面并重新运行入口文件（与沙箱 frame.ts 的 testPage 对应） */
function domSetup(pageEntry: string | undefined): { imports: string[]; body: string[] } {
  return {
    imports: ["import { beforeEach, vi } from 'vitest';", "import html from './index.html?raw';"],
    body: [
      '// 入口文件运行时在 window / document 上注册的监听器，在页面重新加载前移除',
      'const added: { target: EventTarget; type: string; listener: EventListenerOrEventListenerObject; capture: boolean }[] = [];',
      'const nativeAdd = EventTarget.prototype.addEventListener;',
      'let tracking = false;',
      'EventTarget.prototype.addEventListener = function (type, listener, options) {',
      '  if (tracking && listener && (this === window || this === document)) {',
      "    added.push({ target: this, type, listener, capture: typeof options === 'boolean' ? options : (options?.capture ?? false) });",
      '  }',
      '  nativeAdd.call(this, type, listener, options);',
      '};',
      '',
      'function copyAttributes(from: Element, to: Element) {',
      '  for (const { name } of [...to.attributes]) to.removeAttribute(name);',
      '  for (const { name, value } of [...from.attributes]) to.setAttribute(name, value);',
      '}',
      '',
      '/** 模拟刷新页面：页面恢复成 index.html 的初始状态，重新运行入口文件；地址和 localStorage、sessionStorage 中的数据保留 */',
      'export async function reloadPage() {',
      '  for (const { target, type, listener, capture } of added.splice(0)) target.removeEventListener(type, listener, capture);',
      "  const page = new DOMParser().parseFromString(html, 'text/html');",
      '  copyAttributes(page.documentElement, document.documentElement);',
      '  document.head.innerHTML = page.head.innerHTML;',
      '  // 保留 body 元素本身（Testing Library 的 screen 绑定在它上面），只替换属性和内容',
      '  copyAttributes(page.body, document.body);',
      '  document.body.innerHTML = page.body.innerHTML;',
      ...(pageEntry === undefined
        ? []
        : [
            '  vi.resetModules();',
            '  tracking = true;',
            '  try {',
            `    await import('./${pageEntry}');`,
            "    document.dispatchEvent(new Event('DOMContentLoaded', { bubbles: true }));",
            '  } finally {',
            '    tracking = false;',
            '  }',
          ]),
      '}',
      '',
      '// 与 TypeScript 工坊的 DOM 模式相同：每个测试从最初的地址、空的存储和 index.html 的初始页面开始',
      'const initialUrl = location.href;',
      'beforeEach(async () => {',
      '  history.replaceState(null, \'\', initialUrl);',
      '  localStorage.clear();',
      '  sessionStorage.clear();',
      '  await reloadPage();',
      '});',
    ],
  };
}

const REACT_SETUP = {
  imports: ["import { cleanup } from '@testing-library/react';", "import { afterEach, beforeEach } from 'vitest';"],
  body: [
    '// 与 TypeScript 工坊相同：每个测试从空的存储开始，测试之后卸载渲染的组件',
    'beforeEach(() => {',
    '  localStorage.clear();',
    '  sessionStorage.clear();',
    '});',
    'afterEach(() => cleanup());',
  ],
};

/** 代替 `vitest/browser`：本机的测试运行在 jsdom 中，没有布局 */
function vitestBrowserShim(mode: RunMode): string {
  return [
    '// 代替 Vitest 浏览器模式的 `vitest/browser`（见 vite.config.ts 的 alias、tsconfig.json 的 paths）。',
    '// 本机的测试运行在 jsdom 中：jsdom 没有布局，所以 viewport() 不可用；reload() 是 TypeScript 工坊的扩展。',
    ...(mode === 'dom' ? ["import { reloadPage } from './setup-tests.ts';"] : []),
    '',
    'export const page = {',
    '  viewport(width: number, height: number): Promise<void> {',
    '    return Promise.reject(',
    '      new Error(`page.viewport(${width}, ${height}) 需要真正的浏览器：jsdom 没有布局。改用 Vitest 的浏览器模式或者 Playwright（f09）运行这个测试。`),',
    '    );',
    '  },',
    ...(mode === 'dom'
      ? ['  reload: reloadPage,']
      : ['  reload(): Promise<void> {', "    return Promise.reject(new Error('page.reload() 只能在 DOM 模式的测试中使用'));", '  },']),
    '};',
    '',
  ].join('\n');
}

export function buildLocalProject(input: LocalProjectInput): Record<string, string> {
  const { mode, entry } = input;
  const files: Record<string, string> = { ...input.files };
  const sources = Object.values(files).join('\n');
  const usesRouter = /from\s+['"]react-router/.test(sources);
  // ts 模式在网站上运行在 Web Worker 中（lib 是 WebWorker，没有 DOM），本机用 Node 运行测试
  const browserLike = mode !== 'ts';
  const browserShim = browserLike && /from\s+['"]vitest\/browser['"]/.test(sources);
  const mockFetch = (input.fixtures?.length ?? 0) > 0 && input.mockFetchSource !== undefined;

  if (browserLike && files['index.html'] === undefined) {
    const root = mode === 'react' ? '<div id="root"></div>' : '';
    files['index.html'] = `<!doctype html>\n<html lang="zh-CN">\n  <head>\n    <meta charset="UTF-8" />\n    <title>${escapeHtml(input.title)}</title>\n  </head>\n  <body>\n    ${root}\n    <script type="module" src="./${entry}"></script>\n  </body>\n</html>\n`;
  }

  // package.json
  const dev: Package[] = ['typescript', 'vitest'];
  const deps: Package[] = [];
  if (mode === 'ts') dev.push('tsx');
  else dev.push('vite');
  if (browserLike) dev.push('jsdom', '@testing-library/dom', '@testing-library/user-event', '@testing-library/jest-dom');
  if (mode === 'react') {
    deps.push('react', 'react-dom');
    if (usesRouter) deps.push('react-router');
    dev.push('@testing-library/react', '@types/react', '@types/react-dom', '@vitejs/plugin-react');
  }
  const scripts: Record<string, string> =
    mode === 'ts'
      ? { start: `tsx ${entry}`, test: 'vitest run', 'test:watch': 'vitest', typecheck: 'tsc --noEmit' }
      : { dev: 'vite', build: 'tsc --noEmit && vite build', preview: 'vite preview', test: 'vitest run', 'test:watch': 'vitest', typecheck: 'tsc --noEmit' };
  files['package.json'] = json({
    name: localProjectName(input.lessonId, input.exerciseId),
    private: true,
    version: '0.0.0',
    type: 'module',
    scripts,
    ...(deps.length > 0 ? { dependencies: versions(deps) } : {}),
    devDependencies: versions(dev),
  });

  // tsconfig.json：与网站上的检查使用同样的选项
  const options: Record<string, unknown> = { ...rawCheckOptions(mode, input.overrides), types: browserLike ? ['vite/client'] : [] };
  if (browserShim) options['paths'] = { 'vitest/browser': ['./vitest-browser.ts'] };
  files['tsconfig.json'] = json({ compilerOptions: options, include: ['**/*.ts', '**/*.tsx'], exclude: ['node_modules', 'dist'] });

  // 测试的初始化文件
  const imports: string[] = browserLike ? ["import '@testing-library/jest-dom/vitest';"] : [];
  const body: string[] = [];
  if (mockFetch) {
    files['mock-fetch.ts'] = input.mockFetchSource ?? '';
    files['fixtures.ts'] = [
      '// 网站为这道题模拟的网络请求（setup-tests.ts 把 mock-fetch.ts 安装为测试中的全局 fetch）',
      "import type { FetchFixture } from './mock-fetch.ts';",
      '',
      `export const fixtures: FetchFixture[] = ${JSON.stringify(input.fixtures, null, 2)};`,
      '',
    ].join('\n');
    imports.push("import { createMockFetch } from './mock-fetch.ts';", "import { fixtures } from './fixtures.ts';");
    body.push('// 测试中的 fetch 只返回 fixtures.ts 中的模拟响应，和网站上一样（npm run dev 打开的页面使用真实的网络）', 'globalThis.fetch = createMockFetch(fixtures);', '');
  }
  if (mode === 'dom') {
    // 页面运行的脚本：index.html 中的 <script type="module">；没有时是练习的入口（只有 HTML 的页面不运行脚本）
    const dom = domSetup(scriptEntry(files['index.html'] ?? '') ?? (/\.tsx?$/.test(entry) ? entry : undefined));
    imports.push(...dom.imports);
    body.push(...dom.body);
  } else if (mode === 'react') {
    imports.push(...REACT_SETUP.imports);
    body.push(...REACT_SETUP.body);
  }
  const hasSetup = imports.length > 0 || body.length > 0;
  if (hasSetup) files['setup-tests.ts'] = `${[...imports, '', ...body].join('\n').trimEnd()}\n`;
  if (browserShim) files['vitest-browser.ts'] = vitestBrowserShim(mode);

  // Vite / Vitest 的配置
  const hasRuntimeTests = Object.keys(files).some((p) => /\.(test|spec)\.tsx?$/.test(p));
  files['vite.config.ts'] = [
    "import { defineConfig } from 'vitest/config';",
    ...(mode === 'react' ? ["import react from '@vitejs/plugin-react';"] : []),
    '',
    'export default defineConfig({',
    ...(mode === 'react' ? ['  plugins: [react()],'] : []),
    ...(browserShim ? ["  resolve: { alias: { 'vitest/browser': '/vitest-browser.ts' } },"] : []),
    '  test: {',
    `    environment: '${browserLike ? 'jsdom' : 'node'}',`,
    ...(hasSetup ? ["    setupFiles: ['./setup-tests.ts'],"] : []),
    // 只有类型测试的练习：vitest run 找不到测试文件时不要报错
    ...(hasRuntimeTests ? [] : ['    passWithNoTests: true,']),
    '  },',
    '});',
    '',
  ].join('\n');

  files['.gitignore'] = 'node_modules\ndist\n*.local\n';
  const testSources = Object.entries(files)
    .filter(([p]) => /\.(test|spec)\.tsx?$/.test(p))
    .map(([, content]) => content)
    .join('\n');
  files['README.md'] = readme(input, {
    mockFetch,
    browserShim,
    // 检查布局、样式、绘制结果的测试：jsdom 中没有这些
    needsBrowser: browserLike && /\b(getBoundingClientRect|getComputedStyle|offset(Width|Height|Top|Left)|client(Width|Height)|scroll(Width|Height)|getContext|viewport)\b/.test(testSources),
    hasTypeTests: Object.keys(files).some((p) => /\.test-d\.tsx?$/.test(p)),
    noMain: mode === 'react' && entry !== 'main.tsx',
  });
  return files;
}

function readme(
  input: LocalProjectInput,
  info: { mockFetch: boolean; browserShim: boolean; needsBrowser: boolean; hasTypeTests: boolean; noMain: boolean },
): string {
  const run =
    input.mode === 'ts'
      ? '- `npm start`：运行入口文件（用 tsx 直接运行 TypeScript，输出在终端中）'
      : '- `npm run dev`：启动开发服务器，在浏览器中打开终端显示的地址';
  const notes: string[] = [];
  if (info.hasTypeTests) notes.push('- `*.test-d.ts`、`*.test-d.tsx` 是类型测试，由 `npm run typecheck`（`tsc --noEmit`）检查，`npm test` 不运行它们。');
  if (input.mode === 'dom') {
    notes.push('- `setup-tests.ts` 让每个测试开始前存储清空、页面恢复成 `index.html` 的初始状态，并重新运行入口文件，和网站上的 DOM 模式一样。测试运行在 jsdom 中：它没有布局（元素的尺寸都是 0），不加载 CSS 文件，也没有真正的导航。');
  }
  if (info.noMain) notes.push(`- 这道题没有 \`main.tsx\`，\`npm run dev\` 只运行 \`${input.entry}\`，页面上什么也不显示。想在浏览器中看到组件，写一个 \`main.tsx\` 用 \`createRoot\` 渲染它，并把 \`index.html\` 中的 \`src\` 改成 \`./main.tsx\`。`);
  if (info.mockFetch) {
    notes.push('- 网站为这道题模拟的网络请求在 `fixtures.ts` 中。测试运行前，`setup-tests.ts` 把 `mock-fetch.ts` 安装为全局的 `fetch`，所以测试的结果和网站上一样；`npm run dev` 打开的页面中，`fetch` 访问的是真实的网络（这些地址并不存在）。');
  }
  if (info.needsBrowser) {
    notes.push('- **这道题的测试检查布局或样式**（`getBoundingClientRect`、`getComputedStyle`、视口宽度等）。jsdom 没有布局、不加载 CSS，这些测试在本机的 `npm test` 中会失败，并不说明代码有错：要在本机运行它们，需要 Vitest 的浏览器模式或者 Playwright（f09）。在 `npm run dev` 打开的页面中可以直接检查效果。');
  }
  if (info.browserShim) {
    notes.push('- 测试用到的 `vitest/browser` 被换成了 `vitest-browser.ts`：`page.reload()`（网站的扩展）可以使用；`page.viewport()` 需要真正的浏览器，在 jsdom 中会失败，这样的测试需要改用 Vitest 的浏览器模式或者 Playwright（f09）运行。');
  }
  return [
    `# ${input.title}`,
    '',
    `从 TypeScript 工坊的练习 \`${input.lessonId}\` / \`${input.exerciseId}\` 导出。${input.lessonUrl ? `课程页面：${input.lessonUrl}` : ''}`,
    '',
    '## 运行',
    '',
    input.mode === 'ts'
      ? '需要 Node.js 22.12 或更高的版本（Vitest 5 的要求，见 f01）。在这个文件夹中：'
      : '需要 Node.js 22.22.2、24.15 或更高的版本（jsdom 30 的要求，见 f01）。在这个文件夹中：',
    '',
    '- `npm install`：安装依赖',
    run,
    '- `npm test`：运行测试（Vitest）',
    '- `npm run typecheck`：类型检查，使用与网站相同的编译选项',
    ...(input.mode === 'ts' ? [] : ['- `npm run build`：类型检查并构建到 `dist`']),
    '',
    ...(notes.length > 0 ? ['## 与网站上的区别', '', ...notes, ''] : []),
  ].join('\n');
}
