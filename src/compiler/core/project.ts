import ts from 'typescript';
import {
  rawCheckOptions,
  rawTranspileOptions,
  typeGroupsFor,
  type CompilerOverrides,
  type RunMode,
  type TypeGroup,
} from '../config.ts';
import { toDiagnosticInfo } from './diagnostics.ts';
import { checkRules } from './rules.ts';
import { loopGuardTransformer, rewriteSpecifiersTransformer, type ResolvedImport } from './transform.ts';
import type {
  BuildRunOptions,
  CompletionItem,
  DiagnosticInfo,
  ProjectSpec,
  QuickInfo,
  RuleId,
  RuleViolation,
  RunBundle,
  RunModule,
} from './types.ts';

/** 平台在沙箱中提供的依赖（不支持任意 npm 包）。 */
export const PROVIDED_DEPS = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  'vitest',
  '@testing-library/dom',
  '@testing-library/react',
  '@testing-library/user-event',
] as const;

const ENV_DTS_PATH = '/__tsw__/env.d.ts';
const ENV_DTS = `// 平台提供：允许 import './style.css'（与 Vite 的行为一致：样式会被注入页面）\ndeclare module '*.css' {}\n`;

export type TypeGroupLoader = (group: TypeGroup) => Promise<Record<string, string>>;

function toAbs(path: string): string {
  return path.startsWith('/') ? path : `/${path}`;
}

function toRel(path: string): string {
  return path.startsWith('/') ? path.slice(1) : path;
}

function isSourceFile(path: string): boolean {
  return /\.(ts|tsx|mts|cts)$/.test(path);
}

/** 所有项目共享的只读文件（lib 与依赖类型）。 */
class SharedFiles {
  readonly files = new Map<string, string>();
  readonly dirs = new Set<string>(['/']);
  readonly snapshots = new Map<string, ts.IScriptSnapshot>();
  readonly loaded = new Set<TypeGroup>();

  add(record: Record<string, string>) {
    for (const [path, content] of Object.entries(record)) {
      this.files.set(path, content);
      let dir = path.slice(0, path.lastIndexOf('/'));
      while (dir && !this.dirs.has(dir)) {
        this.dirs.add(dir);
        dir = dir.slice(0, dir.lastIndexOf('/'));
      }
    }
  }

  snapshot(path: string): ts.IScriptSnapshot | undefined {
    let snap = this.snapshots.get(path);
    if (!snap) {
      const content = this.files.get(path);
      if (content === undefined) return undefined;
      snap = ts.ScriptSnapshot.fromString(content);
      this.snapshots.set(path, snap);
    }
    return snap;
  }
}

/**
 * 文件版本号必须全局唯一：共享的 DocumentRegistry 以“路径 + 版本”缓存语法树，
 * 不同项目里同名的 /main.ts 若版本号相同会被误认为同一文件。
 */
let globalVersion = 0;

interface ProjectFileState {
  content: string;
  version: number;
  snapshot: ts.IScriptSnapshot;
}

function parseOptions(raw: Record<string, unknown>): ts.CompilerOptions {
  const { options, errors } = ts.convertCompilerOptionsFromJson(raw, '/');
  if (errors.length > 0) {
    throw new Error(
      errors.map((e) => ts.flattenDiagnosticMessageText(e.messageText, '\n')).join('\n'),
    );
  }
  return options;
}

export class VirtualProject {
  readonly mode: RunMode;
  readonly options: ts.CompilerOptions;
  readonly service: ts.LanguageService;
  readonly groups: TypeGroup[];
  private readonly files = new Map<string, ProjectFileState>();
  private projectVersion = 0;
  readonly moduleHost: ts.ModuleResolutionHost;

