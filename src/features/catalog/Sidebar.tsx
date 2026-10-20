import { useMemo, useState } from 'react';
import { NavLink } from 'react-router';
import { catalog, lessonState } from '../../content/catalog.ts';
import { useProgress } from '../../storage/store.ts';
import { Icon } from '../../ui/Icon.tsx';

const STATE_ICON = { completed: 'check', 'in-progress': 'dot', 'not-started': 'circle' } as const;
const STATE_TEXT = { completed: '已完成', 'in-progress': '进行中', 'not-started': '未开始' } as const;

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const [query, setQuery] = useState('');
  const progress = useProgress((s) => s.state.lessons);
  const [openStages, setOpenStages] = useState<Record<string, boolean>>({});
  const q = query.trim().toLowerCase();

  const stages = useMemo(
    () =>
      catalog.stages.map((s) => ({
        ...s,
        lessons: s.lessons.filter((l) => !q || l.title.toLowerCase().includes(q) || l.id.includes(q)),
      })),
    [q],
  );

  return (
    <nav className="sidebar" aria-label="课程目录">
      <div className="sidebar-search">
        <label htmlFor="toc-search" className="sr-only">
          搜索课程
        </label>
        <Icon name="search" />
        <input id="toc-search" type="search" placeholder="搜索课时…" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <p className="sidebar-counts">
        已发布 {catalog.counts.published} · 规划 {catalog.counts.total} 节
      </p>
      {stages.map((s) => {
        if (q && s.lessons.length === 0) return null;
        const published = s.lessons.filter((l) => l.status === 'published').length;
        const available = s.lessons.filter((l) => l.status !== 'planned').length;
        const open = q ? true : (openStages[s.id] ?? available > 0);
        return (
          <section key={s.id} className="toc-stage">
            <button type="button" className="toc-stage-toggle" aria-expanded={open} onClick={() => setOpenStages((o) => ({ ...o, [s.id]: !open }))}>
              <Icon name={open ? 'chevronRight' : 'chevronRight'} />
              <span className="toc-stage-title">
                {s.id}. {s.title}
              </span>
              <span className="toc-stage-count" title={`已发布 ${published}，共 ${s.lessons.length} 节`}>
                {published}/{s.lessons.length}
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
