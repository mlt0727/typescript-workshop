import { describe, expect, test } from 'vitest';
import { mergeStates } from './merge.ts';
import { emptyState, type ProgressState } from './schema.ts';
import { parseImport, serializeExport } from './transfer.ts';

function stateA(): ProgressState {
  return {
    lessons: {
      l1: {
        lessonId: 'l1',
        lessonVersion: 1,
        readBlocks: ['p1', 'p2'],
        exercises: {
          e1: {
            passedAt: 100,
            passedHash: 'h1',
            hintLevel: 1,
            attempts: 2,
            updatedAt: 100,
            last: { hash: 'h1', at: 100, passed: true, typesOk: true, rulesOk: true, testsOk: true },
          },
        },
        quiz: { q1: { selected: ['a'], correct: false, everCorrect: false, at: 50 } },
        playgrounds: { pg: { ranAt: 30 } },
        updatedAt: 100,
      },
    },
    drafts: {
      'l1::e1': { key: 'l1::e1', lessonId: 'l1', blockId: 'e1', files: { 'main.ts': 'a' }, baseHash: 'b', updatedAt: 90 },
    },
    meta: { lastLocation: { lessonId: 'l1', at: 100 } },
  };
}

function stateB(): ProgressState {
  return {
    lessons: {
      l1: {
        lessonId: 'l1',
        lessonVersion: 1,
        readBlocks: ['p3'],
        exercises: {
          e1: {
            hintLevel: 2,
            attempts: 5,
            viewedSolutionAt: 200,
            updatedAt: 200,
            last: { hash: 'h2', at: 200, passed: false, typesOk: false, rulesOk: true, testsOk: false },
          },
          e2: { ranAt: 150, hintLevel: 0, attempts: 0, updatedAt: 150 },
        },
        quiz: { q1: { selected: ['b'], correct: true, everCorrect: true, at: 120 } },
        playgrounds: {},
        updatedAt: 200,
      },
      l2: { lessonId: 'l2', lessonVersion: 2, readBlocks: [], exercises: {}, quiz: {}, playgrounds: {}, updatedAt: 10 },
    },
    drafts: {
      'l1::e1': { key: 'l1::e1', lessonId: 'l1', blockId: 'e1', files: { 'main.ts': 'b' }, baseHash: 'b', updatedAt: 95 },
    },
    meta: { lastLocation: { lessonId: 'l2', at: 300 } },
  };
}

const FORMAT = 'typescript-workshop-progress';
const wrap = (state: unknown, schemaVersion = 1) => JSON.stringify({ format: FORMAT, schemaVersion, exportedAt: 'x', state });

describe('mergeStates', () => {
  test('学习记录只增不减；会变化的数据取较新者', () => {
    const m = mergeStates(stateA(), stateB());
    const e1 = m.lessons.l1!.exercises.e1!;
    expect(e1.passedAt).toBe(100);
    expect(e1.viewedSolutionAt).toBe(200);
    expect(e1.hintLevel).toBe(2);
    expect(e1.last?.hash).toBe('h2');
    expect(m.lessons.l1!.readBlocks).toEqual(['p1', 'p2', 'p3']);
    expect(m.lessons.l1!.quiz.q1).toMatchObject({ selected: ['b'], everCorrect: true });
    expect(m.lessons.l1!.exercises.e2?.ranAt).toBe(150);
    expect(m.lessons.l2).toBeDefined();
    expect(m.drafts['l1::e1']!.files['main.ts']).toBe('b');
    expect(m.meta.lastLocation?.lessonId).toBe('l2');
  });

  test('满足交换律与幂等性', () => {
    const ab = mergeStates(stateA(), stateB());
    const ba = mergeStates(stateB(), stateA());
    expect(JSON.stringify(ab)).toBe(JSON.stringify(ba));
    expect(JSON.stringify(mergeStates(ab, ab))).toBe(JSON.stringify(ab));
    expect(JSON.stringify(mergeStates(ab, emptyState()))).toBe(JSON.stringify(mergeStates(emptyState(), ab)));
  });
});

describe('导入导出', () => {
  test('导出后再导入得到相同数据', () => {
    const text = serializeExport(stateA());
    const r = parseImport(text, text.length);
    expect(r.ok && r.state).toEqual(stateA());
  });

  const badLesson = { lessonId: 'zz', lessonVersion: 1, readBlocks: [], exercises: {}, quiz: {}, playgrounds: {}, updatedAt: 1 };
  const badDraft = { key: 'a::b', lessonId: 'a', blockId: 'b', files: { '../evil.ts': 'x' }, baseHash: 'h', updatedAt: 1 };
  test.each([
    ['不是 JSON', '{oops', '不是有效的 JSON'],
    ['别的文件', JSON.stringify({ hello: 1 }), '不是 TypeScript 工坊'],
    ['更新版本', wrap({}, 99), '更新版本'],
    ['结构错误', wrap({ lessons: { l1: { lessonId: 'l1' } }, drafts: {}, meta: {} }), '数据结构不符合要求'],
    ['键不一致', wrap({ lessons: { l1: badLesson }, drafts: {}, meta: {} }), '不一致'],
    ['非法文件名', wrap({ lessons: {}, drafts: { 'a::b': badDraft }, meta: {} }), '数据结构不符合要求'],
  ])('拒绝：%s', (_name, text, message) => {
    const r = parseImport(text, text.length);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain(message);
  });

  test('拒绝过大的文件', () => {
    expect(parseImport('{}', 6 * 1024 * 1024).ok).toBe(false);
  });
});
