import type { RefObject } from 'react';
import type { RunMode } from '../../compiler/config.ts';
import { Icon } from '../../ui/Icon.tsx';
import type { RunState } from './useRunner.ts';

const STATUS_TEXT: Record<RunState['status'], string> = {
  idle: '尚未运行',
  compiling: '正在编译…',
  running: '运行中…',
  done: '运行结束',
  error: '运行出错',
  timeout: '运行超时，已终止',
  stopped: '已停止',
};

const SIMULATED_TEXT: Record<string, string> = {
  fetch: '网络请求（fetch）由平台模拟',
  localStorage: 'localStorage 由内存模拟',
  sessionStorage: 'sessionStorage 由内存模拟',
  alert: 'alert/confirm/prompt 只输出到控制台',
};

export function OutputPanel(props: {
  mode: RunMode;
  state: RunState;
  stale: boolean;
  previewRef: RefObject<HTMLDivElement | null>;
  onJump?(line: number, column: number, file: string): void;
}) {
  const { mode, state, stale, previewRef, onJump } = props;
  const busy = state.status === 'running' || state.status === 'compiling';
  const isPage = mode !== 'ts';
  const icon = state.status === 'done' ? 'check' : state.status === 'error' || state.status === 'timeout' ? 'cross' : state.status === 'stopped' ? 'stop' : busy ? 'clock' : 'dot';
  return (
    <div className="output">
      {isPage && (
        <div className="preview">
          <div className="preview-label">网页预览</div>
          <div className="preview-frame" ref={previewRef}>
            {state.status === 'idle' && <p className="preview-empty">点击“运行”后在这里显示页面。</p>}
          </div>
        </div>
      )}
      <div className="console" role="log" aria-live="polite" aria-label="运行输出">
        <div className={`console-status status-${state.status}`}>
          <Icon name={icon} />
          <span>{STATUS_TEXT[state.status]}</span>
          {state.note && <span className="console-note">{state.note}</span>}
          {stale && state.status !== 'idle' && <span className="stale-badge">代码已修改，输出来自上一次运行</span>}
        </div>
        {state.simulated.length > 0 && (
          <div className="simulated" role="note">
            <Icon name="info" /> 模拟环境：{state.simulated.map((s) => SIMULATED_TEXT[s] ?? s).join('；')}
          </div>
        )}
        {state.logs.length === 0 && !busy && state.status !== 'idle' && !state.error && <div className="console-empty">（没有输出）</div>}
        <ol className="console-lines">
          {state.logs.map((l, i) => (
            <li key={i} className={`log log-${l.level}`}>
              {l.level === 'error' && <span className="sr-only">错误：</span>}
              {l.level === 'warn' && <span className="sr-only">警告：</span>}
              <pre>{l.text}</pre>
            </li>
          ))}
        </ol>
        {state.error?.location && (
          <button type="button" className="link-button" onClick={() => onJump?.(state.error!.location!.line, state.error!.location!.column, state.error!.location!.file)}>
            跳到出错位置 {state.error.location.file}:{state.error.location.line}:{state.error.location.column}
          </button>
        )}
        {state.status === 'error' && state.error && !state.logs.some((l) => l.level === 'error') && (
          <pre className="log log-error">{`${state.error.name}: ${state.error.message}`}</pre>
        )}
      </div>
    </div>
  );
}
