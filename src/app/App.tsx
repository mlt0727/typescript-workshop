import { lazy, Suspense, useEffect, useState } from 'react';
import { BrowserRouter, Link, Route, Routes, useLocation } from 'react-router';
import { Sidebar } from '../features/catalog/Sidebar.tsx';
import { updateSettings, useSettings } from '../features/settings/settings.ts';
import { useSyncStatus } from '../features/sync/useSync.ts';
import { useProgress } from '../storage/store.ts';
import { Icon } from '../ui/Icon.tsx';
import Home from '../features/catalog/Home.tsx';

// 课页包含编辑器与编译器客户端：按需加载，首页不加载它们
const LessonPage = lazy(() => import('../features/lesson/LessonPage.tsx'));
const SettingsPage = lazy(() => import('../features/settings/SettingsPage.tsx'));

function StorageBanner() {
  const status = useProgress((s) => s.status);
  if (status.unavailable) return <div className="global-banner banner-error" role="alert">{status.unavailable}</div>;
  if (status.saveError) return <div className="global-banner banner-error" role="alert">{status.saveError}。最近的修改可能没有保存。</div>;
  return null;
}

function TopBar({ onToggleSidebar, sidebarOpen }: { onToggleSidebar: () => void; sidebarOpen: boolean }) {
  const sync = useSyncStatus();
  return (
    <header className="topbar">
      <button type="button" className="btn btn-ghost sidebar-toggle" onClick={onToggleSidebar} aria-expanded={sidebarOpen} aria-controls="sidebar">
        <Icon name="menu" /> <span className="sr-only">{sidebarOpen ? '收起目录' : '展开目录'}</span>
      </button>
      <Link to="/" className="brand">
        TypeScript 工坊
      </Link>
      <span className="topbar-spacer" />
      {sync.enabled && (
        <span className={`sync-pill phase-${sync.phase}`} title={sync.message ?? sync.label}>
          <Icon name="sync" /> {sync.label}
        </span>
      )}
      <Link to="/settings" className="btn btn-ghost">
        设置
      </Link>
    </header>
  );
}

function NotFound() {
  return (
    <div className="lesson">
      <h1>页面不存在</h1>
      <p>
        <Link to="/">返回课程路线</Link>
      </p>
    </div>
  );
}

function Shell() {
  const settings = useSettings();
  const location = useLocation();
  const [narrow, setNarrow] = useState(() => window.matchMedia('(max-width: 900px)').matches);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerPath, setDrawerPath] = useState(location.pathname);
  // 页面切换（包括浏览器前进/后退）时关闭抽屉：在渲染期间根据新路径调整状态
  if (drawerPath !== location.pathname) {
    setDrawerPath(location.pathname);
    setDrawerOpen(false);
  }

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 900px)');
    const onChange = () => setNarrow(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // 切换页面时回到顶部（课内锚点除外）
  useEffect(() => {
    if (!location.hash) window.scrollTo(0, 0);
  }, [location.pathname, location.hash]);

  const sidebarOpen = narrow ? drawerOpen : !settings.sidebarCollapsed;
  const toggle = () => (narrow ? setDrawerOpen((o) => !o) : updateSettings({ sidebarCollapsed: !settings.sidebarCollapsed }));

  return (
    <div className={`shell ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'} ${narrow ? 'narrow' : 'wide'}`}>
      <a href="#main" className="skip-link">
        跳到正文
      </a>
      <TopBar onToggleSidebar={toggle} sidebarOpen={sidebarOpen} />
      <StorageBanner />
      <div className="shell-body">
        {sidebarOpen && (
          <aside id="sidebar" className="sidebar-container">
            <Sidebar onNavigate={narrow ? () => setDrawerOpen(false) : undefined} />
          </aside>
        )}
        {narrow && drawerOpen && <button type="button" className="drawer-backdrop" aria-label="关闭目录" onClick={() => setDrawerOpen(false)} />}
        <main id="main" className="main" tabIndex={-1}>
          <Suspense fallback={<div className="loading" role="status">正在加载…</div>}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/learn/:lessonId" element={<LessonPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </main>
      </div>
    </div>
  );
}

export function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '') || undefined}>
      <Shell />
    </BrowserRouter>
  );
}
