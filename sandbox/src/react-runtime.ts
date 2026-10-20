/**
 * React 模式的依赖（开发版构建：保留 key 缺失等有教学价值的警告）。
 * 以经典脚本加载。
 */
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as ReactDOMClient from 'react-dom/client';
import * as JsxRuntime from 'react/jsx-runtime';
import * as RTL from '@testing-library/react';

const g = globalThis as { __tsw_deps__?: Record<string, object>; __tsw_untracked__?: <T>(fn: () => T) => T };
g.__tsw_deps__ ??= {};

// React 第一次渲染时会在 document 上注册监听器（例如 selectionchange），它们要在测试之间保留（见 page.ts 的 untracked）
const untracked = <T,>(fn: () => T): T => (g.__tsw_untracked__ ? g.__tsw_untracked__(fn) : fn());
const render: typeof RTL.render = ((...args: Parameters<typeof RTL.render>) => untracked(() => RTL.render(...args))) as typeof RTL.render;
Object.assign(g.__tsw_deps__, {
  react: React,
  'react-dom': ReactDOM,
  'react-dom/client': ReactDOMClient,
  'react/jsx-runtime': JsxRuntime,
  '@testing-library/react': { ...RTL, render },
});
