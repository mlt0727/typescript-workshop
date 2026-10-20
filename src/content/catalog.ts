import catalogJson from '../generated/catalog.json';
import type { Catalog, CatalogLesson, Lesson } from './types.ts';
import type { LessonProgress } from '../storage/schema.ts';

export const catalog = catalogJson as Catalog;

export const allLessons: CatalogLesson[] = catalog.stages.flatMap((s) => s.lessons);
const byId = new Map(allLessons.map((l) => [l.id, l]));

export function findLesson(id: string): CatalogLesson | undefined {
  return byId.get(id);
}

export function stageOf(id: string) {
  return catalog.stages.find((s) => s.lessons.some((l) => l.id === id));
}

const loaders = import.meta.glob<{ default: Lesson }>('../generated/lessons/*.json');

export async function loadLesson(id: string): Promise<Lesson | undefined> {
  const load = loaders[`../generated/lessons/${id}.json`];
  if (!load) return undefined;
  return (await load()).default;
}

export type LessonState = 'not-started' | 'in-progress' | 'completed';

/** 课时完成 = 读到课末 + 全部练习曾通过 + 全部测验题曾答对。点开页面不算掌握。 */
export function lessonState(lesson: CatalogLesson, p: LessonProgress | undefined): LessonState {
  const quizCount = lesson.quizCount ?? 0;
  if (!p) return 'not-started';
  const exercises = lesson.exerciseIds ?? [];
  const exercisesDone = exercises.every((id) => p.exercises[id]?.passedAt !== undefined);
  const quizDone = Object.values(p.quiz).filter((q) => q.everCorrect).length >= quizCount;
  if (p.finishedReadingAt && exercisesDone && quizDone) return 'completed';
  const any =
    p.readBlocks.length > 0 ||
    Object.keys(p.exercises).length > 0 ||
    Object.keys(p.quiz).length > 0 ||
    Object.keys(p.playgrounds).length > 0;
  return any ? 'in-progress' : 'not-started';
}

export function exerciseCounts(lesson: CatalogLesson, p: LessonProgress | undefined) {
  const ids = lesson.exerciseIds ?? [];
  return { total: ids.length, passed: ids.filter((id) => p?.exercises[id]?.passedAt !== undefined).length };
}
