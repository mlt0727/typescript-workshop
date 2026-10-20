import path from 'node:path';
import { describe, expect, test } from 'vitest';
import { ProjectService } from './project.ts';
import { nodeTypeGroupLoader } from './node-loader.ts';

const root = path.resolve(import.meta.dirname, '../../..');
const service = new ProjectService(nodeTypeGroupLoader(root));

describe('诊断', () => {
  test('类型错误会被报告，并带有 1 起始的行列号', async () => {
    const p = await service.open('t1', {
      mode: 'ts',
      files: { 'main.ts': 'const n: number = "x";\nconsole.log(n);\n' },
    });
    const d = p.diagnostics();
    expect(d).toHaveLength(1);
    expect(d[0]).toMatchObject({ code: 2322, file: 'main.ts', line: 1, column: 7, category: 'error' });
  });

  test('纯 TS 模式没有 document（与 Worker 运行环境一致）', async () => {
    const p = await service.open('t2', { mode: 'ts', files: { 'main.ts': 'document.title = "x";' } });
    expect(p.diagnostics().map((d) => d.code)).toEqual([2584]);
  });

  test('DOM 模式有 document；ES2025 的 Set 方法可用', async () => {
    const p = await service.open('t3', {
      mode: 'dom',
      files: { 'main.ts': 'document.title = "x";\nconst u = new Set([1]).union(new Set([2]));\nconsole.log(u);' },
    });
    expect(p.diagnostics()).toEqual([]);
  });

  test('多文件 import 与 verbatimModuleSyntax', async () => {
    const p = await service.open('t4', {
      mode: 'ts',
      files: {
        'main.ts': 'import { add, type Pair } from "./math";\nconst p: Pair = [1, 2];\nconsole.log(add(...p));',
        'math.ts': 'export type Pair = [number, number];\nexport function add(a: number, b: number) { return a + b; }',
      },
    });
    expect(p.diagnostics()).toEqual([]);
  });

  test('noUncheckedIndexedAccess 默认开启', async () => {
    const p = await service.open('t5', {
      mode: 'ts',
      files: { 'main.ts': 'const xs = [1, 2];\nconst n: number = xs[0];' },
    });
    expect(p.diagnostics().map((d) => d.code)).toEqual([2322]);
  });

  test('React 模式：TSX、props 类型与 Testing Library 类型', async () => {
    const p = await service.open('t6', {
      mode: 'react',
      withTests: true,
      files: {
        'App.tsx': 'import { useState } from "react";\nexport function App({ start }: { start: number }) {\n  const [n, setN] = useState(start);\n  return <button onClick={() => setN(n + 1)}>{n}</button>;\n}\n',
        'App.test.tsx':
          'import { render, screen } from "@testing-library/react";\nimport userEvent from "@testing-library/user-event";\nimport { test, expect } from "vitest";\nimport { App } from "./App";\ntest("x", async () => {\n  render(<App start={1} />);\n  await userEvent.click(screen.getByRole("button"));\n  expect(screen.getByRole("button")).toHaveTextContent("2");\n});\n',
        'bad.tsx': 'import { App } from "./App";\nexport const el = <App start="1" />;\n',
      },
    });
    const d = p.diagnostics();
    expect(d.map((x) => `${x.file}:${x.code}`)).toEqual(['bad.tsx:2322']);
  });

  test('expectTypeOf 类型测试：错误的返回类型会在测试文件中报错', async () => {
    const files = {
      'main.ts': 'export function parse(s: string) { return Number(s); }',
      'main.test-d.ts':
        'import { expectTypeOf } from "vitest";\nimport { parse } from "./main";\nexpectTypeOf(parse).returns.toEqualTypeOf<number>();\n',
    };
    const ok = await service.open('t7', { mode: 'ts', withTests: true, files });
    expect(ok.diagnostics()).toEqual([]);
    const bad = await service.open('t7', {
      mode: 'ts',
      withTests: true,
      files: { ...files, 'main.ts': 'export function parse(s: string): any { return Number(s); }' },
    });
    expect(bad.diagnostics().filter((d) => d.file === 'main.test-d.ts').length).toBeGreaterThan(0);
  });

  test('erasableSyntaxOnly：enum 被报告', async () => {
    const p = await service.open('t8', { mode: 'ts', files: { 'main.ts': 'enum Color { Red }\nconsole.log(Color.Red);' } });
    expect(p.diagnostics().map((d) => d.code)).toEqual([1294]);
  });
});

