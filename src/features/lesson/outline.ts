/**
 * 正在学的这一课的提纲：各小节的标题和练习、测验，按课文中的顺序。
 * 课页把它发布到这里，目录在当前课时下面显示，点击跳到对应的位置。
 */
import { useSyncExternalStore } from 'react';
import type { Lesson } from '../../content/types.ts';
import { jumpToBlock, type LessonStep } from './steps.ts';

export interface OutlineItem {
  key: string;
  kind: 'section' | LessonStep['kind'];
  label: string;
  /** 练习和测验是否已经完成 */
  done?: boolean;
  /** 所在的块；小节还要加上它是块里的第几个标题 */
  blockId: string;
  headingIndex?: number;
}

/** 这些标题下面紧跟着的就是同名的练习或测验，提纲里不重复列出 */
const STRUCTURAL = new Set(['编程挑战', '小任务', '小测验', '练习']);

export function lessonOutline(lesson: Lesson, steps: readonly LessonStep[]): OutlineItem[] {
  const items: OutlineItem[] = [];
  const stepById = new Map(steps.map((s) => [s.id, s]));
  for (const block of lesson.blocks) {
    if (block.kind === 'prose') {
      const headings = new DOMParser().parseFromString(block.html, 'text/html').querySelectorAll('h2');
      headings.forEach((h, headingIndex) => {
        const label = (h.textContent ?? '').trim();
        if (label && !STRUCTURAL.has(label)) items.push({ key: `${block.id}:${headingIndex}`, kind: 'section', label, blockId: block.id, headingIndex });
      });
    } else if (block.kind === 'exercise' || block.kind === 'quiz') {
      const step = stepById.get(block.kind === 'quiz' ? 'quiz' : block.id);
      if (step) items.push({ key: step.id, kind: step.kind, label: step.detail ? `${step.label}（${step.detail}）` : step.label, done: step.done, blockId: step.id });
    }
  }
  return items;
}

export function jumpToOutlineItem(item: OutlineItem): void {
  if (item.kind !== 'section') {
    jumpToBlock(item.blockId);
    return;
  }
  const heading = document.querySelector(`[data-block="${CSS.escape(item.blockId)}"]`)?.querySelectorAll('h2')[item.headingIndex ?? 0];
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  heading?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
}

interface Outline {
  lessonId: string;
  items: OutlineItem[];
}

let current: Outline | null = null;
let signature = '';
const listeners = new Set<() => void>();

export const outlineStore = {
  /** 课页渲染之后发布；内容没有变化时不通知 */
  publish(lessonId: string, items: OutlineItem[]) {
    const next = JSON.stringify([lessonId, items]);
    if (next === signature) return;
    signature = next;
    current = { lessonId, items };
    for (const l of listeners) l();
  },
  /** 离开课页时清除（只清除自己发布的） */
  clear(lessonId: string) {
    if (current?.lessonId !== lessonId) return;
    current = null;
    signature = '';
    for (const l of listeners) l();
  },
};

export function useLessonOutline(): Outline | null {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => current,
  );
}

