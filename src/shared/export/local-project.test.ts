import { describe, expect, it } from 'vitest';
import { rawCheckOptions } from '../../compiler/config.ts';
import { buildLocalProject, localProjectName, scriptEntry, withCharset, type LocalProjectInput } from './local-project.ts';

const base: LocalProjectInput = {
  lessonId: 'f06-unit-tests',
  exerciseId: 'test-chunk',
  title: '为 chunk 写测试',
  mode: 'ts',
  entry: 'chunk.ts',
  files: { 'chunk.ts': 'export const chunk = 1;\n', 'chunk.test.ts': "import { test } from 'vitest';\n" },
};

const pkg = (files: Record<string, string>) =>
  JSON.parse(files['package.json'] ?? '') as { name: string; scripts: Record<string, string>; dependencies?: Record<string, string>; devDependencies: Record<string, string> };

describe('localProjectName', () => {
  it('只保留小写字母、数字和 -', () => {
    expect(localProjectName('c12-modules-dts', 'declare_legacy')).toBe('c12-modules-dts-declare-legacy');
    expect(localProjectName('A01', '--x  y--')).toBe('a01-x-y');
  });
});

describe('scriptEntry', () => {
  it('找到 type="module" 的脚本', () => {
    expect(scriptEntry('<script src="old.js"></script><script type="module" src="./main.ts"></script>')).toBe('main.ts');
    expect(scriptEntry("<script src='/src/app.ts' type='module'></script>")).toBe('src/app.ts');
    expect(scriptEntry('<p>没有脚本</p>')).toBeUndefined();
  });
});

