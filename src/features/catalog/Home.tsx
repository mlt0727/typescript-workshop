import { useEffect } from 'react';
import { Link } from 'react-router';
import { allLessons, catalog, exerciseCounts, findLesson, lessonState } from '../../content/catalog.ts';
import { useProgress } from '../../storage/store.ts';
import { Icon } from '../../ui/Icon.tsx';
import { useSyncStatus } from '../sync/useSync.ts';

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
  const continueTo = lastLesson && lastLesson.status !== 'planned' ? lastLesson : firstUnfinished;
  const completed = allLessons.filter((l) => l.status === 'published' && lessonState(l, progress[l.id]) === 'completed').length;

  return (
    <div className="home">
      <section className="continue-card" aria-labelledby="continue-title">
        <h1 id="continue-title">{lastLesson ? '继续学习' : '开始学习'}</h1>
        {continueTo ? (
          <>
            <p className="continue-lesson">{continueTo.title}</p>
            <Link className="btn btn-primary" to={`/learn/${continueTo.id}`}>
              {lastLesson ? '回到上次的位置' : '从这里开始'} <Icon name="chevronRight" />
            </Link>
          </>
        ) : (
          <p>目前还没有已发布的课程。</p>
        )}
        <p className="muted">
          已完成 {completed} / 已发布 {catalog.counts.published} 节（规划共 {catalog.counts.total} 节，其中 {catalog.counts.planned} 节规划中
          {catalog.counts.draft ? `、${catalog.counts.draft} 节草稿` : ''}）。
        </p>
        <p className="storage-note">
          <Icon name="info" /> 学习进度保存在本机浏览器中。
          {sync.enabled ? ` 已开启跨设备同步：${sync.label}` : ' 未开启跨设备同步，可在'}
          {!sync.enabled && <Link to="/settings">设置</Link>}
          {!sync.enabled && '中用同步密码开启。'}
        </p>
      </section>

      <section aria-labelledby="roadmap-title">
        <h2 id="roadmap-title">课程路线</h2>
        <p className="muted">从 TypeScript 基础一路到能部署的 React 网站，再到 Next.js 基础全栈。可以跳过熟悉的章节，直接进入任意已发布课程。</p>
        <ol className="roadmap">
          {catalog.stages.map((s) => {
            const pub = s.lessons.filter((l) => l.status !== 'planned');
            const publishedCount = s.lessons.filter((l) => l.status === 'published').length;
            const draftCount = pub.length - publishedCount;
            const done = pub.filter((l) => lessonState(l, progress[l.id]) === 'completed').length;
            return (
              <li key={s.id} className="roadmap-stage">
                <div className="roadmap-head">
                  <h3>
                    {s.id}. {s.title}
                  </h3>
                  <span className="muted">
                    已发布 {publishedCount}/{s.lessons.length}
                    {draftCount > 0 ? ` · 草稿 ${draftCount}` : ''}
                    {pub.length > 0 ? ` · 已完成 ${done}` : ''}
                  </span>
                </div>
                <p>{s.summary}</p>
                <div className="progress-bar" role="progressbar" aria-label={`${s.title} 发布进度`} aria-valuemin={0} aria-valuemax={s.lessons.length} aria-valuenow={publishedCount}>
                  <span style={{ width: `${(publishedCount / s.lessons.length) * 100}%` }} />
                </div>
                {pub.length > 0 && (
                  <ul className="roadmap-lessons">
                    {pub.map((l) => {
                      const st = lessonState(l, progress[l.id]);
                      const ex = exerciseCounts(l, progress[l.id]);
                      return (
                        <li key={l.id} className={`state-${st}`}>
                          <Link to={`/learn/${l.id}`}>{l.title}</Link>
                          {l.status === 'draft' && <span className="badge badge-warn">草稿</span>}
                          <span className="muted">
                            {st === 'completed' ? '已完成' : st === 'in-progress' ? '进行中' : '未开始'}
                            {ex.total > 0 ? ` · 练习 ${ex.passed}/${ex.total}` : ''}
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
