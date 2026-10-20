/**
 * 学习进度 store：内存中保存完整状态，变更后写入 IndexedDB。
 * - 写入失败会记录在 status.saveError 中并显示给学习者，绝不假装保存成功；
 * - IndexedDB 不可用（隐私模式、被禁用）时，状态只在当前页面会话中有效，并明确提示。
 */
import { useSyncExternalStore } from 'react';
import type { JudgeResult } from '../judge/judge.ts';
import { openWorkshopDB } from './db.ts';
import { mergeStates } from './merge.ts';
import {
  draftKey,
  emptyState,
  progressStateSchema,
  type Draft,
  type ExerciseProgress,
  type LessonProgress,
  type ProgressState,
} from './schema.ts';

export interface StoreStatus {
  loaded: boolean;
  /** 无法打开本地数据库 */
  unavailable?: string;
  /** 最近一次写入失败的原因（成功写入后清除） */
  saveError?: string;
  /** 有多少条写入尚未完成 */
  pending: number;
  /** 加载时发现并跳过的损坏记录数 */
  skippedCorrupt: number;
}

export interface Snapshot {
  state: ProgressState;
  status: StoreStatus;
}

type ChangeListener = (reason: 'local' | 'import' | 'sync' | 'reset') => void;

function errorText(err: unknown): string {
  if (err instanceof DOMException && err.name === 'QuotaExceededError') return '浏览器存储空间不足';
  return err instanceof Error ? err.message : String(err);
}

export class ProgressStore {
  private snapshot: Snapshot = { state: emptyState(), status: { loaded: false, pending: 0, skippedCorrupt: 0 } };
  private readonly listeners = new Set<() => void>();
  private readonly changeListeners = new Set<ChangeListener>();
  private readonly draftTimers = new Map<string, number>();
  private readonly results = new Map<string, JudgeResult>();
  private memoryOnly = false;

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getSnapshot = () => this.snapshot;

  /** 本地数据变化（用于触发同步） */
  onChange(fn: ChangeListener) {
    this.changeListeners.add(fn);
    return () => this.changeListeners.delete(fn);
  }

  private emit(next: Partial<Snapshot>) {
    this.snapshot = { ...this.snapshot, ...next };
    for (const l of this.listeners) l();
  }

  private setStatus(patch: Partial<StoreStatus>) {
    this.emit({ status: { ...this.snapshot.status, ...patch } });
  }

  private changed(reason: Parameters<ChangeListener>[0]) {
    for (const l of this.changeListeners) l(reason);
  }

  async load() {
    try {
      const db = await openWorkshopDB();
      const [progress, drafts, meta, results] = await Promise.all([
        db.getAll('progress'),
        db.getAll('drafts'),
        db.get('meta', 'meta'),
        db.getAll('results'),
      ]);
      const raw = {
        lessons: Object.fromEntries(progress.map((p) => [p.lessonId, p])),
        drafts: Object.fromEntries(drafts.map((d) => [d.key, d])),
        meta: meta?.value ?? {},
      };
      let skipped = 0;
      let state: ProgressState;
      const parsed = progressStateSchema.safeParse(raw);
      if (parsed.success) {
        state = parsed.data;
      } else {
        // 逐条校验，跳过损坏的记录，保留其余数据
        state = emptyState();
        for (const p of progress) {
          const r = progressStateSchema.shape.lessons.safeParse({ [p.lessonId]: p });
          if (r.success) Object.assign(state.lessons, r.data);
          else skipped++;
        }
        for (const d of drafts) {
          const r = progressStateSchema.shape.drafts.safeParse({ [d.key]: d });
          if (r.success) Object.assign(state.drafts, r.data);
          else skipped++;
        }
        const m = progressStateSchema.shape.meta.safeParse(meta?.value ?? {});
        if (m.success) state.meta = m.data;
      }
      for (const r of results) this.results.set(r.key, r.result);
      this.emit({ state, status: { ...this.snapshot.status, loaded: true, skippedCorrupt: skipped } });
    } catch (err) {
      this.memoryOnly = true;
      this.setStatus({ loaded: true, unavailable: `无法使用浏览器本地存储（${errorText(err)}）。本次学习记录只保存在当前页面中，关闭后会丢失。` });
    }
  }

