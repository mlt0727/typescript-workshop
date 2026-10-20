import { expect, test, type Page } from '@playwright/test';
import type {} from '../../src/verify/main.ts';
import { block, D07, setEditor, submit } from './helpers.ts';

async function openVerify(page: Page) {
  await page.goto('/verify.html');
  await page.waitForFunction(() => window.__tsw_verify_ready === true);
}

const PROBE = `
const results: Record<string, string> = {};
function probe(name: string, fn: () => unknown) {
  try {
    results[name] = 'OK:' + String(fn());
  } catch (e) {
    results[name] = 'BLOCKED:' + (e instanceof Error ? e.name : String(e));
  }
}
probe('parentDocument', () => window.parent.document.title);
probe('topDocument', () => window.top?.document.title);
// 平台把 window.localStorage 换成了内存模拟；嵌套 iframe 继承沙箱的不透明来源，读取真实存储会被拒绝
probe('realLocalStorage', () => {
  const f = document.createElement('iframe');
  document.body.append(f);
  return f.contentWindow?.localStorage.length;
});
probe('indexedDB', () => indexedDB.open('x'));
probe('cookie', () => document.cookie);
probe('origin', () => { if (window.origin === 'null') throw new Error('opaque'); return window.origin; });
localStorage.setItem('tsw-sandbox-probe', 'written-in-sandbox');
let fetchResult = 'pending';
try {
  await window.fetch('http://localhost/api/health');
  fetchResult = 'OK';
} catch (e) {
  fetchResult = 'BLOCKED';
}
let importResult = 'pending';
try {
  await import(/* @vite-ignore */ 'https://esm.sh/react');
  importResult = 'OK';
} catch {
  importResult = 'BLOCKED';
}
console.log(JSON.stringify({ ...results, fetchResult, importResult }));
`;

test('沙箱中的代码不能访问主页面的 DOM、存储、cookie、网络与远程脚本', async ({ page }) => {
  await openVerify(page);
  await page.evaluate(() => localStorage.setItem('main-app-secret', 'secret-value'));
  const r = await page.evaluate(
    (code) =>
      window.__tsw_verify.run({
        projectId: 'sec1',
        entry: 'main.ts',
        timeoutMs: 8000,
        spec: { mode: 'dom', files: { 'index.html': '<script type="module" src="./main.ts"></script>', 'main.ts': code } },
      }),
    PROBE,
  );
  const line = r.logs.find((l) => l.text.startsWith('{'));
  expect(line, JSON.stringify(r.logs)).toBeTruthy();
  const results = JSON.parse(line!.text) as Record<string, string>;
  expect(results.parentDocument).toMatch(/^BLOCKED/);
  expect(results.topDocument).toMatch(/^BLOCKED/);
  expect(results.realLocalStorage).toMatch(/^BLOCKED/);
  expect(results.indexedDB).toMatch(/^BLOCKED/);
  expect(results.cookie).toMatch(/^BLOCKED/);
  expect(results.origin).toMatch(/^BLOCKED/);
  expect(results.fetchResult).toBe('BLOCKED');
  expect(results.importResult).toBe('BLOCKED');
  // 沙箱里的 localStorage 是内存模拟，写入不会影响主应用
  expect(await page.evaluate(() => localStorage.getItem('tsw-sandbox-probe'))).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem('main-app-secret'))).toBe('secret-value');
  expect(r.simulated).toContain('localStorage');
});

test('纯 TS 模式（Worker）同样无法访问存储与网络', async ({ page }) => {
  await openVerify(page);
  const r = await page.evaluate(() =>
    window.__tsw_verify.run({
      projectId: 'sec2',
      entry: 'main.ts',
      timeoutMs: 8000,
      spec: {
        mode: 'ts',
        files: {
          'main.ts': [
            'let idb = "";',
            'try { indexedDB.open("x"); idb = "OK"; } catch (e) { idb = "BLOCKED"; }',
            'let net = "";',
            'try { await fetch("http://localhost/api/health"); net = "OK"; } catch { net = "BLOCKED"; }',
            'console.log(idb, net, self.origin);',
          ].join('\n'),
        },
      },
    }),
  );
  expect(r.logs.map((l) => l.text)).toContain('BLOCKED BLOCKED null');
});

test('伪造的消息不会让错误答案通过', async ({ page }) => {
  await page.goto(D07);
  const ex = block(page, 'char-counter');
  await ex.scrollIntoViewIfNeeded();
  // 学生代码试图向主页面伪造“测试通过”的消息
  await setEditor(
    ex,
    [
      "const fake = { type: 'tests', runId: 'x', results: [{ name: 'fake', status: 'pass', durationMs: 0 }] };",
      "window.parent.postMessage(fake, '*');",
      "window.top?.postMessage(fake, '*');",
      'export {};',
    ].join('\n'),
  );
  // 主页面自身也收到伪造消息（例如来自其他窗口）
  await page.evaluate(() => {
    const timer = setInterval(() => window.postMessage({ type: 'tests', runId: 'x', results: [{ name: 'fake', status: 'pass', durationMs: 0 }] }, '*'), 20);
    setTimeout(() => clearInterval(timer), 5000);
  });
  await submit(ex);
  await expect(ex.locator('.result-head')).toContainText('还没有通过');
  await expect(ex.locator('.test-list')).not.toContainText('fake');
});

test('预览 iframe 使用不透明来源的 sandbox，且没有 allow-same-origin', async ({ page }) => {
  await page.goto(D07);
  const pg = block(page, 'first-listener');
  await pg.scrollIntoViewIfNeeded();
  await pg.getByRole('button', { name: '运行' }).click();
  const sandbox = await pg.locator('iframe.sandbox-frame').getAttribute('sandbox');
  expect(sandbox?.split(/\s+/).sort()).toEqual(['allow-forms', 'allow-scripts']);
});
