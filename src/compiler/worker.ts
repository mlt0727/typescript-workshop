/// <reference lib="webworker" />
import { TS_VERSION, type TypeGroup } from './config.ts';
import { ProjectService } from './core/project.ts';
import type { CompilerMethod, CompilerMethods, CompilerRequest, CompilerResponse } from './protocol.ts';

declare const self: DedicatedWorkerGlobalScope;

let baseUrl = '/';

async function loadGroup(group: TypeGroup): Promise<Record<string, string>> {
  const res = await fetch(`${baseUrl}tsw-types/${TS_VERSION}/${group}.json`);
  if (!res.ok) throw new Error(`加载类型包 ${group} 失败：HTTP ${res.status}`);
  const json = (await res.json()) as { tsVersion: string; files: Record<string, string> };
  if (json.tsVersion !== TS_VERSION) throw new Error(`类型包版本 ${json.tsVersion} 与编译器 ${TS_VERSION} 不一致`);
  return json.files;
}

const service = new ProjectService(loadGroup);

function nonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return [...bytes].map((b) => b.toString(36).padStart(2, '0')).join('').slice(0, 12);
}

type Handlers = { [M in CompilerMethod]: (p: Parameters<CompilerMethods[M]>[0]) => Promise<ReturnType<CompilerMethods[M]>> };

const handlers: Handlers = {
  async init({ baseUrl: b }) {
    baseUrl = b.endsWith('/') ? b : `${b}/`;
    await service.ensureGroups(['core']);
    return { tsVersion: service.tsVersion };
  },
  async diagnostics({ projectId, spec, files }) {
    const p = await service.open(projectId, spec);
    const diagnostics = p.diagnostics(files);
    const suggestions = (files ?? p.fileNames()).flatMap((f) => p.suggestions(f));
    return { diagnostics, suggestions };
  },
  async completions({ projectId, spec, file, position }) {
    const p = await service.open(projectId, spec);
    return p.completions(file, position);
  },
  async completionDetail({ projectId, file, position, name }) {
    return service.get(projectId)?.completionDetail(file, position, name) ?? null;
  },
  async quickInfo({ projectId, spec, file, position }) {
    const p = await service.open(projectId, spec);
    return p.quickInfo(file, position) ?? null;
  },
  async buildRun({ projectId, spec, entries, loopGuard }) {
    const p = await service.open(projectId, spec);
    return { bundle: p.buildRun({ entries, nonce: nonce(), loopGuard }), diagnostics: p.diagnostics() };
  },
  async judge({ projectId, spec, studentFiles, testFiles, forbid, runEntries, loopGuard }) {
    const p = await service.open(projectId, { ...spec, withTests: true });
    const diagnostics = p.diagnostics([...studentFiles, ...testFiles]);
    const rules = p.rules(studentFiles.filter((f) => /\.(ts|tsx)$/.test(f)), forbid);
    const bundle = p.buildRun({ entries: [...runEntries, ...testFiles.filter((f) => !f.endsWith('.d.ts') && !/\.test-d\.tsx?$/.test(f))], nonce: nonce(), loopGuard });
    return { diagnostics, rules, bundle };
  },
};

self.addEventListener('message', async (ev: MessageEvent<CompilerRequest>) => {
  const { id, method, params } = ev.data;
  let response: CompilerResponse;
  try {
    const handler = handlers[method] as (p: unknown) => Promise<unknown>;
    response = { id, ok: true, result: await handler(params) };
  } catch (err) {
    response = { id, ok: false, error: err instanceof Error ? err.message : String(err) };
  }
  self.postMessage(response);
});