  constructor(
    shared: SharedFiles,
    registry: ts.DocumentRegistry,
    mode: RunMode,
    overrides: CompilerOverrides,
    withTests: boolean,
  ) {
    this.mode = mode;
    this.groups = typeGroupsFor(mode, withTests);
    this.options = parseOptions(rawCheckOptions(mode, overrides));

    const fileExists = (path: string) => this.files.has(path) || shared.files.has(path);
    const readFile = (path: string) => this.files.get(path)?.content ?? shared.files.get(path);
    const directoryExists = (dir: string) => {
      const d = dir.endsWith('/') && dir.length > 1 ? dir.slice(0, -1) : dir;
      if (shared.dirs.has(d)) return true;
      const prefix = d === '/' ? '/' : `${d}/`;
      for (const key of this.files.keys()) if (key.startsWith(prefix)) return true;
      return false;
    };
    this.moduleHost = { fileExists, readFile, directoryExists, realpath: (p) => p };

    const host: ts.LanguageServiceHost = {
      getCompilationSettings: () => this.options,
      getProjectVersion: () => String(this.projectVersion),
      getScriptFileNames: () => {
        const names = [...this.files.keys()].filter(isSourceFile);
        if (mode !== 'ts') names.push(ENV_DTS_PATH);
        return names;
      },
      getScriptVersion: (path) => String(this.files.get(path)?.version ?? 1),
      getScriptSnapshot: (path) => {
        if (path === ENV_DTS_PATH) return ts.ScriptSnapshot.fromString(ENV_DTS);
        return this.files.get(path)?.snapshot ?? shared.snapshot(path);
      },
      getCurrentDirectory: () => '/',
      getDefaultLibFileName: (opts) => `/lib/${ts.getDefaultLibFileName(opts)}`,
      fileExists: (path) => path === ENV_DTS_PATH || fileExists(path),
      readFile: (path) => (path === ENV_DTS_PATH ? ENV_DTS : readFile(path)),
      directoryExists,
      getDirectories: (dir) => {
        const prefix = dir.endsWith('/') ? dir : `${dir}/`;
        const out = new Set<string>();
        for (const d of shared.dirs) {
          if (d.startsWith(prefix)) {
            const rest = d.slice(prefix.length);
            if (rest && !rest.includes('/')) out.add(rest);
          }
        }
        return [...out];
      },
      useCaseSensitiveFileNames: () => true,
      realpath: (p) => p,
    };
    this.service = ts.createLanguageService(host, registry);
  }

  /** 用给定文件集合替换项目内容（只有变化的文件会提升版本）。 */
  setFiles(files: Record<string, string>) {
    const next = new Set<string>();
    let changed = false;
    for (const [rel, content] of Object.entries(files)) {
      const path = toAbs(rel);
      next.add(path);
      const prev = this.files.get(path);
      if (!prev || prev.content !== content) {
        this.files.set(path, {
          content,
          version: ++globalVersion,
          snapshot: ts.ScriptSnapshot.fromString(content),
        });
        changed = true;
      }
    }
    for (const path of [...this.files.keys()]) {
      if (!next.has(path)) {
        this.files.delete(path);
        changed = true;
      }
    }
    if (changed) this.projectVersion++;
  }

  fileNames(): string[] {
    return [...this.files.keys()].map(toRel);
  }

  content(rel: string): string | undefined {
    return this.files.get(toAbs(rel))?.content;
  }

  /** 指定文件的语法 + 语义诊断（不含 suggestion）。 */
  diagnostics(rels?: string[]): DiagnosticInfo[] {
    const targets = (rels ?? this.fileNames()).map(toAbs).filter((p) => isSourceFile(p) && this.files.has(p));
    const out: DiagnosticInfo[] = [];
    for (const path of targets) {
      for (const d of this.service.getSyntacticDiagnostics(path)) out.push(toDiagnosticInfo(d));
      for (const d of this.service.getSemanticDiagnostics(path)) out.push(toDiagnosticInfo(d));
    }
    for (const d of this.service.getCompilerOptionsDiagnostics()) out.push(toDiagnosticInfo(d));
    return out;
  }

