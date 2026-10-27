import { useEffect, useRef } from 'react';
import type { DiagnosticInfo } from '../../compiler/core/types.ts';
import type { Exercise, Lesson } from '../../content/types.ts';
import type { LogEntry } from '../../shared/sandbox-protocol.ts';
import { Icon } from '../../ui/Icon.tsx';
import { aiDock, registerBlockContext, type BlockContext } from './aiDock.ts';
import { useAiStatus } from './aiClient.ts';

export function htmlToText(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return (doc.body.textContent ?? '').replace(/\n{3,}/g, '\n\n').trim();
}

/** 练习用题目；示例用它前面最近的一段讲解，加上示例自己的“观察”说明 */
function nearbyContext(lesson: Lesson, blockId: string, exercise?: Exercise): string {
  if (exercise) return htmlToText(exercise.promptHtml).slice(0, 6000);
  const idx = lesson.blocks.findIndex((b) => b.id === blockId);
  const block = lesson.blocks[idx];
  const observe = block?.kind === 'playground' && block.observeHtml ? `\n\n观察：${htmlToText(block.observeHtml)}` : '';
  for (let i = idx - 1; i >= 0; i--) {
    const b = lesson.blocks[i];
    if (b?.kind === 'prose') return (htmlToText(b.html).slice(-6000) + observe).slice(-8000);
  }
  return observe.trim();
}

export function blockLabel(files: Record<string, string>, exercise?: Exercise): string {
  return exercise ? `${exercise.kind === 'task' ? '小任务' : '编程挑战'}“${exercise.title}”` : `示例 · ${Object.keys(files).join('、')}`;
}

/** 把这个代码块附加到右侧的 AI 问答栏；发送时问答栏再读取当时的代码、错误与输出 */
export function AskAiButton(props: {
  lesson: Lesson;
  blockId: string;
  files: Record<string, string>;
  diagnostics: DiagnosticInfo[];
  logs: LogEntry[];
  exercise?: Exercise;
}) {
  const status = useAiStatus();
  const latest = useRef(props);
  useEffect(() => {
    latest.current = props;
  });

  const { lesson, blockId } = props;
  useEffect(
    () =>
      registerBlockContext(lesson.id, blockId, (): BlockContext => {
        const p = latest.current;
        return {
          title: p.exercise ? blockLabel(p.files, p.exercise) : '示例',
          mode: p.exercise?.mode ?? p.lesson.mode,
          context: nearbyContext(p.lesson, p.blockId, p.exercise),
          files: p.files,
          diagnostics: p.diagnostics
            .filter((d) => d.category === 'error')
            .slice(0, 20)
            .map((d) => `${d.file ?? ''}:${d.line ?? ''}:${d.column ?? ''} TS${d.code} ${d.message}`),
          output: p.logs.slice(-30).map((l) => `[${l.level}] ${l.text.slice(0, 1500)}`),
        };
      }),
    [lesson.id, blockId],
  );

  if (!status?.configured) return null;
  return (
    <button
      type="button"
      className="btn btn-ghost"
      onClick={() => aiDock.attach({ lessonId: lesson.id, blockId, label: blockLabel(props.files, props.exercise) })}
      title="把这段代码带到右侧的 AI 问答栏"
    >
      <Icon name="chat" /> 问 AI
    </button>
  );
}
