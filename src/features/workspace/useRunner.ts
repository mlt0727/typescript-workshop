import { useCallback, useEffect, useRef, useState } from 'react';
import { getCompiler } from '../../compiler/client.ts';
import type { CompilerOverrides, RunMode } from '../../compiler/config.ts';
import { pageInput, runEntries } from '../../judge/judge.ts';
import { startRun, type RunHandle } from '../../runner/runner.ts';
import type { FetchFixture, LogEntry, RunStatus, SerializedError } from '../../shared/sandbox-protocol.ts';

export interface RunState {
  status: RunStatus | 'idle' | 'compiling';
  logs: LogEntry[];
  error?: SerializedError;
  note?: string;
  simulated: string[];
  /** 运行时对应的文件快照（用于提示“代码已修改，输出来自上次运行”） */
  ranFiles?: Record<string, string>;
  startedAt?: number;
}

const INITIAL: RunState = { status: 'idle', logs: [], simulated: [] };

/**
 * 运行控制：编译 → 交给沙箱运行；新运行开始前停止旧运行；组件卸载（切课）时清理。
 * DOM/React 模式的预览 iframe 放在 previewRef 指向的容器中。
 */
export function useRunner(opts: {
  projectId: string;
  mode: RunMode;
  overrides?: CompilerOverrides;
  entry: string;
  timeoutMs: number;
  fixtures?: FetchFixture[];
}) {
  const [state, setState] = useState<RunState>(INITIAL);
  const handleRef = useRef<(RunHandle & { frame?: unknown }) | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const runSeq = useRef(0);
  const optsRef = useRef(opts);
  useEffect(() => {
    optsRef.current = opts;
  });

  const stop = useCallback(() => {
    handleRef.current?.stop();
  }, []);

  const run = useCallback(async (files: Record<string, string>) => {
    const o = optsRef.current;
    handleRef.current?.stop();
    handleRef.current = null;
    const seq = ++runSeq.current;
    setState({ status: 'compiling', logs: [], simulated: [], ranFiles: files, startedAt: Date.now() });
    let bundle;
    try {
      const built = await getCompiler().call('buildRun', {
        projectId: o.projectId,
        spec: { mode: o.mode, overrides: o.overrides, files },
        entries: runEntries(o.mode, files, o.entry),
        loopGuard: o.mode !== 'ts',
      });
      bundle = built.bundle;
    } catch (err) {
      if (seq !== runSeq.current) return;
      setState((s) => ({ ...s, status: 'error', error: { name: 'CompileError', message: err instanceof Error ? err.message : String(err) } }));
      return;
    }
    if (seq !== runSeq.current) return;
    const container = previewRef.current;
    if (o.mode !== 'ts' && container) container.replaceChildren();
    setState((s) => ({ ...s, status: 'running' }));
    handleRef.current = startRun(
      {
        mode: o.mode,
        bundle,
        timeoutMs: o.timeoutMs,
        fixtures: o.fixtures,
        page: o.mode === 'ts' ? undefined : pageInput(files),
        container: container ?? undefined,
      },
      {
        onLogs: (entries) => {
          if (seq !== runSeq.current) return;
          setState((s) => ({ ...s, logs: [...s.logs, ...entries] }));
        },
        onStatus: (u) => {
          if (seq !== runSeq.current) return;
          setState((s) => ({
            ...s,
            status: u.status,
            error: u.error ?? s.error,
            note: u.note ?? s.note,
            simulated: u.simulated ? [...new Set([...s.simulated, ...u.simulated])] : s.simulated,
          }));
        },
      },
    );
  }, []);

  const clear = useCallback(() => {
    handleRef.current?.stop();
    handleRef.current = null;
    runSeq.current++;
    previewRef.current?.replaceChildren();
    setState(INITIAL);
  }, []);

  // 卸载（切换课时）时停止运行并移除沙箱
  useEffect(
    () => () => {
      runSeq.current++;
      handleRef.current?.stop();
    },
    [],
  );

  return { state, run, stop, clear, previewRef };
}