  /** 编辑器用的“建议”诊断（例如未使用变量显示为灰色），不参与判题。 */
  suggestions(rel: string): DiagnosticInfo[] {
    const path = toAbs(rel);
    if (!this.files.has(path) || !isSourceFile(path)) return [];
    return this.service.getSuggestionDiagnostics(path).map(toDiagnosticInfo);
  }

  completions(rel: string, position: number): CompletionItem[] {
    const info = this.service.getCompletionsAtPosition(toAbs(rel), position, {
      includeCompletionsWithInsertText: true,
      includeCompletionsForModuleExports: false,
    });
    if (!info) return [];
    return info.entries.slice(0, 400).map((e) => ({
      name: e.name,
      kind: e.kind,
      sortText: e.sortText,
      insertText: e.insertText,
      replacementStart: e.replacementSpan?.start,
      replacementLength: e.replacementSpan?.length,
    }));
  }

  completionDetail(rel: string, position: number, name: string): QuickInfo | undefined {
    const d = this.service.getCompletionEntryDetails(toAbs(rel), position, name, {}, undefined, {}, undefined);
    if (!d) return undefined;
    return {
      start: position,
      length: 0,
      display: ts.displayPartsToString(d.displayParts),
      documentation: ts.displayPartsToString(d.documentation),
    };
  }

  quickInfo(rel: string, position: number): QuickInfo | undefined {
    const q = this.service.getQuickInfoAtPosition(toAbs(rel), position);
    if (!q) return undefined;
    return {
      start: q.textSpan.start,
      length: q.textSpan.length,
      display: ts.displayPartsToString(q.displayParts),
      documentation: ts.displayPartsToString(q.documentation),
    };
  }

  rules(rels: string[], forbid: readonly RuleId[]): RuleViolation[] {
    const program = this.service.getProgram();
    if (!program) return [];
    const out: RuleViolation[] = [];
    for (const rel of rels) {
      const sf = program.getSourceFile(toAbs(rel));
      if (sf) out.push(...checkRules(sf, forbid));
    }
    return out;
  }

  private resolve(specifier: string, fromAbs: string): ResolvedImport {
    if ((PROVIDED_DEPS as readonly string[]).includes(specifier)) {
      return { kind: 'dep', name: specifier };
    }
    if (specifier.endsWith('.css')) {
      const target = new URL(specifier, `file://${fromAbs}`).pathname;
      if (this.files.has(target)) return { kind: 'css', path: toRel(target) };
      return { kind: 'missing', specifier };
    }
    const resolved = ts.resolveModuleName(specifier, fromAbs, this.options, this.moduleHost)
      .resolvedModule;
    if (resolved && this.files.has(resolved.resolvedFileName) && !resolved.resolvedFileName.endsWith('.d.ts')) {
      return { kind: 'file', path: toRel(resolved.resolvedFileName) };
    }
    return { kind: 'missing', specifier };
  }

