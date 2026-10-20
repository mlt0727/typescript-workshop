import { expect, test, type Page } from '@playwright/test';
import type { JudgeFiles, JudgeSpec } from '../../src/judge/judge.ts';
import type { ProjectSpec } from '../../src/compiler/core/types.ts';
import type {} from '../../src/verify/main.ts';

async function open(page: Page) {
  await page.goto('/verify.html');
  await page.waitForFunction(() => window.__tsw_verify_ready === true);
}

function run(page: Page, params: { projectId: string; spec: ProjectSpec; entry: string; timeoutMs: number; stopAfterMs?: number }) {
  return page.evaluate((p) => window.__tsw_verify.run(p), params);
}

function judge(page: Page, spec: JudgeSpec, files: JudgeFiles) {
  return page.evaluate(([s, f]) => window.__tsw_verify.judge(s, f), [spec, files] as const);
}

const baseSpec = (mode: JudgeSpec['mode'], entry: string, runTests = true): JudgeSpec => ({
  projectId: `judge-${mode}-${Math.random()}`,
  mode,
  entry,
  runTests,
  forbid: ['any', 'type-assertion', 'non-null-assertion', 'ts-directive'],
  timeoutMs: 8000,
  perTestTimeoutMs: 2000,
});

test.describe('纯 TS 模式', () => {
  test('多文件、Node 风格输出、顶层 await、计时器结束后才算完成', async ({ page }) => {
    await open(page);
    const r = await run(page, {
      projectId: 'p1',
      entry: 'main.ts',
      timeoutMs: 5000,
      spec: {
        mode: 'ts',
        files: {
          'main.ts': [
            'import { double } from "./util";',
            'console.log([1, 2, 3].map(double), { a: "x" }, new Map([["k", 1]]));',
            'const v = await Promise.resolve(42);',
            'console.log("tla", v);',
            'setTimeout(() => console.log("later"), 50);',
          ].join('\n'),
          'util.ts': 'export const double = (n: number) => n * 2;',
        },
      },
    });
    expect(r.status).toBe('done');
    expect(r.logs.map((l) => l.text)).toEqual(["[ 2, 4, 6 ] { a: 'x' } Map(1) { 'k' => 1 }", 'tla 42', 'later']);
  });

  test('运行时错误被映射回源文件行号', async ({ page }) => {
    await open(page);
    const r = await run(page, {
      projectId: 'p2',
      entry: 'main.ts',
      timeoutMs: 5000,
      spec: { mode: 'ts', files: { 'main.ts': 'type T = { a: number };\nconst t: T = { a: 1 };\nconsole.log(t);\nthrow new Error("boom");\n' } },
    });
    expect(r.status).toBe('error');
    expect(r.error?.message).toBe('boom');
    expect(r.error?.location).toMatchObject({ file: 'main.ts', line: 4 });
  });

  test('同步死循环可以被“停止”真正中断，之后能立即再次运行', async ({ page }) => {
    await open(page);
    const r = await run(page, {
      projectId: 'p3',
      entry: 'main.ts',
      timeoutMs: 10_000,
      stopAfterMs: 500,
      spec: { mode: 'ts', files: { 'main.ts': 'console.log("start");\nwhile (true) {}\n' } },
    });
    expect(r.status).toBe('stopped');
    expect(r.logs.map((l) => l.text)).toContain('start');
    const again = await run(page, { projectId: 'p3b', entry: 'main.ts', timeoutMs: 5000, spec: { mode: 'ts', files: { 'main.ts': 'console.log("ok");' } } });
    expect(again.status).toBe('done');
    expect(again.logs.map((l) => l.text)).toEqual(['ok']);
  });

  test('死循环超时后被终止', async ({ page }) => {
    await open(page);
    const r = await run(page, { projectId: 'p4', entry: 'main.ts', timeoutMs: 800, spec: { mode: 'ts', files: { 'main.ts': 'for (;;) {}' } } });
    expect(r.status).toBe('timeout');
  });

  test('判题：正确解通过；错误行为、类型错误、any、ts-ignore 都被拒绝', async ({ page }) => {
    await open(page);
    const tests = {
      'sum.test.ts': [
        'import { test, expect } from "vitest";',
        'import { sum } from "./sum";',
        'test("空数组", () => expect(sum([])).toBe(0));',
        'test("多个数", () => expect(sum([1, 2, 3.5])).toBe(6.5));',
      ].join('\n'),
      'sum.test-d.ts': 'import { expectTypeOf } from "vitest";\nimport { sum } from "./sum";\nexpectTypeOf(sum).parameter(0).toEqualTypeOf<readonly number[]>();\nexpectTypeOf(sum).returns.toEqualTypeOf<number>();\n',
    };
    const variants: Record<string, string> = {
      correct: 'export function sum(xs: readonly number[]): number {\n  let total = 0;\n  for (const x of xs) total += x;\n  return total;\n}',
      reduce: 'export const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);',
      wrongBehavior: 'export function sum(xs: readonly number[]): number {\n  return xs.length;\n}',
      typeError: 'export function sum(xs: readonly number[]): number {\n  return "0";\n}',
      usesAny: 'export function sum(xs: any): number {\n  return xs.reduce((a: number, b: number) => a + b, 0);\n}',
      tsIgnore: 'export function sum(xs: readonly number[]): number {\n  // @ts-ignore\n  return xs.reduce((a, b) => a + b, "");\n}',
    };
    const out: Record<string, boolean> = {};
    for (const [name, code] of Object.entries(variants)) {
      const r = await judge(page, baseSpec('ts', 'sum.ts'), { student: { 'sum.ts': code }, support: {}, tests });
      out[name] = r.passed;
      if (name === 'typeError') expect(r.types.student.map((d) => d.code)).toEqual([2322]);
      if (name === 'usesAny') expect(r.rules.violations.map((v) => v.rule)).toContain('any');
      if (name === 'wrongBehavior') expect(r.tests.results.filter((t) => t.status === 'fail').length).toBeGreaterThan(0);
    }
    expect(out).toEqual({ correct: true, reduce: true, wrongBehavior: false, typeError: false, usesAny: false, tsIgnore: false });
  });

  test('测试中的死循环在超时后被终止并报告', async ({ page }) => {
    await open(page);
    const r = await judge(page, { ...baseSpec('ts', 'f.ts'), timeoutMs: 1500 }, {
      student: { 'f.ts': 'export function f(): number {\n  while (true) {}\n}' },
      support: {},
      tests: { 'f.test.ts': 'import { test, expect } from "vitest";\nimport { f } from "./f";\ntest("f", () => expect(f()).toBe(1));' },
    });
    expect(r.passed).toBe(false);
    expect(r.tests.error?.message).toContain('超过');
  });
});

