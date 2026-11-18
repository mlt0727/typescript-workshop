import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { allLessons, catalog, exerciseCounts, findLesson, lessonState, stageOf } from '../../content/catalog.ts';
import { useProgress } from '../../storage/store.ts';
import { Icon } from '../../ui/Icon.tsx';
import { useSyncStatus } from '../sync/useSync.ts';

const STATE_ICON = { completed: 'check', 'in-progress': 'halfCircle', 'not-started': 'circle' } as const;
const STATE_TEXT = { completed: '已完成', 'in-progress': '进行中', 'not-started': '未开始' } as const;

function hours(minutes: number): string {
  return minutes < 90 ? `约 ${minutes} 分钟` : `约 ${Math.round(minutes / 60)} 小时`;
}

export function Home() {
  const progress = useProgress((s) => s.state.lessons);
  const last = useProgress((s) => s.state.meta.lastLocation);
  const sync = useSyncStatus();
  useEffect(() => {
    document.title = 'TypeScript 工坊 · 课程路线';
  }, []);

  const available = allLessons.filter((l) => l.status !== 'planned');
  const lastLesson = last ? findLesson(last.lessonId) : undefined;
  const firstUnfinished = available.find((l) => lessonState(l, progress[l.id]) !== 'completed');
  // 上次的那一课已经做完时，接着去第一节没完成的课
  const resume = lastLesson && lastLesson.status !== 'planned' && lessonState(lastLesson, progress[lastLesson.id]) !== 'completed' ? lastLesson : undefined;
  const continueTo = resume ?? firstUnfinished ?? (lastLesson && lastLesson.status !== 'planned' ? lastLesson : undefined);
  const continueStage = continueTo ? stageOf(continueTo.id) : undefined;
  const completed = available.filter((l) => lessonState(l, progress[l.id]) === 'completed').length;
  const started = lastLesson !== undefined || Object.keys(progress).length > 0;
  const allDone = available.length > 0 && completed === available.length;
  const unpublished = catalog.counts.total - catalog.counts.published;

  // 路线中默认只展开正在学的阶段
  const [toggled, setToggled] = useState<Record<string, boolean>>({});

  return (
    <div className="home">
      <section className="continue-card" aria-labelledby="continue-title">
        <h1 id="continue-title">{allDone ? '全部完成' : started ? '继续学习' : '开始学习'}</h1>
        {continueTo ? (
          <>
            <p className="continue-lesson">
              {continueStage && <span className="continue-stage">{continueStage.id}. {continueStage.title}</span>}
              {continueTo.title}
            </p>
            <Link className="btn btn-primary btn-large" to={`/learn/${continueTo.id}`}>
              {allDone ? '回到上次的位置' : resume ? '回到上次的位置' : started ? '学下一节' : '从这里开始'} <Icon name="chevronRight" />
            </Link>
          </>
        ) : (
          <p>目前还没有已发布的课程。</p>
        )}
        <div className="overall-progress">
          <div className="progress-bar" role="progressbar" aria-label="全部课程的完成进度" aria-valuemin={0} aria-valuemax={available.length} aria-valuenow={completed}>
            <span style={{ width: `${available.length ? (completed / available.length) * 100 : 0}%` }} />
          </div>
          <p className="muted">
            已完成 {completed} / {catalog.counts.published} 节
            {unpublished > 0 && `（另有 ${unpublished} 节尚未发布：${catalog.counts.planned} 节规划中${catalog.counts.draft ? `、${catalog.counts.draft} 节草稿` : ''}）`}
          </p>
        </div>
        <p className="storage-note">
          <Icon name="info" /> 学习进度保存在本机浏览器中。
          {sync.enabled ? ` 已开启跨设备同步：${sync.label}` : ' 未开启跨设备同步，可在'}
          {!sync.enabled && <Link to="/settings">设置</Link>}
          {!sync.enabled && '中用同步密码开启。'}
        </p>
      </section>

      <section className="how-it-works" aria-labelledby="how-title">
        <h2 id="how-title">每节课怎么学</h2>
        <ol>
          <li>
            <strong>读讲解，运行示例。</strong>示例里的代码可以直接改，点“运行”看结果。
          </li>
          <li>
            <strong>做小任务和编程挑战。</strong>写完点“提交检查”，类型检查和测试都通过才算过；卡住了有提示和参考答案。
          </li>
          <li>
            <strong>做小测验。</strong>练习全部通过、测验全部答对，这一课就在目录中打勾，课末有去下一课的按钮。
          </li>
        </ol>
      </section>

      <section aria-labelledby="roadmap-title">
        <h2 id="roadmap-title">课程路线</h2>
        <p className="muted">
          从 TypeScript 基础一路到能部署的 React 网站，再到 Next.js 基础全栈。按从上到下的顺序学（字母是章节的编号，C 排在 E 之后是因为它用到 E 的内容）；也可以跳过熟悉的章节，直接进入任意一课。
        </p>
        <ol className="roadmap">
          {catalog.stages.map((s) => {
            const lessons = s.lessons.filter((l) => l.status !== 'planned');
            const done = lessons.filter((l) => lessonState(l, progress[l.id]) === 'completed').length;
            const hidden = s.lessons.length - lessons.length;
            const minutes = lessons.reduce((sum, l) => sum + (l.estimatedMinutes ?? 0), 0);
            const open = toggled[s.id] ?? s.id === continueStage?.id;
            const stageDone = lessons.length > 0 && done === lessons.length;
            return (
              <li key={s.id} className={`roadmap-stage ${stageDone ? 'stage-completed' : ''}`}>
                <button type="button" className="roadmap-toggle" aria-expanded={open} onClick={() => setToggled((t) => ({ ...t, [s.id]: !open }))}>
                  <Icon name="chevronRight" />
                  <span className="roadmap-title">
                    {s.id}. {s.title}
                  </span>
                  <span className="roadmap-count">
                    {stageDone && <Icon name="check" />}
                    已完成 {done}/{lessons.length}
                    {minutes > 0 && ` · ${hours(minutes)}`}
                    {hidden > 0 && ` · ${hidden} 节尚未发布`}
                  </span>
                </button>
                <p className="roadmap-summary">{s.summary}</p>
                <div className="progress-bar" role="progressbar" aria-label={`${s.title} 的完成进度`} aria-valuemin={0} aria-valuemax={lessons.length} aria-valuenow={done}>
                  <span style={{ width: `${lessons.length ? (done / lessons.length) * 100 : 0}%` }} />
                </div>
                {open && lessons.length > 0 && (
                  <ul className="roadmap-lessons">
                    {lessons.map((l) => {
                      const st = lessonState(l, progress[l.id]);
                      const ex = exerciseCounts(l, progress[l.id]);
                      return (
                        <li key={l.id} className={`state-${st}`}>
                          <Icon name={STATE_ICON[st]} />
                          <Link to={`/learn/${l.id}`}>{l.title}</Link>
                          {l.status === 'draft' && <span className="badge badge-warn">草稿</span>}
                          <span className="muted">
                            {STATE_TEXT[st]}
                            {ex.total > 0 && st !== 'completed' ? ` · 练习 ${ex.passed}/${ex.total}` : ''}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}

export default Home;
