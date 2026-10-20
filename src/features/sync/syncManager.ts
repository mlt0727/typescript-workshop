/**
 * 跨设备同步（可选）：本机 IndexedDB 始终是主存储；开启同步后，
 * 启动、回到页面、联网、本地变更（防抖）时与 /api/sync 交换并合并完整进度。
 *
 * - 合并规则见 storage/merge.ts（只增不减、较新者优先、满足交换律）；
 * - 服务器用 revision 做乐观并发，冲突（409）时拉取→合并→重推；
 * - epoch：在任一设备“重置全部进度”会更换 epoch，其他设备看到新 epoch 后采用云端的重置结果。
 */
import { mergeStates } from '../../storage/merge.ts';
import { emptyState, type ProgressState } from '../../storage/schema.ts';
import { progressStore } from '../../storage/store.ts';
import { validateState } from '../../storage/transfer.js';

const KEY = 'tsw:sync';

interface SyncSettings {
  password: string;
  /** 本机最近一次同步时看到的云端 revision 与 epoch */
  revision: number;
  epoch?: string;
  lastSyncedAt?: number;
}

export type SyncPhase = 'off' | 'idle' | 'syncing' | 'ok' | 'error' | 'offline' | 'unauthorized';

export interface SyncSnapshot {
  enabled: boolean;
  phase: SyncPhase;
  message?: string;
  lastSyncedAt?: number;
}

interface RemoteDoc {
  revision: number;
  epoch: string | null;
  state: unknown;
  updatedAt: string | null;
}

class UnauthorizedError extends Error {}

function readSettings(): SyncSettings | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<SyncSettings>;
    if (typeof v.password !== 'string' || !v.password) return null;
    return { password: v.password, revision: typeof v.revision === 'number' ? v.revision : 0, epoch: v.epoch, lastSyncedAt: v.lastSyncedAt };
  } catch {
    return null;
  }
}

function writeSettings(s: SyncSettings | null) {
  try {
    if (s) localStorage.setItem(KEY, JSON.stringify(s));
    else localStorage.removeItem(KEY);
  } catch {
    // localStorage 不可用时同步设置只在本次会话有效
  }
}

