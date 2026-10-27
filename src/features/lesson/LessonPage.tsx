import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { findLesson, lessonState, loadLesson, stageOf } from '../../content/catalog.ts';
import type { Lesson, LessonBlock } from '../../content/types.ts';
import { progressStore, useProgress } from '../../storage/store.ts';
import { Icon } from '../../ui/Icon.tsx';
import { ExerciseCard } from './ExerciseCard.tsx';
import { Playground } from './Playground.tsx';
import { Quiz } from './Quiz.tsx';

const REVIEW_LABEL = {
  'ai-draft': { text: 'AI 起草 · 已通过自动验证，尚未经人工审核', cls: 'badge-warn' },
  'self-reviewed': { text: '已完成二次检查，尚未经人工审核', cls: 'badge-info' },
  reviewed: { text: '已人工审核', cls: 'badge-ok' },
} as const;

function useReadSentinel(onSeen: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const cb = useRef(onSeen);
  useEffect(() => {
    cb.current = onSeen;
  });
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        cb.current();
        io.disconnect();
      }
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return ref;
}

function ProseBlockView({ lesson, html, id }: { lesson: Lesson; html: string; id: string }) {
  const sentinel = useReadSentinel(() => progressStore.markBlockRead(lesson.id, lesson.version, id));
  return (
    <div className="prose-block" data-block={id}>
      <div className="prose" dangerouslySetInnerHTML={{ __html: html }} />
      <div ref={sentinel} className="read-sentinel" aria-hidden="true" />
    </div>
  );
}

/** 课末的标记：滚到这里记为“读到课末”。课文加载之后才挂载，IntersectionObserver 才有元素可观察 */
function EndSentinel({ lesson }: { lesson: Lesson }) {
  const ref = useReadSentinel(() => progressStore.markFinishedReading(lesson.id, lesson.version));
  return <div ref={ref} className="read-sentinel" aria-hidden="true" />;
}

function Block({ lesson, block }: { lesson: Lesson; block: LessonBlock }) {
  switch (block.kind) {
    case 'prose':
      return <ProseBlockView lesson={lesson} html={block.html} id={block.id} />;
    case 'playground':
      return <Playground lesson={lesson} block={block} />;
    case 'exercise': {
      const ex = lesson.exercises[block.id];
      return ex ? <ExerciseCard lesson={lesson} exercise={ex} /> : null;
    }
    case 'quiz':
      return <Quiz lesson={lesson} />;
  }
}

function Prerequisites({ lesson }: { lesson: Lesson }) {
  const progress = useProgress((s) => s.state.lessons);
  if (lesson.prerequisites.length === 0) return <p className="muted">先修：无（这是一门起点课）。</p>;
  const items = lesson.prerequisites.map((id) => {
    const meta = findLesson(id);
    const state = meta ? lessonState(meta, progress[id]) : 'not-started';
    return { id, meta, state };
  });
  const missing = items.filter((i) => i.state !== 'completed');
  return (
    <div className={`prereqs ${missing.length ? 'has-missing' : ''}`}>
      <span>先修：</span>
      <ul>
        {items.map(({ id, meta, state }) => (
          <li key={id}>
            {meta && meta.status !== 'planned' ? <Link to={`/learn/${id}`}>{meta.title}</Link> : <span>{meta?.title ?? id}</span>}
            {meta?.status === 'planned' && <span className="badge">尚未发布</span>}
            {state === 'completed' ? (
              <span className="badge badge-ok">
                <Icon name="check" /> 已完成
              </span>
            ) : (
              <span className="badge">未完成</span>
            )}
          </li>
        ))}
      </ul>
      {missing.length > 0 && (
        <p className="prereq-note">
          <Icon name="info" /> 你可以直接学习本课；如果遇到没见过的语法，建议先看上面未完成的课。
        </p>
      )}
    </div>
  );
}

function PlannedLesson({ id }: { id: string }) {
  const meta = findLesson(id);
  const stage = stageOf(id);
  if (!meta) return <NotFoundLesson />;
  return (
    <article className="lesson lesson-planned">
      <p className="breadcrumb">{stage ? `${stage.id}. ${stage.title}` : ''}</p>
      <h1>{meta.title}</h1>
      <div className="notice notice-info">
        <Icon name="clock" /> 这节课还在规划中，内容尚未编写或尚未通过发布验收，所以暂时不能学习。课程图谱如实显示规划中的课，它们不计入“已发布”数量。
      </div>
      <p>
        <Link to="/">返回课程路线</Link>
      </p>
    </article>
  );
}

