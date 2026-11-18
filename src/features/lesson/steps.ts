/** 一节课里要完成的内容（练习与测验），按在课文中出现的顺序。课页顶部的清单、课末的小结和“继续”按钮都用它。 */
import type { Lesson } from '../../content/types.ts';
import type { LessonProgress } from '../../storage/schema.ts';

export interface LessonStep {
  /** 课文中对应的块（data-block） */
  id: string;
  kind: 'task' | 'challenge' | 'quiz';
  /** 例如“小任务：修好小票上的类型错误”“小测验” */
  label: string;
  /** 例如测验的“2/3 题” */
  detail?: string;
  done: boolean;
}

/** 课末小结的块 id */
export const FINISH_BLOCK = 'finish';

export function lessonSteps(lesson: Lesson, progress: LessonProgress | undefined): LessonStep[] {
  const steps: LessonStep[] = [];
  for (const block of lesson.blocks) {
    if (block.kind === 'exercise') {
      const ex = lesson.exercises[block.id];
      if (!ex) continue;
      steps.push({
        id: ex.id,
        kind: ex.kind,
        label: `${ex.kind === 'task' ? '小任务' : '编程挑战'}：${ex.title}`,
        done: progress?.exercises[ex.id]?.passedAt !== undefined,
      });
    } else if (block.kind === 'quiz' && lesson.quiz.length > 0) {
      const correct = lesson.quiz.filter((q) => progress?.quiz[q.id]?.everCorrect).length;
      steps.push({ id: 'quiz', kind: 'quiz', label: '小测验', detail: `${correct}/${lesson.quiz.length} 题`, done: correct === lesson.quiz.length });
    }
  }
  return steps;
}

/** 某个块之后的下一步：下一个练习或测验；没有了就是课末的小结 */
export function stepAfter(lesson: Lesson, blockId: string): { id: string; label: string } {
  const index = lesson.blocks.findIndex((b) => b.id === blockId && b.kind !== 'prose');
  for (const block of lesson.blocks.slice(index + 1)) {
    if (block.kind === 'exercise') {
      const ex = lesson.exercises[block.id];
      if (ex) return { id: ex.id, label: `${ex.kind === 'task' ? '小任务' : '编程挑战'}“${ex.title}”` };
    }
    if (block.kind === 'quiz' && lesson.quiz.length > 0) return { id: 'quiz', label: '小测验' };
  }
  return { id: FINISH_BLOCK, label: '本课小结' };
}

/** 滚动到课文中的一个块，并把焦点移过去（键盘和读屏用户接着从那里往下） */
export function jumpToBlock(id: string): void {
  const el = document.querySelector<HTMLElement>(`[data-block="${CSS.escape(id)}"]`);
  if (!el) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  if (el.tabIndex >= -1 && el.hasAttribute('tabindex')) el.focus({ preventScroll: true });
}
