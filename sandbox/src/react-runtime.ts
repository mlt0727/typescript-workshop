/**
 * React 模式的依赖（开发版构建：保留 key 缺失等有教学价值的警告）。
 * 以经典脚本加载。
 */
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as ReactDOMClient from 'react-dom/client';
import * as JsxRuntime from 'react/jsx-runtime';
import * as RTL from '@testing-library/react';

const g = globalThis as { __tsw_deps__?: Record<string, object> };
g.__tsw_deps__ ??= {};
Object.assign(g.__tsw_deps__, {
  react: React,
  'react-dom': ReactDOM,
  'react-dom/client': ReactDOMClient,
  'react/jsx-runtime': JsxRuntime,
  '@testing-library/react': RTL,
});