  /** 从入口出发转译所有可达模块，生成交给沙箱的运行包。 */
  buildRun({ entries, nonce, loopGuard }: BuildRunOptions): RunBundle {
    const transpileOptions = parseOptions(rawTranspileOptions(this.mode));
    const modules = new Map<string, RunModule>();
    const externalDeps = new Set<string>();
    const missing: RunBundle['missing'] = [];
    const queue = entries.map((e) => toRel(e));
    const placeholder = (r: ResolvedImport) => {
      switch (r.kind) {
        case 'file':
          return `tsw-${nonce}:file:${r.path}`;
        case 'css':
          return `tsw-${nonce}:css:${r.path}`;
        case 'dep':
          return `tsw-${nonce}:dep:${r.name}`;
        case 'missing':
          return `tsw-${nonce}:missing:${r.specifier}`;
      }
    };

    while (queue.length > 0) {
      const rel = queue.shift()!;
      const id = rel.endsWith('.css') ? `css:${rel}` : `file:${rel}`;
      if (modules.has(id)) continue;
      const content = this.content(rel);
      if (content === undefined) throw new Error(`找不到入口文件：${rel}`);

      if (rel.endsWith('.css')) {
        modules.set(id, { id, path: rel, kind: 'css', code: content, deps: [] });
        continue;
      }

      const deps: string[] = [];
      const abs = toAbs(rel);
      const result = ts.transpileModule(content, {
        fileName: abs,
        compilerOptions: transpileOptions,
        reportDiagnostics: false,
        transformers: {
          before: loopGuard ? [loopGuardTransformer()] : [],
          after: [
            rewriteSpecifiersTransformer((spec) => {
              const r = this.resolve(spec, abs);
              if (r.kind === 'file') {
                deps.push(`file:${r.path}`);
                queue.push(r.path);
              } else if (r.kind === 'css') {
                deps.push(`css:${r.path}`);
                queue.push(r.path);
              } else if (r.kind === 'dep') {
                externalDeps.add(r.name);
              } else {
                missing.push({ from: rel, specifier: r.specifier });
              }
              return placeholder(r);
            }),
          ],
        },
      });
      const code = result.outputText.replace(/\n\/\/# sourceMappingURL=.*\s*$/, '\n');
      modules.set(id, { id, path: rel, kind: 'js', code, map: result.sourceMapText, deps });
    }

    return {
      nonce,
      modules: [...modules.values()],
      entries: entries.map((e) => (e.endsWith('.css') ? `css:${toRel(e)}` : `file:${toRel(e)}`)),
      externalDeps: [...externalDeps],
      missing,
    };
  }
}

/** 管理多个虚拟项目；所有项目共享 lib 文件与 DocumentRegistry。 */
export class ProjectService {
  private readonly shared = new SharedFiles();
  private readonly registry = ts.createDocumentRegistry(true, '/');
  private readonly projects = new Map<string, { key: string; project: VirtualProject; usedAt: number }>();
  private readonly loader: TypeGroupLoader;
  private readonly maxProjects: number;
  private clock = 0;

  constructor(loader: TypeGroupLoader, maxProjects = 12) {
    this.loader = loader;
    this.maxProjects = maxProjects;
  }

  get tsVersion(): string {
    return ts.version;
  }

  async ensureGroups(groups: TypeGroup[]) {
    for (const g of groups) {
      if (this.shared.loaded.has(g)) continue;
      this.shared.add(await this.loader(g));
      this.shared.loaded.add(g);
    }
  }

  /** 获取（必要时创建）项目并写入文件。模式或配置变化时重建。 */
  async open(id: string, spec: ProjectSpec): Promise<VirtualProject> {
    const withTests = spec.withTests ?? false;
    const key = JSON.stringify([spec.mode, spec.overrides ?? {}, withTests]);
    let entry = this.projects.get(id);
    if (!entry || entry.key !== key) {
      await this.ensureGroups(typeGroupsFor(spec.mode, withTests));
      entry?.project.service.dispose();
      entry = {
        key,
        project: new VirtualProject(this.shared, this.registry, spec.mode, spec.overrides ?? {}, withTests),
        usedAt: 0,
      };
      this.projects.set(id, entry);
    }
    entry.usedAt = ++this.clock;
    entry.project.setFiles(spec.files);
    this.evict();
    return entry.project;
  }

  get(id: string): VirtualProject | undefined {
    const entry = this.projects.get(id);
    if (entry) entry.usedAt = ++this.clock;
    return entry?.project;
  }

  close(id: string) {
    const entry = this.projects.get(id);
    if (entry) {
      entry.project.service.dispose();
      this.projects.delete(id);
    }
  }

  private evict() {
    while (this.projects.size > this.maxProjects) {
      let oldest: string | undefined;
      let oldestTime = Infinity;
      for (const [id, e] of this.projects) {
        if (e.usedAt < oldestTime) {
          oldest = id;
          oldestTime = e.usedAt;
        }
      }
      if (oldest === undefined) return;
      this.close(oldest);
    }
  }
}
