import { test } from '@playwright/test';
import type {} from '../../src/verify/main.ts';

test('probe roles', async ({ page }) => {
  await page.goto('/verify.html');
  await page.waitForFunction(() => window.__tsw_verify_ready === true);
  const html = `<!doctype html><html lang="zh-CN"><head><title>t</title></head><body>
<header><h1>站点</h1><nav><ul><li><a href="#a">A</a></li></ul></nav></header>
<main><article><header><h2>文章</h2></header><p>x</p><footer>文章脚注</footer></article>
<section><h2>无名区块</h2></section>
<section aria-labelledby="s2"><h2 id="s2">有名区块</h2><ol><li>一</li></ol></section>
<aside>侧栏</aside>
<img src="data:," alt="番茄炒蛋"><img src="data:," alt=""><img src="data:,">
<div class="btn">假按钮</div><button type="button">真按钮</button>
<time datetime="PT15M">15 分钟</time><strong>重</strong><em>强调</em>
</main><footer>页脚</footer>
<script type="module" src="./main.ts"></script></body></html>`;
  const main = `import { getRoles } from '@testing-library/dom';
const roles = getRoles(document.body);
for (const [role, els] of Object.entries(roles)) console.log(role, els.map((e) => e.tagName.toLowerCase()).join(','));`;
  const r = await page.evaluate((p) => window.__tsw_verify.run(p), { projectId: 'probe', entry: 'main.ts', timeoutMs: 5000, spec: { mode: 'dom' as const, files: { 'index.html': html, 'main.ts': main } } });
  console.log(r.status, r.error);
  for (const l of r.logs) console.log(l.level, l.text);
});
