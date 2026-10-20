import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

const container = document.getElementById('root');
if (!container) throw new Error('找不到 #root');
createRoot(container).render(
  <StrictMode>
    <p>TypeScript 工坊（开发中）</p>
  </StrictMode>,
);