describe('规则（AST，而非关键词搜索）', () => {
  test('报告 any / 断言 / 非空断言 / ts 指令，但忽略字符串与注释中的单词', async () => {
    const src = [
      'const s = "any as x!"; // any',
      'let a: any = 1;',
      'const b = a as number;',
      'const c = [1] as const;',
      'const d = document.querySelector("p")!;',
      '// @ts-ignore',
      'const e: number = "x";',
      'const f = { n: 1 } satisfies { n: number };',
      'console.log(s, b, c, d, e, f);',
    ].join('\n');
    const p = await service.open('r1', { mode: 'dom', files: { 'main.ts': src } });
    const v = p.rules(['main.ts'], ['any', 'type-assertion', 'non-null-assertion', 'ts-directive']);
    expect(v.map((x) => `${x.rule}@${x.line}`)).toEqual([
      'any@2',
      'type-assertion@3',
      'non-null-assertion@5',
      'ts-directive@6',
    ]);
  });

  test('报告 var 声明（含 for 循环头），不报告 let / const / declare var', async () => {
    const src = [
      'var a = 1;',
      'let b = 2;',
      'const c = 3;',
      'for (var i = 0; i < 1; i++) {}',
      'for (const k of [1]) { console.log(k); }',
      'declare var injected: number;',
      'declare global { var flag: boolean; }',
      'const note = "var x = 1";',
      'console.log(a, b, c, i, note);',
    ].join('\n');
    const p = await service.open('r-var', { mode: 'ts', files: { 'main.ts': src } });
    const v = p.rules(['main.ts'], ['var']);
    expect(v.map((x) => `${x.rule}@${x.line}`)).toEqual(['var@1', 'var@4']);
  });

  test('带类型参数的 querySelector / querySelectorAll / closest 视为断言', async () => {
    const src = [
      'const a = document.querySelector<HTMLButtonElement>("#a");',
      'const b = document.querySelectorAll<HTMLInputElement>("input");',
      'const c = document.body.closest<HTMLElement>("main");',
      'const d = document.querySelector("#d");',
      'const e = new Map<string, number>();',
      'console.log(a, b, c, d, e);',
    ].join('\n');
    const p = await service.open('r2', { mode: 'dom', files: { 'main.ts': src } });
    expect(p.rules(['main.ts'], ['type-assertion']).map((x) => `${x.rule}@${x.line}`)).toEqual([
      'type-assertion@1',
      'type-assertion@2',
      'type-assertion@3',
    ]);
  });
});

describe('运行包', () => {
  test('改写模块说明符、收集依赖与缺失模块', async () => {
    const p = await service.open('b1', {
      mode: 'react',
      files: {
        'main.tsx': 'import { createRoot } from "react-dom/client";\nimport { App } from "./App";\nimport "./style.css";\nimport _ from "lodash";\ncreateRoot(document.body).render(<App />);\nconsole.log(_);',
        'App.tsx': 'export function App() { return <p>hi</p>; }',
        'style.css': 'p { color: red; }',
      },
    });
    const b = p.buildRun({ entries: ['main.tsx'], nonce: 'n1', loopGuard: false });
    expect(b.modules.map((m) => m.id).sort()).toEqual(['css:style.css', 'file:App.tsx', 'file:main.tsx']);
    expect(b.externalDeps.sort()).toEqual(['react-dom/client', 'react/jsx-runtime']);
    expect(b.missing).toEqual([{ from: 'main.tsx', specifier: 'lodash' }]);
    const main = b.modules.find((m) => m.id === 'file:main.tsx')!;
    expect(main.code).toContain('"tsw-n1:file:App.tsx"');
    expect(main.code).toContain('"tsw-n1:dep:react-dom/client"');
    expect(main.deps.sort()).toEqual(['css:style.css', 'file:App.tsx']);
    expect(main.map).toBeTruthy();
  });

  test('类型导入被擦除；循环体插入保护调用', async () => {
    const p = await service.open('b2', {
      mode: 'dom',
      files: {
        'main.ts': 'import type { T } from "./t";\nconst x: T = 1;\nwhile (true) break;\nfor (const y of [x]) console.log(y);\nouter: for (let i = 0; i < 2; i++) { continue outer; }',
        't.ts': 'export type T = number;',
      },
    });
    const b = p.buildRun({ entries: ['main.ts'], nonce: 'n2', loopGuard: true });
    expect(b.modules.map((m) => m.id)).toEqual(['file:main.ts']);
    const code = b.modules[0]!.code;
    expect(code).not.toContain('./t');
    expect(code.match(/__tsw_loop_guard__\(\)/g)).toHaveLength(3);
    expect(code).toContain('outer: for');
  });
});