  private async write(op: (db: Awaited<ReturnType<typeof openWorkshopDB>>) => Promise<unknown>) {
    if (this.memoryOnly) return;
    this.setStatus({ pending: this.snapshot.status.pending + 1 });
    try {
      const db = await openWorkshopDB();
      await op(db);
      this.setStatus({ pending: this.snapshot.status.pending - 1, saveError: undefined });
    } catch (err) {
      this.setStatus({ pending: this.snapshot.status.pending - 1, saveError: `保存失败：${errorText(err)}` });
    }
  }

  // ———————————— 课时进度 ————————————

  lesson(lessonId: string): LessonProgress | undefined {
    return this.snapshot.state.lessons[lessonId];
  }

  private updateLesson(lessonId: string, version: number, fn: (l: LessonProgress) => LessonProgress) {
    const now = Date.now();
    const prev: LessonProgress = this.snapshot.state.lessons[lessonId] ?? {
      lessonId,
      lessonVersion: version,
      readBlocks: [],
      exercises: {},
      quiz: {},
      playgrounds: {},
      updatedAt: now,
    };
    const next = { ...fn(structuredClone(prev)), lessonVersion: Math.max(prev.lessonVersion, version), updatedAt: now };
    this.emit({ state: { ...this.snapshot.state, lessons: { ...this.snapshot.state.lessons, [lessonId]: next } } });
    void this.write((db) => db.put('progress', next));
    this.changed('local');
  }

  private updateExercise(lessonId: string, version: number, exId: string, fn: (e: ExerciseProgress) => ExerciseProgress) {
    this.updateLesson(lessonId, version, (l) => {
      const prev: ExerciseProgress = l.exercises[exId] ?? { hintLevel: 0, attempts: 0, updatedAt: Date.now() };
      l.exercises[exId] = { ...fn(prev), updatedAt: Date.now() };
      return l;
    });
  }

  markBlockRead(lessonId: string, version: number, blockId: string) {
    const l = this.lesson(lessonId);
    if (l?.readBlocks.includes(blockId)) return;
    this.updateLesson(lessonId, version, (x) => ({ ...x, readBlocks: [...x.readBlocks, blockId], lastBlockId: blockId }));
  }

  markFinishedReading(lessonId: string, version: number) {
    if (this.lesson(lessonId)?.finishedReadingAt) return;
    this.updateLesson(lessonId, version, (x) => ({ ...x, finishedReadingAt: Date.now() }));
  }

  recordPlaygroundRun(lessonId: string, version: number, id: string) {
    if (this.lesson(lessonId)?.playgrounds[id]) return;
    this.updateLesson(lessonId, version, (x) => ({ ...x, playgrounds: { ...x.playgrounds, [id]: { ranAt: Date.now() } } }));
  }

  recordExerciseRun(lessonId: string, version: number, exId: string) {
    this.updateExercise(lessonId, version, exId, (e) => ({ ...e, ranAt: e.ranAt ?? Date.now() }));
  }

  recordHint(lessonId: string, version: number, exId: string, level: number) {
    this.updateExercise(lessonId, version, exId, (e) => ({ ...e, hintLevel: Math.max(e.hintLevel, level) }));
  }

  recordViewedSolution(lessonId: string, version: number, exId: string) {
    this.updateExercise(lessonId, version, exId, (e) => ({ ...e, viewedSolutionAt: e.viewedSolutionAt ?? Date.now() }));
  }

  recordSubmission(lessonId: string, version: number, exId: string, result: JudgeResult) {
    const key = draftKey(lessonId, exId);
    this.results.set(key, result);
    void this.write((db) => db.put('results', { key, result }));
    this.updateExercise(lessonId, version, exId, (e) => ({
      ...e,
      attempts: e.attempts + 1,
      passedAt: e.passedAt ?? (result.passed ? result.at : undefined),
      passedHash: e.passedHash ?? (result.passed ? result.snapshotHash : undefined),
      last: {
        hash: result.snapshotHash,
        at: result.at,
        passed: result.passed,
        typesOk: result.types.ok,
        rulesOk: result.rules.ok,
        testsOk: result.tests.ok,
      },
    }));
  }

  lastResult(lessonId: string, exId: string): JudgeResult | undefined {
    return this.results.get(draftKey(lessonId, exId));
  }

