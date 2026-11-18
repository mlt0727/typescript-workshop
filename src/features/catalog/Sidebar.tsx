import { useEffect, useMemo, useRef, useState } from 'react';
import { matchPath, NavLink, useLocation } from 'react-router';
import { allLessons, catalog, lessonState, stageOf } from '../../content/catalog.ts';
import { useProgress } from '../../storage/store.ts';
import { Icon } from '../../ui/Icon.tsx';
import { jumpToOutlineItem, useLessonOutline } from '../lesson/outline.ts';

const STATE_ICON = { completed: 'check', 'in-progress': 'halfCircle', 'not-started': 'circle' } as const;
const STATE_TEXT = { completed: '已完成', 'in-progress': '进行中', 'not-started': '未开始' } as const;

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const [query, setQuery] = useState('');
  const progress = useProgress((s) => s.state.lessons);
  const last = useProgress((s) => s.state.meta.lastLocation);
  const location = useLocation();
  const outline = useLessonOutline();
  const navRef = useRef<HTMLElement>(null);
  const q = query.trim().toLowerCase();

  // 默认只展开“现在所在”的阶段：正在看的课；不在课页时，是上次学到的课，或者第一节没完成的课
  const currentId = matchPath('/learn/:lessonId', location.pathname)?.params.lessonId;
  const focusId =
    currentId ?? last?.lessonId ?? allLessons.find((l) => l.status !== 'planned' && lessonState(l, progress[l.id]) !== 'completed')?.id ?? allLessons[0]?.id;
  const focusStage = (focusId ? stageOf(focusId)?.id : undefined) ?? catalog.stages[0]?.id ?? '';
  // 学习者自己展开或收起过的阶段
  const [toggled, setToggled] = useState<Record<string, boolean>>({});
  const [seenStage, setSeenStage] = useState(focusStage);
  // 走到另一个阶段时展开它（即使之前收起过）：在渲染期间根据新的阶段调整状态
  if (seenStage !== focusStage) {
    setSeenStage(focusStage);
    setToggled((t) => ({ ...t, [focusStage]: true }));
  }

  const stages = useMemo(
    () =>
      catalog.stages.map((s) => ({
        ...s,
        all: s.lessons,
        lessons: s.lessons.filter((l) => !q || l.title.toLowerCase().includes(q) || l.id.includes(q)),
      })),
    [q],
  );

  // 换课之后，把目录滚到当前这一课
  useEffect(() => {
    navRef.current?.querySelector('a.active')?.scrollIntoView({ block: 'nearest' });
  }, [location.pathname, focusStage]);

  const available = allLessons.filter((l) => l.status !== 'planned');
  const completed = available.filter((l) => lessonState(l, progress[l.id]) === 'completed').length;
  const unpublished = catalog.counts.total - catalog.counts.published;

  return (
    <nav className="sidebar" aria-label="课程目录" ref={navRef}>
      <div className="sidebar-search">
        <label htmlFor="toc-search" className="sr-only">
          搜索课程
        </label>
        <Icon name="search" />
        <input id="toc-search" type="search" placeholder="搜索课时…" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <p className="sidebar-counts">
        已完成 {completed} / {catalog.counts.published} 节
        {unpublished > 0 && `（另有 ${unpublished} 节尚未发布）`}
      </p>
      {stages.map((s) => {
        if (q && s.lessons.length === 0) return null;
        // 按整个阶段计算（搜索时也一样）
        const done = s.all.filter((l) => l.status !== 'planned' && lessonState(l, progress[l.id]) === 'completed').length;
        const stageDone = done === s.all.length;
        const open = q ? true : (toggled[s.id] ?? s.id === focusStage);
        return (
          <section key={s.id} className={`toc-stage ${stageDone ? 'stage-completed' : ''}`}>
            <button type="button" className="toc-stage-toggle" aria-expanded={open} onClick={() => setToggled((t) => ({ ...t, [s.id]: !open }))}>
              <Icon name="chevronRight" />
              <span className="toc-stage-title">
                {s.id}. {s.title}
              </span>
              <span className="toc-stage-count" title={`已完成 ${done} 节，共 ${s.all.length} 节`}>
                {stageDone && <Icon name="check" />}
                {done}/{s.all.length}
                <span className="sr-only">{stageDone ? '（本阶段已全部完成）' : `（已完成 ${done} 节，共 ${s.all.length} 节）`}</span>
              </span>
            </button>
            {open && (
              <ul className="toc-lessons">
                {s.lessons.map((l) => {
                  if (l.status === 'planned') {
                    return (
                      <li key={l.id} className="toc-lesson planned">
                        <NavLink to={`/learn/${l.id}`} onClick={onNavigate} title="规划中，尚不可学习">
                          <Icon name="lock" />
                          <span className="toc-lesson-title">{l.title}</span>
                          <span className="sr-only">（规划中）</span>
                        </NavLink>
                      </li>
                    );
                  }
                  const st = lessonState(l, progress[l.id]);
                  return (
                    <li key={l.id} className={`toc-lesson state-${st}`}>
                      <NavLink to={`/learn/${l.id}`} onClick={onNavigate}>
                        <Icon name={STATE_ICON[st]} />
                        <span className="toc-lesson-title">{l.title}</span>
                        <span className="sr-only">（{STATE_TEXT[st]}）</span>
                        {l.status === 'draft' && <span className="badge badge-warn">草稿</span>}
                      </NavLink>
                      {/* 正在学的这一课：列出各小节和练习，点击跳过去 */}
                      {outline?.lessonId === l.id && l.id === currentId && outline.items.length > 0 && (
                        <ul className="toc-outline" aria-label="这一课的提纲">
                          {outline.items.map((item) => (
                            <li key={item.key} className={`outline-${item.kind === 'section' ? 'section' : 'step'} ${item.done ? 'done' : ''}`}>
                              <button
                                type="button"
                                onClick={() => {
                                  onNavigate?.();
                                  jumpToOutlineItem(item);
                                }}
                              >
                                {item.kind !== 'section' && <Icon name={item.done ? 'check' : 'circle'} size={12} />}
                                <span>{item.label}</span>
                                {item.kind !== 'section' && <span className="sr-only">{item.done ? '，已完成' : '，未完成'}</span>}
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </nav>
  );
}
