/**
 * 把浏览器内编译器需要的 .d.ts 打包成 JSON（自托管，不依赖 CDN）：
 *   public/tsw-types/<TS_VERSION>/<group>.json  →  { files: { "/虚拟路径": "内容" } }
 *
 * - core：lib.es2025 链 + lib.dom + lib.webworker
 * - test：平台测试 API（Vitest 兼容子集）+ expect-type
 * - dom-testing：@testing-library/dom、@testing-library/user-event
 * - react：@types/react、@types/react-dom、@testing-library/react、react-router
 *
 * 依赖闭包通过 TypeScript 自己的模块解析计算，因此浏览器内的解析结果与这里一致。
 */
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { TS_VERSION, type TypeGroup } from '../src/compiler/config.ts';

const root = path.resolve(import.meta.dirname, '..');
const tsLibDir = path.dirname(ts.getDefaultLibFilePath({}));
const outDir = path.join(root, 'public', 'tsw-types', TS_VERSION);

if (ts.version !== TS_VERSION) {
  throw new Error(`已安装 TypeScript ${ts.version}，但配置要求 ${TS_VERSION}`);
}

const resolveOptions: ts.CompilerOptions = {
  target: ts.ScriptTarget.ES2025,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  jsx: ts.JsxEmit.ReactJSX,
};

function toVirtual(realPath: string): string {
  const normalized = realPath.replaceAll('\\', '/');
  const idx = normalized.lastIndexOf('/node_modules/');
  if (idx === -1) throw new Error(`不在 node_modules 中：${realPath}`);
  return normalized.slice(idx);
}

function collectLibs(names: string[]): Map<string, string> {
  const out = new Map<string, string>();
  const queue = [...names];
  while (queue.length > 0) {
    const name = queue.shift()!.toLowerCase();
    const fileName = `lib.${name}.d.ts`;
    const virtual = `/lib/${fileName}`;
    if (out.has(virtual)) continue;
    const content = fs.readFileSync(path.join(tsLibDir, fileName), 'utf8');
    out.set(virtual, content);
    for (const ref of ts.preProcessFile(content, true, true).libReferenceDirectives) {
      queue.push(ref.fileName);
    }
  }
  return out;
}

const PACKAGE_JSON_FIELDS = [
  'name',
  'version',
  'type',
  'main',
  'module',
  'types',
  'typings',
  'typesVersions',
  'exports',
];

function nearestPackageJson(file: string): string | undefined {
  let dir = path.dirname(file);
  while (dir.includes('node_modules')) {
    const candidate = path.join(dir, 'package.json');
    if (fs.existsSync(candidate)) return candidate;
    dir = path.dirname(dir);
  }
  return undefined;
}

function collectPackages(specifiers: string[], extraLibs: Set<string>): Map<string, string> {
  const out = new Map<string, string>();
  const probe = path.join(root, '__probe__.ts');
  const queue: string[] = [];

  const enqueueResolved = (resolved: string | undefined, from: string, spec: string) => {
    if (!resolved) throw new Error(`无法解析 ${spec}（来自 ${from}）`);
    if (!resolved.endsWith('.d.ts') && !resolved.endsWith('.d.mts') && !resolved.endsWith('.d.cts')) {
      throw new Error(`${spec} 解析到了非声明文件 ${resolved}`);
    }
    queue.push(resolved);
  };

  for (const spec of specifiers) {
    const r = ts.resolveModuleName(spec, probe, resolveOptions, ts.sys).resolvedModule;
    enqueueResolved(r?.resolvedFileName, 'entry', spec);
  }

  while (queue.length > 0) {
    const file = path.resolve(queue.shift()!);
    const virtual = toVirtual(file);
    if (out.has(virtual)) continue;
    const content = fs.readFileSync(file, 'utf8');
    out.set(virtual, content);

    const pkgJson = nearestPackageJson(file);
    if (pkgJson) {
      const vPkg = toVirtual(pkgJson);
      if (!out.has(vPkg)) {
        const full = JSON.parse(fs.readFileSync(pkgJson, 'utf8')) as Record<string, unknown>;
        const stripped: Record<string, unknown> = {};
        for (const key of PACKAGE_JSON_FIELDS) if (key in full) stripped[key] = full[key];
        out.set(vPkg, JSON.stringify(stripped));
      }
    }

    const info = ts.preProcessFile(content, true, true);
    for (const imp of info.importedFiles) {
      const r = ts.resolveModuleName(imp.fileName, file, resolveOptions, ts.sys).resolvedModule;
      // 声明文件里可能出现只在 Node 环境存在的可选依赖；解析失败即报错，避免静默缺类型。
      enqueueResolved(r?.resolvedFileName, file, imp.fileName);
    }
    for (const ref of info.referencedFiles) {
      queue.push(path.resolve(path.dirname(file), ref.fileName));
    }
    for (const ref of info.typeReferenceDirectives) {
      const r = ts.resolveTypeReferenceDirective(ref.fileName, file, resolveOptions, ts.sys)
        .resolvedTypeReferenceDirective;
      enqueueResolved(r?.resolvedFileName, file, ref.fileName);
    }
    for (const lib of info.libReferenceDirectives) extraLibs.add(lib.fileName);
  }
  return out;
}

function writeGroup(group: TypeGroup, files: Map<string, string>) {
  const sorted = Object.fromEntries([...files.entries()].sort(([a], [b]) => a.localeCompare(b)));
  const json = JSON.stringify({ tsVersion: TS_VERSION, group, files: sorted });
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, `${group}.json`), json);
  const kb = Math.round(Buffer.byteLength(json) / 1024);
  console.log(`  ${group}.json  ${files.size} 个文件  ${kb} KB`);
}

const vitestTypes = fs.readFileSync(path.join(root, 'sandbox', 'types', 'vitest.d.ts'), 'utf8');

console.log(`打包 TypeScript ${TS_VERSION} 类型文件 → ${path.relative(root, outDir)}`);

const extraLibs = new Set<string>();

// test：平台测试 API 依赖 expect-type
const testFiles = collectPackages(['expect-type'], extraLibs);
testFiles.set('/node_modules/vitest/package.json', JSON.stringify({ name: 'vitest', types: 'index.d.ts' }));
testFiles.set('/node_modules/vitest/index.d.ts', vitestTypes);
testFiles.set('/node_modules/vitest/browser.d.ts', fs.readFileSync(path.join(root, 'sandbox', 'types', 'vitest-browser.d.ts'), 'utf8'));

const domTestingFiles = collectPackages(['@testing-library/dom', '@testing-library/user-event'], extraLibs);
const reactFiles = collectPackages(
  ['react', 'react/jsx-runtime', 'react-dom', 'react-dom/client', '@testing-library/react', 'react-router', 'react-router/dom'],
  extraLibs,
);
// @testing-library/react 依赖 @testing-library/dom，避免与 dom-testing 组重复
for (const key of domTestingFiles.keys()) reactFiles.delete(key);

const coreLibs = collectLibs(['es2025', 'dom', 'webworker', ...extraLibs]);

writeGroup('core', coreLibs);
writeGroup('test', testFiles);
writeGroup('dom-testing', domTestingFiles);
writeGroup('react', reactFiles);

fs.writeFileSync(
  path.join(outDir, 'manifest.json'),
  JSON.stringify({ tsVersion: TS_VERSION, groups: ['core', 'test', 'dom-testing', 'react'] }),
);
