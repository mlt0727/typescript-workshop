import type { z } from 'zod';
import type { runBundleSchema } from '../../src/shared/sandbox-protocol.ts';
import { SourceMapLookup, type ModuleLocationInfo } from './sourcemap.ts';

type RunBundle = z.infer<typeof runBundleSchema>;

export class LinkError extends Error {
  override name = 'LinkError';
}

const IDENT_RE = /^[A-Za-z_$][\w$]*$/;
const RESERVED = new Set([
  'default', 'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'delete', 'do', 'else',
  'export', 'extends', 'finally', 'for', 'function', 'if', 'import', 'in', 'instanceof', 'new', 'return',
  'super', 'switch', 'this', 'throw', 'try', 'typeof', 'var', 'void', 'while', 'with', 'yield', 'let',
  'static', 'enum', 'await', 'implements', 'package', 'protected', 'interface', 'private', 'public',
]);

/** 沙箱提供的依赖：名称 → 模块命名空间对象。由运行时在加载时注册。 */
export function getDeps(): Record<string, object> {
  const g = globalThis as { __tsw_deps__?: Record<string, object> };
  g.__tsw_deps__ ??= {};
  return g.__tsw_deps__;
}

function blobUrl(code: string): string {
  return URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
}

export interface LinkedGraph {
  urls: Map<string, string>;
  urlToModule: Map<string, ModuleLocationInfo>;
  revoke(): void;
}

export interface LinkOptions {
  /** 只链接从这些入口可达的模块 */
  entries: string[];
  /** CSS 模块如何处理（Worker 中不支持） */
  css: 'inject' | 'unsupported';
  /** 已经存在的依赖 shim（跨多次链接复用） */
  depUrlCache?: Map<string, string>;
}

/** CommonJS 包（如 react/jsx-runtime）打包后，命名导出可能只挂在 default 上：合并两者。 */
function exportSource(ns: object): Record<string, unknown> {
  const d = (ns as { default?: unknown }).default;
  if (d !== null && (typeof d === 'object' || typeof d === 'function')) return { ...(d as object), ...ns };
  return ns as Record<string, unknown>;
}

function depShim(name: string): string {
  const ns = getDeps()[name];
  if (!ns) {
    return `throw new Error(${JSON.stringify(`平台未提供模块 "${name}"（当前运行模式下不可用）`)});`;
  }
  const names = Object.keys(exportSource(ns)).filter((k) => IDENT_RE.test(k) && !RESERVED.has(k));
  const lines = [
    `const __ns = globalThis.__tsw_deps__[${JSON.stringify(name)}];`,
    `const __d = __ns.default;`,
    `const __m = __d !== null && (typeof __d === "object" || typeof __d === "function") ? { ...__d, ...__ns } : __ns;`,
  ];
  lines.push(`export default ("default" in __ns ? __ns.default : __ns);`);
  if (names.length) lines.push(`export const { ${names.join(', ')} } = __m;`);
  return lines.join('\n');
}

function cssModule(path: string, css: string): string {
  return [
    `const style = document.createElement('style');`,
    `style.dataset.tswCss = ${JSON.stringify(path)};`,
    `style.textContent = ${JSON.stringify(css)};`,
    `document.head.append(style);`,
    `export {};`,
  ].join('\n');
}

/**
 * 把运行包中的模块链接成 blob URL：按依赖的后序创建（叶子先创建），
 * 把占位符 "tsw-<nonce>:<kind>:<target>" 替换为对应的 blob URL。
 */
export function linkBundle(bundle: RunBundle, options: LinkOptions): LinkedGraph {
  const byId = new Map(bundle.modules.map((m) => [m.id, m]));
  const urls = new Map<string, string>();
  const created: string[] = [];
  const urlToModule = new Map<string, ModuleLocationInfo>();
  const depUrls = options.depUrlCache ?? new Map<string, string>();
  const missingUrls = new Map<string, string>();
  const state = new Map<string, 'visiting' | 'done'>();
  const placeholderRe = new RegExp(`"tsw-${bundle.nonce}:(file|css|dep|missing):([^"]*)"`, 'g');

  const urlForDep = (name: string) => {
    let url = depUrls.get(name);
    if (!url) {
      url = blobUrl(depShim(name));
      depUrls.set(name, url);
    }
    return url;
  };
  const urlForMissing = (spec: string) => {
    let url = missingUrls.get(spec);
    if (!url) {
      const msg = spec.startsWith('.')
        ? `找不到模块 "${spec}"：请检查文件名与路径。`
        : `找不到模块 "${spec}"：平台只提供课程需要的依赖，不支持安装任意 npm 包。`;
      url = blobUrl(`throw new Error(${JSON.stringify(msg)});`);
      missingUrls.set(spec, url);
      created.push(url);
    }
    return url;
  };

  const visit = (id: string, chain: string[]) => {
    const st = state.get(id);
    if (st === 'done') return;
    const mod = byId.get(id);
    if (!mod) throw new LinkError(`运行包缺少模块 ${id}`);
    if (st === 'visiting') {
      const cycle = [...chain.slice(chain.indexOf(id)), id].map((x) => x.replace(/^\w+:/, ''));
      throw new LinkError(`暂不支持循环导入：${cycle.join(' → ')}`);
    }
    state.set(id, 'visiting');
    for (const dep of mod.deps) visit(dep, [...chain, id]);

    let url: string;
    if (mod.kind === 'css') {
      url =
        options.css === 'inject'
          ? blobUrl(cssModule(mod.path, mod.code))
          : blobUrl(`throw new Error(${JSON.stringify(`纯 TypeScript 模式不能导入 CSS 文件（${mod.path}）`)});`);
    } else {
      const code = mod.code.replace(placeholderRe, (_m, kind: string, target: string) => {
        switch (kind) {
          case 'file':
            return JSON.stringify(urls.get(`file:${target}`) ?? urlForMissing(target));
          case 'css':
            return JSON.stringify(urls.get(`css:${target}`) ?? urlForMissing(target));
          case 'dep':
            return JSON.stringify(urlForDep(target));
          default:
            return JSON.stringify(urlForMissing(target));
        }
      });
      url = blobUrl(code);
      urlToModule.set(url, { path: mod.path, map: mod.map ? new SourceMapLookup(mod.map) : undefined });
    }
    urls.set(id, url);
    created.push(url);
    state.set(id, 'done');
  };

  for (const entry of options.entries) visit(entry, []);

  return {
    urls,
    urlToModule,
    revoke() {
      for (const u of created) URL.revokeObjectURL(u);
    },
  };
}