describe('buildLocalProject', () => {
  it('ts 模式：tsx 运行入口，Vitest 在 Node 中运行测试，编译选项与网站相同', () => {
    const files = buildLocalProject(base);
    const p = pkg(files);
    expect(p.name).toBe('f06-unit-tests-test-chunk');
    expect(p.scripts).toMatchObject({ start: 'tsx chunk.ts', test: 'vitest run', typecheck: 'tsc --noEmit' });
    expect(Object.keys(p.devDependencies)).toEqual(['tsx', 'typescript', 'vitest']);
    expect(p.dependencies).toBeUndefined();
    const tsconfig = JSON.parse(files['tsconfig.json'] ?? '') as { compilerOptions: Record<string, unknown> };
    expect(tsconfig.compilerOptions).toEqual(rawCheckOptions('ts'));
    expect(files['vite.config.ts']).toContain("environment: 'node'");
    expect(files['setup-tests.ts']).toBeUndefined();
    expect(files['index.html']).toBeUndefined();
    expect(files['chunk.ts']).toBe(base.files['chunk.ts']);
    expect(files['.gitignore']).toContain('node_modules');
  });

  it('课程覆盖的编译选项写进 tsconfig.json', () => {
    const files = buildLocalProject({ ...base, overrides: { exactOptionalPropertyTypes: true } });
    const tsconfig = JSON.parse(files['tsconfig.json'] ?? '') as { compilerOptions: Record<string, unknown> };
    expect(tsconfig.compilerOptions['exactOptionalPropertyTypes']).toBe(true);
  });

  it('dom 模式：jsdom、Testing Library，每个测试前恢复 index.html 并重新运行页面的入口', () => {
    const files = buildLocalProject({
      ...base,
      mode: 'dom',
      entry: 'main.ts',
      files: { 'index.html': '<body><script type="module" src="./src/main.ts"></script></body>', 'src/main.ts': '', 'main.test.ts': '' },
    });
    const p = pkg(files);
    expect(p.scripts).toMatchObject({ dev: 'vite', build: 'tsc --noEmit && vite build' });
    expect(Object.keys(p.devDependencies)).toEqual(
      expect.arrayContaining(['vite', 'jsdom', '@testing-library/dom', '@testing-library/user-event', '@testing-library/jest-dom']),
    );
    const tsconfig = JSON.parse(files['tsconfig.json'] ?? '') as { compilerOptions: { types: string[]; lib: string[] } };
    expect(tsconfig.compilerOptions.types).toEqual(['vite/client']);
    expect(tsconfig.compilerOptions.lib).toEqual(['ES2025', 'DOM']);
    expect(files['vite.config.ts']).toContain("environment: 'jsdom'");
    expect(files['vite.config.ts']).toContain("setupFiles: ['./setup-tests.ts']");
    expect(files['setup-tests.ts']).toContain("await import('./src/main.ts')");
    expect(files['setup-tests.ts']).toContain('localStorage.clear()');
  });

  it('dom 模式没有 index.html 时生成一个，标题转义', () => {
    const files = buildLocalProject({ ...base, mode: 'dom', entry: 'main.ts', title: '<计数器>', files: { 'main.ts': '' } });
    expect(files['index.html']).toContain('<title>&lt;计数器&gt;</title>');
    expect(files['index.html']).toContain('<script type="module" src="./main.ts"></script>');
  });

  it('react 模式：React 依赖，按需加入 React Router；没有 main.tsx 时在 README 中说明', () => {
    const files = buildLocalProject({ ...base, mode: 'react', entry: 'Tabs.tsx', files: { 'Tabs.tsx': '', 'Tabs.test.tsx': '' } });
    const p = pkg(files);
    expect(Object.keys(p.dependencies ?? {})).toEqual(['react', 'react-dom']);
    expect(p.devDependencies).toHaveProperty('@vitejs/plugin-react');
    expect(files['vite.config.ts']).toContain('plugins: [react()]');
    expect(files['index.html']).toContain('<div id="root"></div>');
    expect(files['setup-tests.ts']).toContain('cleanup()');
    expect(files['README.md']).toContain('没有 `main.tsx`');

    const routed = buildLocalProject({ ...base, mode: 'react', entry: 'main.tsx', files: { 'main.tsx': "import { Link } from 'react-router';\n" } });
    expect(Object.keys(pkg(routed).dependencies ?? {})).toEqual(['react', 'react-dom', 'react-router']);
    expect(routed['README.md']).not.toContain('没有 `main.tsx`');
  });

  it('只有类型测试时 vitest run 不因为没有测试文件而失败；README 说明类型测试', () => {
    const files = buildLocalProject({ ...base, files: { 'pick.ts': '', 'pick.test-d.ts': '' } });
    expect(files['vite.config.ts']).toContain('passWithNoTests: true');
    expect(files['README.md']).toContain('`*.test-d.tsx` 是类型测试');
    expect(buildLocalProject(base)['vite.config.ts']).not.toContain('passWithNoTests');
    expect(buildLocalProject(base)['README.md']).not.toContain('与网站上的区别');
  });

  it('页面没有 <meta charset> 时补上（否则本机的 Vite 服务器上中文是乱码）', () => {
    expect(withCharset('<!doctype html>\n<html lang="zh-CN">\n  <head>\n    <title>任务板</title>\n  </head>\n</html>')).toBe(
      '<!doctype html>\n<html lang="zh-CN">\n  <head>\n    <meta charset="UTF-8" />\n    <title>任务板</title>\n  </head>\n</html>',
    );
    expect(withCharset('<html><body>中文</body></html>')).toBe('<html>\n  <head>\n    <meta charset="UTF-8" />\n  </head><body>中文</body></html>');
    expect(withCharset('<p>中文</p>')).toBe('<meta charset="UTF-8" />\n<p>中文</p>');
    const already = '<head><meta charset="utf-8"></head>';
    expect(withCharset(already)).toBe(already);
    const exported = buildLocalProject({ ...base, mode: 'dom', entry: 'main.ts', files: { 'index.html': '<html><head></head><body></body></html>', 'main.ts': '' } });
    expect(exported['index.html']).toContain('<meta charset="UTF-8" />');
    expect(buildLocalProject({ ...base, files: { 'index.html': '<p>x</p>', 'a.ts': '' } })['index.html']).toBe('<p>x</p>');
  });

  it('dom 模式每个测试前恢复地址、<html> 与 <body> 的属性', () => {
    const setup = buildLocalProject({ ...base, mode: 'dom', entry: 'main.ts', files: { 'main.ts': '' } })['setup-tests.ts'] ?? '';
    expect(setup).toContain("history.replaceState(null, '', initialUrl)");
    expect(setup).toContain('copyAttributes(page.documentElement, document.documentElement)');
    expect(setup).toContain('copyAttributes(page.body, document.body)');
  });

  it('测试检查布局或样式时，README 说明需要真正的浏览器', () => {
    const layout = buildLocalProject({ ...base, mode: 'dom', entry: 'main.ts', files: { 'main.ts': '', 'a.test.ts': 'el.getBoundingClientRect();' } });
    expect(layout['README.md']).toContain('这道题的测试检查布局或样式');
    const plain = buildLocalProject({ ...base, mode: 'dom', entry: 'main.ts', files: { 'main.ts': 'el.getBoundingClientRect();', 'a.test.ts': '' } });
    expect(plain['README.md']).not.toContain('这道题的测试检查布局或样式');
  });

  it('只有 HTML 的页面：测试前只恢复页面，不运行脚本', () => {
    const files = buildLocalProject({ ...base, mode: 'dom', entry: 'index.html', files: { 'index.html': '<h1>标题</h1>', 'page.test.ts': '' } });
    expect(files['setup-tests.ts']).toContain('export async function reloadPage()');
    expect(files['setup-tests.ts']).not.toContain('await import(');
  });

  it('有模拟的网络请求时导出 fixtures.ts 与 mock-fetch.ts，测试中安装为全局 fetch', () => {
    const fixtures = [{ url: '/api/books?q=*', body: [{ id: 1 }], delayMs: 300 }];
    const ts = buildLocalProject({ ...base, fixtures, mockFetchSource: '// 源代码\n' });
    expect(ts['mock-fetch.ts']).toBe('// 源代码\n');
    expect(ts['fixtures.ts']).toContain(JSON.stringify(fixtures, null, 2));
    expect(ts['setup-tests.ts']).toContain('globalThis.fetch = createMockFetch(fixtures);');
    expect(ts['vite.config.ts']).toContain("setupFiles: ['./setup-tests.ts']");
    expect(ts['README.md']).toContain('`fixtures.ts`');

    const dom = buildLocalProject({ ...base, mode: 'dom', entry: 'main.ts', fixtures, mockFetchSource: '', files: { 'main.ts': '' } });
    const setup = dom['setup-tests.ts'] ?? '';
    // 所有 import 在前；fetch 在第一次运行入口文件之前安装
    expect(setup.indexOf('globalThis.fetch')).toBeGreaterThan(setup.lastIndexOf('\nimport '));
    expect(setup.indexOf('globalThis.fetch')).toBeLessThan(setup.indexOf('beforeEach('));

    expect(buildLocalProject({ ...base, fixtures })['mock-fetch.ts']).toBeUndefined();
  });

  it('测试用到 vitest/browser 时换成本地的兼容文件（alias 与 paths）', () => {
    const files = buildLocalProject({
      ...base,
      mode: 'dom',
      entry: 'main.ts',
      files: { 'main.ts': '', 'a.test.ts': "import { page } from 'vitest/browser';\n" },
    });
    expect(files['vitest-browser.ts']).toContain('reload: reloadPage');
    expect(files['vite.config.ts']).toContain("alias: { 'vitest/browser': '/vitest-browser.ts' }");
    const tsconfig = JSON.parse(files['tsconfig.json'] ?? '') as { compilerOptions: Record<string, unknown> };
    expect(tsconfig.compilerOptions['paths']).toEqual({ 'vitest/browser': ['./vitest-browser.ts'] });
    expect(files['README.md']).toContain('`vitest-browser.ts`');

    const react = buildLocalProject({ ...base, mode: 'react', entry: 'main.tsx', files: { 'a.test.tsx': "import { page } from 'vitest/browser';\n" } });
    expect(react['vitest-browser.ts']).toContain('page.reload() 只能在 DOM 模式的测试中使用');
  });
});