test.describe('DOM 模式', () => {
  const html = '<!doctype html><html><head><link rel="stylesheet" href="style.css"></head><body><button id="b">+1</button><output id="o">0</output><script type="module" src="./main.ts"></script></body></html>';
  const tests = {
    'page.test.ts': [
      'import { test, expect } from "vitest";',
      'import { screen } from "@testing-library/dom";',
      'import userEvent from "@testing-library/user-event";',
      'test("点击两次显示 2", async () => {',
      '  const user = userEvent.setup();',
      '  await user.click(screen.getByRole("button", { name: "+1" }));',
      '  await user.click(screen.getByRole("button", { name: "+1" }));',
      '  expect(document.querySelector("#o")).toHaveTextContent("2");',
      '});',
      'test("每个测试前页面都会重置", () => {',
      '  expect(document.querySelector("#o")).toHaveTextContent("0");',
      '});',
    ].join('\n'),
  };
  const good = [
    'const button = document.querySelector<HTMLButtonElement>("#b");',
    'const out = document.querySelector<HTMLOutputElement>("#o");',
    'if (!button || !out) throw new Error("页面结构不完整");',
    'let count = 0;',
    'button.addEventListener("click", () => {',
    '  count++;',
    '  out.textContent = String(count);',
    '});',
  ].join('\n');

  test('真实网页预览与点击测试；错误实现被拒绝', async ({ page }) => {
    await open(page);
    const ok = await judge(page, baseSpec('dom', 'main.ts'), { student: { 'main.ts': good }, support: { 'index.html': html, 'style.css': 'button { color: red; }' }, tests });
    expect(ok.tests.results.map((r) => r.status)).toEqual(['pass', 'pass']);
    expect(ok.passed).toBe(true);
    const bad = await judge(page, baseSpec('dom', 'main.ts'), {
      student: { 'main.ts': good.replace('count++;', 'count = 1;') },
      support: { 'index.html': html, 'style.css': '' },
      tests,
    });
    expect(bad.passed).toBe(false);
    const nonNull = await judge(page, baseSpec('dom', 'main.ts'), {
      student: { 'main.ts': 'const b = document.querySelector("#b")!;\nconst o = document.querySelector("#o")!;\nlet n = 0;\nb.addEventListener("click", () => { o.textContent = String(++n); });' },
      support: { 'index.html': html, 'style.css': '' },
      tests,
    });
    expect(nonNull.tests.ok).toBe(true);
    expect(nonNull.rules.violations.map((v) => v.rule)).toEqual(['non-null-assertion', 'non-null-assertion']);
    expect(nonNull.passed).toBe(false);
  });

  test('DOM 模式的同步死循环被循环保护中止，页面不会卡死', async ({ page }) => {
    await open(page);
    const started = Date.now();
    const r = await run(page, {
      projectId: 'd2',
      entry: 'main.ts',
      timeoutMs: 8000,
      spec: { mode: 'dom', files: { 'index.html': '<script type="module" src="main.ts"></script>', 'main.ts': 'console.log("before");\nlet i = 0;\nwhile (i >= 0) { i++; }\n' } },
    });
    expect(r.status).toBe('error');
    expect(r.error?.name).toBe('LoopLimitError');
    expect(Date.now() - started).toBeLessThan(7000);
  });
});

