import { useEffect, useMemo, useRef, useState } from 'react';
import { getCompiler } from '../../compiler/client.ts';
import type { CompilerOverrides, RunMode } from '../../compiler/config.ts';
import type { DiagnosticInfo, ProjectSpec } from '../../compiler/core/types.ts';
import type { EditorLanguageService } from '../../editor/CodeEditor.tsx';

export interface ProjectState {
  status: 'idle' | 'checking' | 'ready' | 'error';
  diagnostics: DiagnosticInfo[];
  suggestions: DiagnosticInfo[];
  error?: string;
  /** 本次诊断对应的文件内容（用于判断诊断是否已过期） */
  checkedFiles?: Record<string, string>;
}

/**
 * 实时类型检查：文件变化 350ms 后请求诊断；旧请求的结果被丢弃。
 * enabled 为 false 时不启动编译器（示例滚动到可见区域后才开始检查）。
 */
export function useProject(opts: {
  projectId: string;
  mode: RunMode;
  overrides?: CompilerOverrides;
  files: Record<string, string>;
  withTests: boolean;
  enabled: boolean;
}) {
  const { projectId, mode, overrides, files, withTests, enabled } = opts;
  const [state, setState] = useState<ProjectState>({ status: 'idle', diagnostics: [], suggestions: [] });
  const specRef = useRef<ProjectSpec>({ mode, overrides, files, withTests });
  const requestRef = useRef(0);

  useEffect(() => {
    specRef.current = { mode, overrides, files, withTests };
  }, [mode, overrides, files, withTests]);

  useEffect(() => {
    if (!enabled) return;
    const id = ++requestRef.current;
    const timer = window.setTimeout(async () => {
      setState((s) => ({ ...s, status: 'checking' }));
      const spec: ProjectSpec = { mode, overrides, files, withTests };
      try {
        const r = await getCompiler().call('diagnostics', { projectId, spec });
        if (id !== requestRef.current) return;
        setState({ status: 'ready', diagnostics: r.diagnostics, suggestions: r.suggestions, checkedFiles: files });
      } catch (err) {
        if (id !== requestRef.current) return;
        setState((s) => ({ ...s, status: 'error', error: err instanceof Error ? err.message : String(err) }));
      }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [projectId, mode, overrides, files, withTests, enabled]);

  const service = useMemo<EditorLanguageService>(
    () => ({
      async completions(file, position) {
        try {
          return await getCompiler().call('completions', { projectId, spec: specRef.current, file, position });
        } catch {
          return [];
        }
      },
      async quickInfo(file, position) {
        try {
          return await getCompiler().call('quickInfo', { projectId, spec: specRef.current, file, position });
        } catch {
          return null;
        }
      },
    }),
    [projectId],
  );

  return { ...state, service, getSpec: () => specRef.current };
}

/** 元素进入（或接近）视口后返回 true，之后保持 true。 */
export function useSeen<T extends Element>(rootMargin = '300px') {
  const ref = useRef<T>(null);
  // 没有 IntersectionObserver 的环境（例如部分测试环境）直接视为可见
  const [seen, setSeen] = useState(() => typeof IntersectionObserver === 'undefined');
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true);
          io.disconnect();
        }
      },
      { rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [seen, rootMargin]);
  return { ref, seen };
}
