import { describe, expect, test } from 'vitest';
import type { LessonProgress } from '../storage/schema.ts';
import { lessonState } from './catalog.ts';
import type { CatalogLesson } from './types.ts';

const lesson = { id: 'x01', title: '课', status: 'published', exerciseIds: ['task', 'challenge'], quizCount: 2 } as CatalogLesson;
const progress = (patch: Partial<LessonProgress> = {}): LessonProgress => ({
  lessonId: 'x01',
  lessonVersion: 1,
  readBlocks: [],
  exercises: {},
  quiz: {},
  playgrounds: {},
  updatedAt: 1,
  ...patch,
});
const answer = { selected: ['a'], correct: true, everCorrect: true, at: 1 };
const passed = (at: number) => ({ passedAt: at, hintLevel: 0, attempts: 1, updatedAt: at });
const ranOnly = { ranAt: 2, hintLevel: 0, attempts: 0, updatedAt: 2 };

describe('课时完成', () => {
  test('全部练习曾通过、全部测验题曾答对就算完成，不要求读到课末', () => {
    const done = progress({ exercises: { task: passed(1), challenge: passed(2) }, quiz: { q1: answer, q2: answer } });
    expect(lessonState(lesson, done)).toBe('completed');
  });

  test('少一个练习、少一道测验或测验只答错过：进行中', () => {
    expect(lessonState(lesson, progress({ exercises: { task: passed(1) }, quiz: { q1: answer, q2: answer } }))).toBe('in-progress');
    expect(lessonState(lesson, progress({ exercises: { task: passed(1), challenge: passed(2) }, quiz: { q1: answer } }))).toBe('in-progress');
    const wrong = { ...answer, correct: false, everCorrect: false };
    expect(lessonState(lesson, progress({ exercises: { task: passed(1), challenge: passed(2) }, quiz: { q1: answer, q2: wrong } }))).toBe('in-progress');
    // 运行过但没通过的练习
    expect(lessonState(lesson, progress({ exercises: { task: passed(1), challenge: ranOnly }, quiz: { q1: answer, q2: answer } }))).toBe('in-progress');
  });

  test('没有记录是未开始；只是打开过页面（读过一段）是进行中', () => {
    expect(lessonState(lesson, undefined)).toBe('not-started');
    expect(lessonState(lesson, progress())).toBe('not-started');
    expect(lessonState(lesson, progress({ readBlocks: ['p1'] }))).toBe('in-progress');
  });

  test('既没有练习也没有测验的课时：读到课末才算完成', () => {
    const reading = { ...lesson, exerciseIds: [], quizCount: 0 } as CatalogLesson;
    expect(lessonState(reading, progress({ readBlocks: ['p1'] }))).toBe('in-progress');
    expect(lessonState(reading, progress({ readBlocks: ['p1'], finishedReadingAt: 5 }))).toBe('completed');
  });
});
