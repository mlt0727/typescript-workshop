import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { JudgeResult } from '../judge/judge.ts';
import type { Draft, LessonProgress, Meta } from './schema.ts';

interface WorkshopDB extends DBSchema {
  progress: { key: string; value: LessonProgress };
  drafts: { key: string; value: Draft };
  meta: { key: string; value: { key: string; value: Meta } };
  /** 最近一次提交的详细结果（只用于刷新后显示，不导出、不同步） */
  results: { key: string; value: { key: string; result: JudgeResult } };
}

export const DB_NAME = 'typescript-workshop';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<WorkshopDB>> | undefined;

export function openWorkshopDB(): Promise<IDBPDatabase<WorkshopDB>> {
  dbPromise ??= openDB<WorkshopDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      db.createObjectStore('progress', { keyPath: 'lessonId' });
      db.createObjectStore('drafts', { keyPath: 'key' });
      db.createObjectStore('meta', { keyPath: 'key' });
      db.createObjectStore('results', { keyPath: 'key' });
    },
    blocked() {
      // 另一个标签页仍在使用旧版本数据库
    },
  }).catch((err: unknown) => {
    dbPromise = undefined;
    throw err;
  });
  return dbPromise;
}

export type { WorkshopDB };
