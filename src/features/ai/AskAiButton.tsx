import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import type { DiagnosticInfo } from '../../compiler/core/types.ts';
import type { Exercise, Lesson } from '../../content/types.ts';
import type { LogEntry } from '../../shared/sandbox-protocol.ts';
import { Icon } from '../../ui/Icon.tsx';
import { syncManager } from '../sync/syncManager.ts';
import { askAi, getAiStatus, type AiStatus } from './aiClient.ts';
import { SafeMarkdown } from './SafeMarkdown.tsx';

function htmlToText(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return (doc.body.textContent ?? '').replace(/\n{3,}/g, '\n\n').trim();
}

/** 取当前代码块之前最近的一段讲解作为上下文 */
function nearbyContext(lesson: Lesson, blockId: string, exercise?: Exercise): string {
  if (exercise) return htmlToText(exercise.promptHtml).slice(0, 6000);
  const idx = lesson.blocks.findIndex((b) => b.id === blockId);
  for (let i = idx - 1; i >= 0; i--) {
    const b = lesson.blocks[i];
    if (b?.kind === 'prose') return htmlToText(b.html).slice(-6000);
  }
  return '';
}

interface Turn {
  role: 'user' | 'assistant';
  content: string;
}

export function AskAiButton(props: {
  lesson: Lesson;
  blockId: string;
  files: Record<string, string>;
  diagnostics: DiagnosticInfo[];
  logs: LogEntry[];
  exercise?: Exercise;
}) {
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [pending, setPending] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let alive = true;
    void getAiStatus().then((s) => alive && setStatus(s));
    return () => {
      alive = false;
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  if (!status?.configured) return null;

  const send = async () => {
    const q = question.trim();
    if (!q || busy) return;
    setBusy(true);
    setError(undefined);
    setPending('');
    const controller = new AbortController();
    abortRef.current = controller;
    const history = turns.slice(-8);
    setTurns((t) => [...t, { role: 'user', content: q }]);
    setQuestion('');
    try {
      const errors = props.diagnostics
        .filter((d) => d.category === 'error')
        .slice(0, 20)
        .map((d) => `${d.file ?? ''}:${d.line ?? ''}:${d.column ?? ''} TS${d.code} ${d.message}`);
      const answer = await askAi(
        {
          lessonId: props.lesson.id,
          lessonTitle: props.lesson.title,
          blockTitle: props.exercise ? `${props.exercise.kind === 'task' ? '小任务' : '编程挑战'}：${props.exercise.title}` : '示例',
          context: nearbyContext(props.lesson, props.blockId, props.exercise),
          mode: props.exercise?.mode ?? props.lesson.mode,
          files: props.files,
          diagnostics: errors,
          output: props.logs.slice(-30).map((l) => `[${l.level}] ${l.text.slice(0, 1500)}`),
          question: q,
          history,
        },
        (chunk) => setPending((p) => p + chunk),
        controller.signal,
      );
      setTurns((t) => [...t, { role: 'assistant', content: answer }]);
      setPending('');
    } catch (err) {
      if (!controller.signal.aborted) setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const hasPassword = Boolean(syncManager.password);

  return (
    <>
      <button type="button" className="btn btn-ghost" onClick={() => setOpen(true)}>
        <Icon name="chat" /> 问 AI
      </button>
      <dialog ref={dialogRef} className="ai-dialog" onClose={() => setOpen(false)} aria-labelledby={`ai-${props.blockId}-title`}>
        <div className="ai-dialog-head">
          <h2 id={`ai-${props.blockId}-title`}>问 AI · {props.lesson.title}</h2>
          <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)} aria-label="关闭">
            <Icon name="cross" />
          </button>
        </div>
        <p className="muted small">
          会发送：本段讲解、当前代码（{Object.keys(props.files).join('、')}）、类型错误与运行输出。由 {status.model} 回答，可能出错，请对照课程与官方文档核实。
        </p>
        {!hasPassword && (
          <div className="notice notice-warn">
            需要先在 <Link to="/settings">设置</Link> 中输入同步密码（问 AI 与跨设备同步使用同一个密码）。
          </div>
        )}
        <div className="ai-turns" aria-live="polite">
          {turns.map((t, i) =>
            t.role === 'user' ? (
              <div key={i} className="ai-turn ai-user">
                <strong>你：</strong>
                {t.content}
              </div>
            ) : (
              <div key={i} className="ai-turn ai-assistant">
                <SafeMarkdown text={t.content} />
              </div>
            ),
          )}
          {busy && (
            <div className="ai-turn ai-assistant">
              {pending ? <SafeMarkdown text={pending} /> : <span className="muted">正在思考…</span>}
            </div>
          )}
          {error && <div className="notice notice-error">{error}</div>}
        </div>
        <form
          className="ai-form"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <label htmlFor={`ai-${props.blockId}-q`} className="sr-only">
            你的问题
          </label>
          <textarea
            id={`ai-${props.blockId}-q`}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="例如：为什么这里会报 TS2322？我的思路哪里不对？"
            rows={3}
            disabled={!hasPassword}
          />
          <div className="ai-form-actions">
            {busy && (
              <button type="button" className="btn" onClick={() => abortRef.current?.abort()}>
                停止
              </button>
            )}
            <button type="submit" className="btn btn-primary" disabled={busy || !question.trim() || !hasPassword}>
              发送
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