function NotFoundLesson() {
  return (
    <article className="lesson">
      <h1>找不到这节课</h1>
      <p>
        链接可能有误。<Link to="/">返回课程路线</Link>
      </p>
    </article>
  );
}

export function LessonPage() {
  const { lessonId = '' } = useParams();
  const location = useLocation();
  const meta = findLesson(lessonId);
  // 记录加载结果属于哪一课；切换课时后旧结果自然失效，无需在 effect 中重置
  const [loaded, setLoaded] = useState<{ id: string; lesson: Lesson | null }>();
  const lesson = loaded?.id === lessonId ? loaded.lesson : undefined;

  useEffect(() => {
    let cancelled = false;
    if (!meta || meta.status === 'planned') return;
    loadLesson(lessonId).then(
      (l) => !cancelled && setLoaded({ id: lessonId, lesson: l ?? null }),
      () => !cancelled && setLoaded({ id: lessonId, lesson: null }),
    );
    return () => {
      cancelled = true;
    };
  }, [lessonId, meta]);

  useEffect(() => {
    if (lesson) {
      progressStore.setLastLocation(lesson.id);
      document.title = `${lesson.title} · TypeScript 工坊`;
    }
  }, [lesson]);

  // 支持 #block-id 定位
  useEffect(() => {
    if (!lesson || !location.hash) return;
    const id = decodeURIComponent(location.hash.slice(1));
    const el = document.querySelector(`[data-block="${CSS.escape(id)}"]`);
    el?.scrollIntoView({ block: 'start' });
  }, [lesson, location.hash]);

  if (!meta) return <NotFoundLesson />;
  if (meta.status === 'planned') return <PlannedLesson id={lessonId} />;
  if (lesson === undefined) return <div className="loading" role="status">正在加载课程…</div>;
  if (lesson === null) return <NotFoundLesson />;

  const review = REVIEW_LABEL[lesson.review];
  return (
    <article className="lesson" key={lesson.id}>
      <header className="lesson-header">
        <p className="breadcrumb">
          {lesson.stage}. {lesson.stageTitle}
        </p>
        <h1>{lesson.title}</h1>
        <div className="lesson-meta">
          <span className={`badge ${review.cls}`}>{review.text}</span>
          {lesson.status === 'draft' && <span className="badge badge-warn">草稿</span>}
          <span className="badge">
            <Icon name="clock" /> 约 {lesson.estimatedMinutes} 分钟
          </span>
        </div>
        {lesson.representative && (
          <div className="notice notice-info">
            <Icon name="info" /> 代表案例：这节课先于它的部分先修课编写，用来提前验证平台的运行模式。它本身完整可学，但不代表前面的课程已经齐全。
          </div>
        )}
        <section className="lesson-intro" aria-label="本课概要">
          <h2 className="sr-only">本课概要</h2>
          <p className="lesson-problem">
            <strong>解决的问题：</strong>
            {lesson.problem}
          </p>
          <div>
            <strong>学习目标：</strong>
            <ul className="objectives">
              {lesson.objectives.map((o) => (
                <li key={o}>{o}</li>
              ))}
            </ul>
          </div>
          <Prerequisites lesson={lesson} />
        </section>
      </header>

      {lesson.blocks.map((b) => (
        <Block key={`${lesson.id}:${b.kind}:${b.id}`} lesson={lesson} block={b} />
      ))}

      <section className="references" aria-labelledby="refs-title">
        <h2 id="refs-title">参考资料</h2>
        <ul>
          {lesson.references.map((r) => (
            <li key={r.url}>
              <a href={r.url} target="_blank" rel="noopener noreferrer">
                {r.title}
              </a>
              <span className="muted">（检查于 {r.checked}{r.note ? `；${r.note}` : ''}）</span>
            </li>
          ))}
        </ul>
      </section>
      <EndSentinel key={lesson.id} lesson={lesson} />

      <nav className="lesson-nav" aria-label="课程导航">
        {lesson.prev ? (
          <Link to={`/learn/${lesson.prev.id}`} className="lesson-nav-prev">
            <Icon name="chevronLeft" /> 上一课：{lesson.prev.title}
          </Link>
        ) : (
          <span />
        )}
        {lesson.next ? (
          <Link to={`/learn/${lesson.next.id}`} className="lesson-nav-next">
            下一课：{lesson.next.title} <Icon name="chevronRight" />
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </article>
  );
}

export default LessonPage;
