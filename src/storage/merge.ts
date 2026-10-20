/**
 * 合并两份进度（用于“合并导入”与跨设备同步）。原则：
 * - 学习记录只增不减：曾通过、曾查看答案、曾运行、已读块、曾答对都取并集/较早的时间；
 * - 草稿与“最近一次结果”这类会变化的数据，按 updatedAt 取较新的一份；
 * - 合并是确定性的，并且满足交换律（a⊕b 与 b⊕a 结果相同），两台设备反复同步不会来回覆盖。
 */
import type { Draft, ExerciseProgress, LessonProgress, ProgressState, QuizAnswer } from './schema.ts';

function minDefined(a: number | undefined, b: number | undefined) {
  if (a === undefined) return b;
  if (b === undefined) return a;
  return Math.min(a, b);
}

/** 选较新者；时间相同时按内容的 JSON 字典序决定，保证交换律 */
function newer<T extends { updatedAt?: number; at?: number }>(a: T, b: T): T {
  const ta = a.updatedAt ?? a.at ?? 0;
  const tb = b.updatedAt ?? b.at ?? 0;
  if (ta !== tb) return ta > tb ? a : b;
  return JSON.stringify(a) >= JSON.stringify(b) ? a : b;
}

export function mergeExercise(a: ExerciseProgress, b: ExerciseProgress): ExerciseProgress {
  const passedAt = minDefined(a.passedAt, b.passedAt);
  let passedHash: string | undefined;
  if (passedAt !== undefined) {
    // 两边通过时间相同时按字典序取，保证交换律
    const candidates = [a, b].filter((x) => x.passedAt === passedAt).map((x) => x.passedHash ?? '');
    passedHash = candidates.sort().at(-1) || undefined;
  }
  const lastA = a.last;
  const lastB = b.last;
  const last = lastA && lastB ? newer(lastA, lastB) : (lastA ?? lastB);
  return {
    passedAt,
    passedHash,
    ranAt: minDefined(a.ranAt, b.ranAt),
    viewedSolutionAt: minDefined(a.viewedSolutionAt, b.viewedSolutionAt),
    hintLevel: Math.max(a.hintLevel, b.hintLevel),
    attempts: Math.max(a.attempts, b.attempts),
    last,
    updatedAt: Math.max(a.updatedAt, b.updatedAt),
  };
}

function mergeQuiz(a: QuizAnswer, b: QuizAnswer): QuizAnswer {
  const latest = newer(a, b);
  return { ...latest, everCorrect: a.everCorrect || b.everCorrect };
}

function mergeRecord<T>(a: Record<string, T>, b: Record<string, T>, merge: (x: T, y: T) => T): Record<string, T> {
  const out: Record<string, T> = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = k in out ? merge(out[k]!, v) : v;
  return Object.fromEntries(Object.entries(out).sort(([x], [y]) => x.localeCompare(y)));
}

export function mergeLesson(a: LessonProgress, b: LessonProgress): LessonProgress {
  const latest = newer(a, b);
  return {
    lessonId: a.lessonId,
    lessonVersion: Math.max(a.lessonVersion, b.lessonVersion),
    readBlocks: [...new Set([...a.readBlocks, ...b.readBlocks])].sort(),
    finishedReadingAt: minDefined(a.finishedReadingAt, b.finishedReadingAt),
    lastBlockId: latest.lastBlockId,
    exercises: mergeRecord(a.exercises, b.exercises, mergeExercise),
    quiz: mergeRecord(a.quiz, b.quiz, mergeQuiz),
    playgrounds: mergeRecord(a.playgrounds, b.playgrounds, (x, y) => ({ ranAt: Math.min(x.ranAt, y.ranAt) })),
    updatedAt: Math.max(a.updatedAt, b.updatedAt),
  };
}

export function mergeDraft(a: Draft, b: Draft): Draft {
  return newer(a, b);
}

export function mergeStates(a: ProgressState, b: ProgressState): ProgressState {
  const la = a.meta.lastLocation;
  const lb = b.meta.lastLocation;
  const lastLocation = la && lb ? newer(la, lb) : (la ?? lb);
  return {
    lessons: mergeRecord(a.lessons, b.lessons, mergeLesson),
    drafts: mergeRecord(a.drafts, b.drafts, mergeDraft),
    meta: lastLocation ? { lastLocation } : {},
  };
}
