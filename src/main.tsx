import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App.tsx';
import { applySettingsToDocument } from './features/settings/settings.ts';
import { syncManager } from './features/sync/syncManager.ts';
import { activeRunCount } from './runner/runner.ts';
import { progressStore } from './storage/store.ts';
import './styles/tokens.css';
import './styles/base.css';
import './styles/layout.css';
import './styles/lesson.css';
import './styles/workspace.css';

applySettingsToDocument();

// 供自动化测试读取的只读调试信息（不包含任何学习数据）
(window as unknown as { __tsw_debug: unknown }).__tsw_debug = { activeRunCount };

const container = document.getElementById('root');
if (!container) throw new Error('找不到 #root 元素');

// 先加载本地进度，再渲染（避免草稿在加载前被起始代码覆盖）
void progressStore.load().then(() => {
  syncManager.start();
  window.addEventListener('pagehide', () => progressStore.flushDrafts());
  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
