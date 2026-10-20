import { getCompiler } from '../compiler/client.ts';
import { judge, pageInput, type JudgeFiles, type JudgeSpec } from '../judge/judge.ts';
import { startRun, type RunOptions } from '../runner/runner.ts';
import type { LogEntry, RunStatus, SerializedError } from '../shared/sandbox-protocol.ts';
import type { ProjectSpec } from '../compiler/core/types.ts';

export interface RunCodeResult {
  status: RunStatus;
  logs: LogEntry[];
  error?: SerializedError;
  note?: string;
  simulated?: string[];
}

/** 在验证页上暴露给 Playwright 的接口。 */
const api = {
  async diagnostics(projectId: string, spec: ProjectSpec) {
    return getCompiler().call('diagnostics', { projectId, spec });
  },
  async judge(spec: JudgeSpec, files: JudgeFiles) {
    return judge(spec, files);
  },
  /** 运行代码直到结束（或 stopAfterMs 后停止），返回日志与状态 */
  async run(
    params: { projectId: string; spec: ProjectSpec; entry: string; timeoutMs: number; stopAfterMs?: number; fixtures?: RunOptions['fixtures'] },
  ): Promise<RunCodeResult> {
    const { bundle } = await getCompiler().call('buildRun', {
      projectId: params.projectId,
      spec: params.spec,
      entries: [params.entry],
      loopGuard: params.spec.mode !== 'ts',
    });
    const container = document.createElement('div');
    document.body.append(container);
    const logs: LogEntry[] = [];
    let last: Omit<RunCodeResult, 'logs'> = { status: 'running' };
    return new Promise((resolve) => {
      const handle = startRun(
        {
          mode: params.spec.mode,
          bundle,
          timeoutMs: params.timeoutMs,
          fixtures: params.fixtures,
          page: params.spec.mode === 'ts' ? undefined : pageInput(params.spec.files),
          container,
        },
        {
          onLogs: (e) => logs.push(...e),
          onStatus: (u) => {
            last = { status: u.status, error: u.error ?? last.error, note: u.note ?? last.note, simulated: u.simulated ?? last.simulated };
            if (u.status !== 'running' && (params.spec.mode === 'ts' || u.status !== 'done')) resolve({ ...last, logs });
            if (params.spec.mode !== 'ts' && u.status === 'done' && params.stopAfterMs === undefined) {
              setTimeout(() => resolve({ ...last, logs }), 50);
            }
          },
        },
      );
      if (params.stopAfterMs !== undefined) setTimeout(() => handle.stop(), params.stopAfterMs);
    });
  },
};

declare global {
  interface Window {
    __tsw_verify: typeof api;
    __tsw_verify_ready: boolean;
  }
}

window.__tsw_verify = api;
window.__tsw_verify_ready = true;
