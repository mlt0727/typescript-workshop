/**
 * 课页右侧的 AI 问答栏。宽屏时停靠在正文右边，中间的分隔线可以拖动调整宽度；窄屏时是从右侧滑出的抽屉。
 * 每节课一个对话（conversation.ts）。没有附加代码块时，问题带上本课的课文；
 * 附加了代码块时，每次发送都读取那个代码块当时的代码、讲解、类型错误与运行输出。
 */
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { loadLesson } from '../../content/catalog.ts';
import type { Lesson } from '../../content/types.ts';
import { Icon } from '../../ui/Icon.tsx';
import { syncManager } from '../sync/syncManager.ts';
import { askAi, useAiStatus, type AskPayload } from './aiClient.ts';
import { aiDock, DOCK_DEFAULT_WIDTH, readBlockContext, useAiDock } from './aiDock.ts';
import { htmlToText } from './AskAiButton.tsx';
import { loadConversation, saveConversation, type Turn } from './conversation.ts';
import { SafeMarkdown } from './SafeMarkdown.tsx';

/** 正文至少留这么宽 */
const MIN_MAIN_WIDTH = 480;
const WIDTH_STEP = 32;

function lessonText(lesson: Lesson): string {
  return lesson.blocks
    .flatMap((b) => (b.kind === 'prose' ? [htmlToText(b.html)] : []))
    .join('\n\n')
    .slice(0, 12_000);
}

function clampWidth(width: number) {
  return Math.min(width, Math.max(300, window.innerWidth - MIN_MAIN_WIDTH));
}

function Splitter({ width }: { width: number }) {
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const el = e.currentTarget;
    const startX = e.clientX;
    el.setPointerCapture(e.pointerId);
    // 拖过预览 iframe 时事件会被 iframe 吃掉：拖动期间让 iframe 不接收指针事件
    document.body.classList.add('resizing-dock');
    const move = (ev: PointerEvent) => aiDock.setWidth(clampWidth(width + (startX - ev.clientX)));
    const end = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', end);
      el.removeEventListener('pointercancel', end);
      document.body.classList.remove('resizing-dock');
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  };
  return (
    <div
      className="ai-splitter"
      role="separator"
      aria-orientation="vertical"
      aria-label="拖动调整 AI 问答栏的宽度（左右方向键也可以调整，双击恢复默认宽度）"
      aria-valuenow={width}
      aria-valuemin={300}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onDoubleClick={() => aiDock.setWidth(DOCK_DEFAULT_WIDTH)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') aiDock.setWidth(clampWidth(width + WIDTH_STEP));
        else if (e.key === 'ArrowRight') aiDock.setWidth(clampWidth(width - WIDTH_STEP));
        else return;
        e.preventDefault();
      }}
    />
  );
}