/** 键排序后的 JSON：Postgres jsonb 不保留键顺序，比较内容时必须规范化 */
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .filter((k) => (value as Record<string, unknown>)[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function newEpoch() {
  return [...crypto.getRandomValues(new Uint8Array(10))].map((b) => (b % 36).toString(36)).join('');
}

class SyncManager {
  private settings = readSettings();
  private snapshot: SyncSnapshot = { enabled: this.settings !== null, phase: this.settings ? 'idle' : 'off', lastSyncedAt: this.settings?.lastSyncedAt };
  private readonly listeners = new Set<() => void>();
  private timer: number | undefined;
  private running: Promise<void> | undefined;
  private again = false;
  private started = false;

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getSnapshot = () => this.snapshot;

  private set(patch: Partial<SyncSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    for (const l of this.listeners) l();
  }

  private async request(method: 'GET' | 'PUT', body?: unknown, password = this.settings?.password): Promise<{ status: number; data: unknown }> {
    const res = await fetch(`${import.meta.env.BASE_URL}api/sync`, {
      method,
      headers: { authorization: `Bearer ${password ?? ''}`, ...(body ? { 'content-type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    });
    if (res.status === 401) throw new UnauthorizedError('同步密码不正确');
    let data: unknown = null;
    try {
      data = await res.json();
    } catch {
      // 非 JSON 响应（例如静态托管没有 API）
    }
    if (res.status !== 200 && res.status !== 409) {
      const msg = (data as { error?: string } | null)?.error ?? `HTTP ${res.status}`;
      throw new Error(res.status === 404 ? '这个部署没有同步服务（/api/sync 不存在）' : msg);
    }
    return { status: res.status, data };
  }

  /** 应用启动时调用一次：注册事件并开始首次同步 */
  start() {
    if (this.started) return;
    this.started = true;
    progressStore.onChange((reason) => {
      if (!this.settings) return;
      if (reason === 'sync') return;
      this.schedule(reason === 'local' ? 2500 : 200);
    });
    window.addEventListener('online', () => this.schedule(200));
    window.addEventListener('focus', () => this.schedule(500));
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') this.schedule(500);
    });
    if (this.settings) this.schedule(0);
  }

  schedule(delay: number) {
    if (!this.settings) return;
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => void this.syncNow(), delay);
  }

  async enable(password: string): Promise<void> {
    const trimmed = password.trim();
    // 先验证密码，再保存
    const { data } = await this.request('GET', undefined, trimmed);
    const remote = data as RemoteDoc;
    this.settings = { password: trimmed, revision: 0, epoch: remote.epoch ?? undefined };
    writeSettings(this.settings);
    this.set({ enabled: true, phase: 'idle', message: undefined });
    await this.syncNow();
  }

  disable() {
    this.settings = null;
    writeSettings(null);
    window.clearTimeout(this.timer);
    this.set({ enabled: false, phase: 'off', message: undefined, lastSyncedAt: undefined });
  }

  syncNow(): Promise<void> {
    if (this.running) {
      this.again = true;
      return this.running;
    }
    this.running = this.doSync().finally(() => {
      this.running = undefined;
      if (this.again) {
        this.again = false;
        this.schedule(100);
      }
    });
    return this.running;
  }

  private async doSync() {
    const s = this.settings;
    if (!s) return;
    if (!navigator.onLine) {
      this.set({ phase: 'offline', message: '离线：进度先保存在本机，联网后自动同步' });
      return;
    }
    this.set({ phase: 'syncing', message: undefined });
    try {
      for (let attempt = 0; attempt < 4; attempt++) {
        const { data } = await this.request('GET');
        const remote = data as RemoteDoc;
        let remoteState: ProgressState | null = null;
        if (remote.state !== null) {
          const v = validateState(remote.state);
          if (!v.ok) throw new Error(`云端数据格式不正确，未应用：${v.error}`);
          remoteState = v.state;
        }
        const local = progressStore.getSnapshot().state;
        let next: ProgressState;
        let epoch = remote.epoch ?? s.epoch ?? newEpoch();
        let notice: string | undefined;
        if (remoteState && remote.epoch && s.epoch && remote.epoch !== s.epoch && s.revision > 0) {
          // 另一台设备重置了全部进度：采用云端结果
          next = remoteState;
          notice = '云端进度已在另一台设备上被重置，本机已同步为重置后的状态。';
        } else {
          next = remoteState ? mergeStates(local, remoteState) : local;
        }
        await progressStore.applySynced(next);
        if (remoteState && stableStringify(next) === stableStringify(remoteState)) {
          this.finish({ ...s, revision: remote.revision, epoch: remote.epoch ?? epoch }, notice);
          return;
        }
        if (!remote.epoch) epoch = s.epoch ?? epoch;
        const put = await this.request('PUT', { baseRevision: remote.revision, epoch, state: next });
        if (put.status === 200) {
          const r = put.data as { revision: number; epoch: string };
          this.finish({ ...s, revision: r.revision, epoch: r.epoch }, notice);
          return;
        }
        // 409：别的设备刚写入，重新拉取合并
      }
      throw new Error('多次同步冲突，请稍后再试');
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        this.set({ phase: 'unauthorized', message: '同步密码不正确或已更换，请在设置中重新输入。' });
      } else {
        this.set({ phase: 'error', message: `同步失败：${err instanceof Error ? err.message : String(err)}（进度仍保存在本机）` });
      }
    }
  }

  private finish(settings: SyncSettings, notice?: string) {
    const now = Date.now();
    this.settings = { ...settings, lastSyncedAt: now };
    writeSettings(this.settings);
    this.set({ phase: 'ok', message: notice, lastSyncedAt: now });
  }

  /** 重置全部进度后调用：用新的 epoch 把空状态推到云端，其他设备会跟随重置 */
  async pushReset(): Promise<void> {
    const s = this.settings;
    if (!s) return;
    const { data } = await this.request('GET');
    const remote = data as RemoteDoc;
    const epoch = newEpoch();
    const put = await this.request('PUT', { baseRevision: remote.revision, epoch, state: emptyState() });
    if (put.status !== 200) throw new Error('云端进度重置失败，请重试');
    const r = put.data as { revision: number; epoch: string };
    this.finish({ ...s, revision: r.revision, epoch: r.epoch });
  }

  get password(): string | undefined {
    return this.settings?.password;
  }
}

export const syncManager = new SyncManager();
