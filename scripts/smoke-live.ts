/**
 * 部署之后的冒烟测试：对线上的网站发出几个请求，检查页面、资源、接口和 404。
 * 用法：node scripts/smoke-live.ts https://typescript-workshop-lingtong.vercel.app
 * 有问题时逐条打印，并以退出码 1 结束（.github/workflows/smoke.yml 在每次生产部署之后运行它）。
 */

type Problem = { url: string; problem: string };

const origin = process.argv[2];
if (origin === undefined || !/^https?:\/\//.test(origin)) {
  console.error('用法：node scripts/smoke-live.ts https://网站的地址');
  process.exit(2);
}

/** 页面：单页应用的几种地址，以及沙箱运行时 */
const PAGES = ['/', '/learn/a01-where-ts-runs', '/settings', '/sandbox/'];
/** 应该是 404 的地址：大小写不同、结尾多了斜杠、不存在 */
const NOT_FOUND = ['/does-not-exist', '/Settings', '/settings/'];

const problems: Problem[] = [];
const report = (url: string, problem: string) => problems.push({ url, problem });

async function get(url: string): Promise<Response | null> {
  try {
    return await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(15_000) });
  } catch (error) {
    report(url, `无法连接：${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/** HTML 中引用的脚本和样式表（Vite 生成的 index.html 足够用） */
function assets(pageUrl: string, html: string): { url: string; type: 'javascript' | 'css' }[] {
  const found = new Map<string, 'javascript' | 'css'>();
  for (const [tag] of html.matchAll(/<(?:script|link)\b[^>]*>/gi)) {
    const ref = /\s(?:src|href)\s*=\s*"([^"]+)"/i.exec(tag)?.[1];
    if (ref === undefined) continue;
    const rel = /\srel\s*=\s*"([^"]+)"/i.exec(tag)?.[1]?.toLowerCase().split(/\s+/) ?? [];
    const type = tag.toLowerCase().startsWith('<script') || rel.includes('modulepreload') ? 'javascript' : rel.includes('stylesheet') ? 'css' : null;
    if (type === null) continue;
    const url = new URL(ref, pageUrl);
    if (url.origin === new URL(pageUrl).origin) found.set(url.href, type);
  }
  return [...found].map(([url, type]) => ({ url, type }));
}

const checkedAssets = new Set<string>();

for (const path of PAGES) {
  const url = new URL(path, origin).href;
  const response = await get(url);
  if (response === null) continue;
  const type = response.headers.get('content-type') ?? '（没有类型）';
  if (response.status !== 200) report(url, `状态码 ${response.status}`);
  else if (!type.startsWith('text/html')) report(url, `类型是 ${type}，不是网页`);
  else {
    for (const asset of assets(url, await response.text())) {
      if (checkedAssets.has(asset.url)) continue;
      checkedAssets.add(asset.url);
      const res = await get(asset.url);
      if (res === null) continue;
      const assetType = res.headers.get('content-type') ?? '（没有类型）';
      if (res.status !== 200) report(asset.url, `状态码 ${res.status}`);
      else if (!assetType.includes(asset.type)) report(asset.url, `类型是 ${assetType}，不是 ${asset.type}`);
    }
  }
}

const health = new URL('/api/health', origin).href;
const healthResponse = await get(health);
if (healthResponse !== null) {
  const body: unknown = await healthResponse.json().catch(() => null);
  const ok = typeof body === 'object' && body !== null && 'ok' in body && body.ok === true;
  if (healthResponse.status !== 200 || !ok) report(health, `状态码 ${healthResponse.status}，内容 ${JSON.stringify(body)}`);
}

for (const path of NOT_FOUND) {
  const url = new URL(path, origin).href;
  const response = await get(url);
  if (response !== null && response.status !== 404) report(url, `期望 404，实际是 ${response.status}`);
}

console.log(`检查了 ${PAGES.length} 个页面、${checkedAssets.size} 个资源、1 个接口、${NOT_FOUND.length} 个应该不存在的地址`);
if (problems.length === 0) {
  console.log('没有发现问题');
} else {
  for (const { url, problem } of problems) console.error(`✗ ${url}：${problem}`);
  process.exit(1);
}
