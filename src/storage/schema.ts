/**
 * 学习进度与草稿的数据结构。
 * 同一份结构用于：IndexedDB 存储、进度导出/导入文件、跨设备同步文档。
 * 导入与同步收到的数据都必须先通过这里的 schema 校验，且只当作数据处理，从不执行。
 */
import { z } from 'zod';

export const PROGRESS_FORMAT = 'typescript-workshop-progress';
export const PROGRESS_SCHEMA_VERSION = 1;
/** 导入文件大小上限 */
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

const id = z.string().min(1).max(100).regex(/^[a-z0-9-]+$/);
const ts = z.number().int().nonnegative();
/** 只允许相对路径：不能以 / 开头，不能包含 .. 段 */
const filePath = z
  .string()
  .min(1)
  .max(200)
  .regex(/^(?!\/)(?!.*(^|\/)\.\.(\/|$))[A-Za-z0-9_\-./]+$/);

export const exerciseProgressSchema = z.object({
  /** 曾经提交通过（之后修改代码不会取消这个历史记录） */
  passedAt: ts.optional(),
  passedHash: z.string().max(80).optional(),
  /** 运行过（点过“运行”） */
  ranAt: ts.optional(),
  /** 已查看参考答案 */
  viewedSolutionAt: ts.optional(),
  /** 已展开的提示级别：0、1、2 */
  hintLevel: z.number().int().min(0).max(2).default(0),
  attempts: z.number().int().min(0).max(100_000).default(0),
  /** 最近一次提交的结果摘要（与快照哈希绑定） */
  last: z
    .object({
      hash: z.string().max(80),
      at: ts,
      passed: z.boolean(),
      typesOk: z.boolean(),
      rulesOk: z.boolean(),
      testsOk: z.boolean(),
    })
    .optional(),
  updatedAt: ts,
});
export type ExerciseProgress = z.infer<typeof exerciseProgressSchema>;

export const quizAnswerSchema = z.object({
  selected: z.array(z.string().max(4)).max(10),
  correct: z.boolean(),
  /** 曾经答对过 */
  everCorrect: z.boolean(),
  at: ts,
});
export type QuizAnswer = z.infer<typeof quizAnswerSchema>;

export const lessonProgressSchema = z.object({
  lessonId: id,
  lessonVersion: z.number().int().min(1),
  readBlocks: z.array(z.string().max(100)).max(500),
  /** 读到了课末 */
  finishedReadingAt: ts.optional(),
  lastBlockId: z.string().max(100).optional(),
  exercises: z.record(id, exerciseProgressSchema),
  quiz: z.record(id, quizAnswerSchema),
  playgrounds: z.record(id, z.object({ ranAt: ts })),
  updatedAt: ts,
});
export type LessonProgress = z.infer<typeof lessonProgressSchema>;

export const draftSchema = z.object({
  /** `${lessonId}::${blockId}` */
  key: z.string().max(220),
  lessonId: id,
  blockId: id,
  files: z.record(filePath, z.string().max(200_000)),
  /** 草稿创建时起始代码的哈希；课程更新后不一致 → 提示学习者，而不是静默覆盖 */
  baseHash: z.string().max(80),
  updatedAt: ts,
});
export type Draft = z.infer<typeof draftSchema>;

export const metaSchema = z.object({
  lastLocation: z.object({ lessonId: id, blockId: z.string().max(100).optional(), at: ts }).optional(),
});
export type Meta = z.infer<typeof metaSchema>;

export const progressStateSchema = z.object({
  lessons: z.record(id, lessonProgressSchema),
  drafts: z.record(z.string().max(220), draftSchema),
  meta: metaSchema,
});
export type ProgressState = z.infer<typeof progressStateSchema>;

export const exportFileSchema = z.object({
  format: z.literal(PROGRESS_FORMAT),
  schemaVersion: z.number().int(),
  exportedAt: z.string().max(40),
  state: z.unknown(),
});

export function emptyState(): ProgressState {
  return { lessons: {}, drafts: {}, meta: {} };
}

export function draftKey(lessonId: string, blockId: string) {
  return `${lessonId}::${blockId}`;
}