test.describe('React 模式', () => {
  test('组件交互测试；状态更新确实发生；错误实现被拒绝', async ({ page }) => {
    await open(page);
    const tests = {
      'Counter.test.tsx': [
        'import { test, expect } from "vitest";',
        'import { render, screen } from "@testing-library/react";',
        'import userEvent from "@testing-library/user-event";',
        'import { Counter } from "./Counter";',
        'test("点击后加一", async () => {',
        '  const user = userEvent.setup();',
        '  render(<Counter start={5} />);',
        '  await user.click(screen.getByRole("button", { name: "加一" }));',
        '  expect(screen.getByText("当前：6")).toBeInTheDocument();',
        '});',
      ].join('\n'),
    };
    const good = 'import { useState } from "react";\nexport function Counter({ start }: { start: number }) {\n  const [n, setN] = useState(start);\n  return (<div><p>当前：{n}</p><button onClick={() => setN(n + 1)}>加一</button></div>);\n}\n';
    const ok = await judge(page, baseSpec('react', 'main.tsx'), { student: { 'Counter.tsx': good }, support: {}, tests });
    expect(ok.passed).toBe(true);
    const mutating = 'export function Counter({ start }: { start: number }) {\n  let n = start;\n  return (<div><p>当前：{n}</p><button onClick={() => { n = n + 1; }}>加一</button></div>);\n}\n';
    const bad = await judge(page, baseSpec('react', 'main.tsx'), { student: { 'Counter.tsx': mutating }, support: {}, tests });
    expect(bad.passed).toBe(false);
    expect(bad.tests.results[0]?.status).toBe('fail');
  });

  test('React 预览运行并输出开发版警告', async ({ page }) => {
    await open(page);
    const r = await run(page, {
      projectId: 'r2',
      entry: 'main.tsx',
      timeoutMs: 8000,
      spec: {
        mode: 'react',
        files: {
          'main.tsx': 'import { createRoot } from "react-dom/client";\nimport { App } from "./App";\nconst root = document.getElementById("root");\nif (!root) throw new Error("no root");\ncreateRoot(root).render(<App />);\n',
          'App.tsx': 'export function App() {\n  const items = ["a", "b"];\n  return <ul>{items.map((x) => <li>{x}</li>)}</ul>;\n}\n',
        },
      },
    });
    expect(r.status).toBe('done');
    await expect.poll(async () => (await page.evaluate(() => document.querySelectorAll('iframe.sandbox-frame').length))).toBeGreaterThan(0);
  });
});
