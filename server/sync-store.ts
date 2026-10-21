/**
 * 同步文档存储。整个账号只有一份文档（单用户），用 revision 做乐观并发控制（CAS）：
 * 只有当客户端提交的 baseRevision 等于当前 revision 时才写入，否则返回 409 和当前内容。
 *
 * - NeonStore：部署环境（Neon Postgres，HTTP 驱动，适合无服务器函数）
 * - FileStore：本地开发（.data/sync.json）
 * - MemoryStore：单元测试
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { neon } from '@neondatabase/serverless';

export interface SyncDocument {
  revision: number;
  /** 进度被“全部重置”时更换；客户端据此判断是否需要丢弃本地数据 */
  epoch: string;
  state: unknown;
  updatedAt: string;
}

export type PutResult = { ok: true; doc: SyncDocument } | { ok: false; current: SyncDocument | null };

export interface SyncStore {
  get(): Promise<SyncDocument | null>;
  put(baseRevision: number, epoch: string, state: unknown): Promise<PutResult>;
}

export class MemoryStore implements SyncStore {
  private doc: SyncDocument | null = null;

  async get() {
    return this.doc ? structuredClone(this.doc) : null;
  }

  async put(baseRevision: number, epoch: string, state: unknown): Promise<PutResult> {
    const current = this.doc?.revision ?? 0;
    if (baseRevision !== current) return { ok: false, current: await this.get() };
    this.doc = { revision: current + 1, epoch, state: structuredClone(state), updatedAt: new Date().toISOString() };
    return { ok: true, doc: structuredClone(this.doc) };
  }
}

export class FileStore implements SyncStore {
  private readonly file: string;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(file: string) {
    this.file = file;
  }

  async get(): Promise<SyncDocument | null> {
    let text: string;
    try {
      text = await fs.readFile(this.file, 'utf8');
    } catch (error) {
      // 只有“文件不存在”才是没有数据；其他错误（以及下面损坏的 JSON）抛出，不能被当成 revision 0 覆盖掉
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
    return JSON.parse(text) as SyncDocument;
  }

  put(baseRevision: number, epoch: string, state: unknown): Promise<PutResult> {
    // 串行化写入，避免本地并发请求互相覆盖
    const run = this.queue.then(async (): Promise<PutResult> => {
      const current = await this.get();
      if (baseRevision !== (current?.revision ?? 0)) return { ok: false, current };
      const doc: SyncDocument = { revision: baseRevision + 1, epoch, state, updatedAt: new Date().toISOString() };
      await fs.mkdir(path.dirname(this.file), { recursive: true });
      // 先写临时文件再 rename：读取的请求不会读到写了一半的文件（h07）
      const temporary = `${this.file}.tmp`;
      await fs.writeFile(temporary, JSON.stringify(doc));
      await fs.rename(temporary, this.file);
      return { ok: true, doc };
    });
    this.queue = run.catch(() => {});
    return run;
  }
}

export class NeonStore implements SyncStore {
  private readonly sql;
  private ready: Promise<void> | undefined;

  constructor(databaseUrl: string) {
    this.sql = neon(databaseUrl);
  }

  private ensureTable() {
    this.ready ??= this.sql`
      CREATE TABLE IF NOT EXISTS tsw_sync (
        id text PRIMARY KEY,
        revision integer NOT NULL,
        epoch text NOT NULL,
        state jsonb NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT now()
      )`.then(() => undefined);
    return this.ready;
  }

  private static toDoc(row: Record<string, unknown>): SyncDocument {
    return {
      revision: Number(row.revision),
      epoch: String(row.epoch),
      state: row.state,
      updatedAt: new Date(String(row.updated_at)).toISOString(),
    };
  }

  async get(): Promise<SyncDocument | null> {
    await this.ensureTable();
    const rows = await this.sql`SELECT revision, epoch, state, updated_at FROM tsw_sync WHERE id = 'main'`;
    const row = rows[0];
    return row ? NeonStore.toDoc(row) : null;
  }

  async put(baseRevision: number, epoch: string, state: unknown): Promise<PutResult> {
    await this.ensureTable();
    const json = JSON.stringify(state);
    const rows =
      baseRevision === 0
        ? await this.sql`
            INSERT INTO tsw_sync (id, revision, epoch, state, updated_at)
            VALUES ('main', 1, ${epoch}, ${json}::jsonb, now())
            ON CONFLICT (id) DO NOTHING
            RETURNING revision, epoch, state, updated_at`
        : await this.sql`
            UPDATE tsw_sync
            SET revision = revision + 1, epoch = ${epoch}, state = ${json}::jsonb, updated_at = now()
            WHERE id = 'main' AND revision = ${baseRevision}
            RETURNING revision, epoch, state, updated_at`;
    const row = rows[0];
    if (row) return { ok: true, doc: NeonStore.toDoc(row) };
    return { ok: false, current: await this.get() };
  }
}