  recordQuizAnswer(lessonId: string, version: number, qId: string, selected: string[], correct: boolean) {
    this.updateLesson(lessonId, version, (x) => {
      const prev = x.quiz[qId];
      x.quiz[qId] = { selected, correct, everCorrect: (prev?.everCorrect ?? false) || correct, at: Date.now() };
      return x;
    });
  }

  setLastLocation(lessonId: string, blockId?: string) {
    const meta = { ...this.snapshot.state.meta, lastLocation: { lessonId, blockId, at: Date.now() } };
    this.emit({ state: { ...this.snapshot.state, meta } });
    void this.write((db) => db.put('meta', { key: 'meta', value: meta }));
    this.changed('local');
  }

  // ———————————— 草稿 ————————————

  draft(lessonId: string, blockId: string): Draft | undefined {
    return this.snapshot.state.drafts[draftKey(lessonId, blockId)];
  }

  /** 保存草稿：内存立即更新，写入数据库防抖 400ms */
  saveDraft(lessonId: string, blockId: string, files: Record<string, string>, baseHash: string) {
    const key = draftKey(lessonId, blockId);
    const draft: Draft = { key, lessonId, blockId, files, baseHash, updatedAt: Date.now() };
    this.emit({ state: { ...this.snapshot.state, drafts: { ...this.snapshot.state.drafts, [key]: draft } } });
    window.clearTimeout(this.draftTimers.get(key));
    this.draftTimers.set(
      key,
      window.setTimeout(() => {
        this.draftTimers.delete(key);
        const current = this.snapshot.state.drafts[key];
        if (current) void this.write((db) => db.put('drafts', current));
        this.changed('local');
      }, 400),
    );
  }

  deleteDraft(lessonId: string, blockId: string) {
    const key = draftKey(lessonId, blockId);
    window.clearTimeout(this.draftTimers.get(key));
    const drafts = { ...this.snapshot.state.drafts };
    delete drafts[key];
    this.emit({ state: { ...this.snapshot.state, drafts } });
    void this.write((db) => db.delete('drafts', key));
    this.changed('local');
  }

  /** 页面关闭前把尚未写入的草稿立即写入 */
  flushDrafts() {
    for (const [key, timer] of this.draftTimers) {
      window.clearTimeout(timer);
      const current = this.snapshot.state.drafts[key];
      if (current) void this.write((db) => db.put('drafts', current));
    }
    this.draftTimers.clear();
  }

  // ———————————— 导入、同步、重置 ————————————

  /** 用完整状态替换（在一个事务中写入，失败则整体回滚并保留原数据） */
  private async persistAll(state: ProgressState): Promise<void> {
    if (this.memoryOnly) return;
    const db = await openWorkshopDB();
    const tx = db.transaction(['progress', 'drafts', 'meta'], 'readwrite');
    await Promise.all([tx.objectStore('progress').clear(), tx.objectStore('drafts').clear()]);
    await Promise.all([
      ...Object.values(state.lessons).map((l) => tx.objectStore('progress').put(l)),
      ...Object.values(state.drafts).map((d) => tx.objectStore('drafts').put(d)),
      tx.objectStore('meta').put({ key: 'meta', value: state.meta }),
    ]);
    await tx.done;
  }

  /** 合并导入：先写入数据库，成功后才更新界面；失败时现有数据保持不变 */
  async importState(incoming: ProgressState, mode: 'merge' | 'replace'): Promise<void> {
    const next = mode === 'merge' ? mergeStates(this.snapshot.state, incoming) : incoming;
    await this.persistAll(next);
    this.emit({ state: next });
    this.changed('import');
  }

  /** 同步拉取后应用合并结果 */
  async applySynced(next: ProgressState): Promise<void> {
    if (JSON.stringify(next) === JSON.stringify(this.snapshot.state)) return;
    await this.persistAll(next);
    this.emit({ state: next });
    this.changed('sync');
  }

  async resetAll(): Promise<void> {
    await this.persistAll(emptyState());
    if (!this.memoryOnly) {
      const db = await openWorkshopDB();
      await db.clear('results');
    }
    this.results.clear();
    this.emit({ state: emptyState() });
    this.changed('reset');
  }
}

export const progressStore = new ProgressStore();

export function useProgress<T>(select: (s: Snapshot) => T): T {
  return useSyncExternalStore(progressStore.subscribe, () => select(progressStore.getSnapshot()));
}
