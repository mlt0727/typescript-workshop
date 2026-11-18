import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { findLesson, lessonState, loadLesson, stageOf } from '../../content/catalog.ts';
import type { Lesson, LessonBlock } from '../../content/types.ts';
import { progressStore, useProgress } from '../../storage/store.ts';
import { Icon } from '../../ui/Icon.tsx';
import { ExerciseCard } from './ExerciseCard.tsx';
import { Playground } from './Playground.tsx';
import { Quiz } from './Quiz.tsx';
import { lessonOutline, outlineStore } from './outline.ts';
import { FINISH_BLOCK, jumpToBlock, lessonSteps, type LessonStep } from './steps.ts';

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

/** 把这一课的提纲（小节、练习、测验）发布给目录 */
function OutlinePublisher({ lesson, steps }: { lesson: Lesson; steps: LessonStep[] }) {
  const done = steps.map((s) => `${s.done}:${s.detail ?? ''}`).join('|');
  // eslint-disable-next-line react-hooks/exhaustive-deps -- steps 每次渲染都是新数组，用 done 表示它的内容
  const items = useMemo(() => lessonOutline(lesson, steps), [lesson, done]);
  useEffect(() => {
    outlineStore.publish(lesson.id, items);
  }, [lesson.id, items]);
  useEffect(() => () => outlineStore.clear(lesson.id), [lesson.id]);
  return null;
}

/** 课页顶部：这一课要完成哪几项，点击跳到那里 */
function StepList({ steps }: { steps: LessonStep[] }) {
  if (steps.length === 0) return null;
  return (
    <div className="lesson-steps">
      <strong>本课要完成：</strong>
      <ol>
        {steps.map((s) => (
          <li key={s.id} className={s.done ? 'done' : ''}>
            <button type="button" className="step-link" onClick={() => jumpToBlock(s.id)}>
              <Icon name={s.done ? 'check' : 'circle'} />
              <span>
                {s.label}
                {s.detail && <span className="step-detail">（{s.detail}）</span>}
              </span>
              <span className="sr-only">{s.done ? '，已完成' : '，未完成'}</span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** 课末小结：还差什么、下一课去哪里 */
function LessonFinish({ lesson, steps }: { lesson: Lesson; steps: LessonStep[] }) {
  const progress = useProgress((s) => s.state.lessons);
  const remaining = steps.filter((s) => !s.done);
  const complete = remaining.length === 0;
  const stage = stageOf(lesson.id);
  const nextStage = lesson.next ? stageOf(lesson.next.id) : undefined;
  const entersNewStage = nextStage !== undefined && nextStage.id !== stage?.id;
  const stageDone = stage !== undefined && stage.lessons.every((l) => l.status === 'planned' || lessonState(l, progress[l.id]) === 'completed');
  return (
    <section className={`lesson-finish ${complete ? 'complete' : ''}`} aria-labelledby="finish-title" data-block={FINISH_BLOCK} tabIndex={-1}>
      <h2 id="finish-title">
        {complete && <Icon name="check" size={20} />}
        {complete ? '这一课完成了' : '这一课还差'}
      </h2>
      {complete ? (
        <p>
          练习全部通过，测验全部答对，目录中已经打勾。
          {stageDone && stage && ` “${stage.id}. ${stage.title}”阶段的 ${stage.lessons.length} 节课全部完成。`}
        </p>
      ) : (
        <ul className="finish-remaining">
          {remaining.map((s) => (
            <li key={s.id}>
              <button type="button" className="step-link" onClick={() => jumpToBlock(s.id)}>
                <Icon name="circle" />
                <span>
                  {s.label}
                  {s.detail && <span className="step-detail">（{s.detail}）</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {lesson.next ? (
        <>
          <Link to={`/learn/${lesson.next.id}`} className={`btn btn-large ${complete ? 'btn-primary' : ''}`}>
            <span>
              {entersNewStage && nextStage ? `进入 ${nextStage.id} 阶段：` : '下一课：'}
              {lesson.next.title}
            </span>
            <Icon name="chevronRight" />
          </Link>
          {!complete && <p className="muted small">也可以先去下一课，之后再回来：目录会记着这一课还没有完成。</p>}
        </>
      ) : (
        <p className="muted">这是课程的最后一课。</p>
      )}
    </section>
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
  const navigate = useNavigate();
  const meta = findLesson(lessonId);
  const progress = useProgress((s) => s.state.lessons[lessonId]);
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
  const steps = lessonSteps(lesson, progress);
  // 这一课在所在阶段中的位置：“第 3 / 20 节”
  const stageLessons = stageOf(lesson.id)?.lessons.filter((l) => l.status !== 'planned') ?? [];
  const indexInStage = stageLessons.findIndex((l) => l.id === lesson.id);
  // 课文中引用其他课时的链接（构建时生成的 a.lesson-ref）：在应用内跳转，不重新加载页面
  const openLessonRef = (e: React.MouseEvent<HTMLElement>) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const id = (e.target instanceof Element ? e.target.closest('a.lesson-ref') : null)?.getAttribute('data-lesson');
    if (!id || !findLesson(id)) return;
    e.preventDefault();
    void navigate(`/learn/${id}`);
  };
  return (
    <article className="lesson" key={lesson.id} onClick={openLessonRef}>
      <OutlinePublisher lesson={lesson} steps={steps} />
      <header className="lesson-header">
        <p className="breadcrumb">
          {lesson.stage}. {lesson.stageTitle}
          {indexInStage >= 0 && ` · 第 ${indexInStage + 1} / ${stageLessons.length} 节`}
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
          <StepList steps={steps} />
        </section>
      </header>

      {lesson.blocks.map((b) => (
        <Block key={`${lesson.id}:${b.kind}:${b.id}`} lesson={lesson} block={b} />
      ))}

      <LessonFinish lesson={lesson} steps={steps} />

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