export default function AiDock({ lessonId, overlay }: { lessonId: string; overlay: boolean }) {
  const status = useAiStatus();
  const dock = useAiDock();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [turns, setTurns] = useState<Turn[]>(() => loadConversation(lessonId));
  const [question, setQuestion] = useState('');
  const [pending, setPending] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const abortRef = useRef<AbortController | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const initialFocusRequest = useRef(dock.focusRequest);

  useEffect(() => {
    let alive = true;
    void loadLesson(lessonId).then((l) => alive && setLesson(l ?? null));
    return () => {
      alive = false;
      abortRef.current?.abort();
    };
  }, [lessonId]);

  // 示例或练习点了“问 AI”：把焦点移到输入框
  useEffect(() => {
    if (dock.focusRequest !== initialFocusRequest.current) inputRef.current?.focus();
  }, [dock.focusRequest]);

  // 新内容出现时滚到底部
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns, pending, busy]);

  if (!status?.configured) return null;

  const models = status.models;
  const model = models.some((m) => m.id === dock.model) ? (dock.model ?? '') : (status.model ?? models[0]?.id ?? '');
  const modelLabel = (id: string | undefined) => models.find((m) => m.id === id)?.label ?? id ?? '';
  const attachment = dock.attachment?.lessonId === lessonId ? dock.attachment : null;
  const hasPassword = Boolean(syncManager.password);

  const send = async () => {
    const q = question.trim();
    if (!q || busy || !lesson) return;
    const block = attachment ? readBlockContext(lessonId, attachment.blockId) : undefined;
    const history = turns.slice(-8).map((t) => ({ role: t.role, content: t.content.slice(0, 12_000) }));
    const asked: Turn[] = [...turns, { role: 'user', content: q, ...(block && attachment ? { attachment: attachment.label } : {}) }];
    setTurns(asked);
    saveConversation(lessonId, asked);
    setQuestion('');
    setBusy(true);
    setError(undefined);
    setPending('');
    const controller = new AbortController();
    abortRef.current = controller;
    let partial = '';
    const where: Pick<AskPayload, 'blockTitle' | 'context' | 'mode' | 'files' | 'diagnostics' | 'output'> = block
      ? { blockTitle: block.title, context: block.context, mode: block.mode, files: block.files, diagnostics: block.diagnostics, output: block.output }
      : { context: lessonText(lesson), mode: lesson.mode, files: {}, diagnostics: [], output: [] };
    try {
      const answer = await askAi(
        { lessonId, lessonTitle: lesson.title, ...where, question: q, history, model },
        (chunk) => {
          partial += chunk;
          setPending(partial);
        },
        controller.signal,
      );
      const answered: Turn[] = [...asked, { role: 'assistant', content: answer, model }];
      setTurns(answered);
      saveConversation(lessonId, answered);
    } catch (err) {
      if (controller.signal.aborted) {
        // 自己停止的：保留已经收到的部分
        if (partial) {
          const stopped: Turn[] = [...asked, { role: 'assistant', content: `${partial}\n\n（已停止）`, model }];
          setTurns(stopped);
          saveConversation(lessonId, stopped);
        }
      } else {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setPending('');
      setBusy(false);
    }
  };

  const close = () => (overlay ? aiDock.setDrawer(false) : aiDock.setOpen(false));

  const panel = (
    <aside
      className={`ai-dock ${overlay ? 'ai-dock-overlay' : ''}`}
      aria-label="AI 问答"
      style={overlay ? undefined : { width: clampWidth(dock.width) }}
      onKeyDown={(e) => {
        if (overlay && e.key === 'Escape') close();
      }}
    >
      <div className="ai-dock-head">
        <h2>
          <Icon name="chat" /> 问 AI
        </h2>
        <label className="sr-only" htmlFor="ai-model">
          模型
        </label>
        <select id="ai-model" value={model} onChange={(e) => aiDock.setModel(e.target.value)} disabled={busy}>
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
              {m.description ? `（${m.description}）` : ''}
            </option>
          ))}
        </select>
        <span className="ai-dock-spacer" />
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => {
            setTurns([]);
            setError(undefined);
            saveConversation(lessonId, []);
          }}
          disabled={busy || turns.length === 0}
        >
          新对话
        </button>
        <button type="button" className="btn btn-ghost" onClick={close} aria-label="收起 AI 问答栏">
          <Icon name="cross" />
        </button>
      </div>
      {!hasPassword && (
        <div className="notice notice-warn">
          需要先在 <Link to="/settings">设置</Link> 中输入同步密码（问 AI 与跨设备同步使用同一个密码）。
        </div>
      )}
      <div className="ai-turns" ref={listRef} aria-live="polite">
        {turns.length === 0 && !busy && (
          <p className="muted small">
            可以直接问这一课的问题。在示例或练习上点“问 AI”，会把那段代码带过来，之后每次发送都带上它当时的代码、类型错误和运行输出。AI 可能出错，请对照课程与官方文档核实。
          </p>
        )}
        {turns.map((t, i) =>
          t.role === 'user' ? (
            <div key={i} className="ai-turn ai-user">
              {t.attachment && <div className="ai-turn-attachment">附：{t.attachment}</div>}
              {t.content}
            </div>
          ) : (
            <div key={i} className="ai-turn ai-assistant">
              <SafeMarkdown text={t.content} />
              {t.model && <div className="ai-turn-model">{modelLabel(t.model)}</div>}
            </div>
          ),
        )}
        {busy && (
          <div className="ai-turn ai-assistant">
            {pending ? <SafeMarkdown text={pending} /> : <span className="muted">正在思考…（{modelLabel(model)}）</span>}
          </div>
        )}
        {error && (
          <div className="notice notice-error" role="alert">
            {error}
          </div>
        )}
      </div>
      {attachment && (
        <div className="ai-attachment">
          <span>
            已附加：<strong>{attachment.label}</strong>
            <span className="muted small">（发送时带上当时的代码、错误与输出）</span>
          </span>
          <button type="button" className="btn btn-ghost" onClick={aiDock.detach} aria-label="移除附加的代码块">
            <Icon name="cross" />
          </button>
        </div>
      )}
      <form
        className="ai-form"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <label htmlFor="ai-question" className="sr-only">
          你的问题
        </label>
        <textarea
          id="ai-question"
          ref={inputRef}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            // Enter 发送，Shift+Enter 换行；输入法选字时的 Enter 不发送
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder={attachment ? '例如：为什么这里会报 TS2322？我的思路哪里不对？' : '问这一课的问题，Enter 发送，Shift+Enter 换行'}
          rows={3}
          disabled={!hasPassword}
        />
        <div className="ai-form-actions">
          {busy && (
            <button type="button" className="btn" onClick={() => abortRef.current?.abort()}>
              停止
            </button>
          )}
          <button type="submit" className="btn btn-primary" disabled={busy || !question.trim() || !hasPassword || !lesson}>
            发送
          </button>
        </div>
      </form>
    </aside>
  );

  if (overlay) {
    if (dock.drawerPath !== window.location.pathname) return null;
    return (
      <>
        <button type="button" className="drawer-backdrop ai-backdrop" aria-label="关闭 AI 问答栏" onClick={close} />
        {panel}
      </>
    );
  }
  if (!dock.open) return null;
  return (
    <>
      <Splitter width={clampWidth(dock.width)} />
      {panel}
    </>
  );
}
