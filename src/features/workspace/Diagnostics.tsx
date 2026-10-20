import type { DiagnosticInfo } from '../../compiler/core/types.ts';
import { explainDiagnostic } from '../../judge/explain.ts';
import { Icon } from '../../ui/Icon.tsx';

export function DiagnosticList(props: {
  diagnostics: DiagnosticInfo[];
  status: 'idle' | 'checking' | 'ready' | 'error';
  error?: string;
  /** 这些诊断是题目故意设计的 */
  expected?: { code: number; file: string; line: number }[];
  onJump?(file: string, line: number, column: number): void;
}) {
  const { diagnostics, status, error, expected = [], onJump } = props;
  const errors = diagnostics.filter((d) => d.category === 'error');
  const isExpected = (d: DiagnosticInfo) => expected.some((e) => e.code === d.code && e.file === d.file && e.line === d.line);
  if (status === 'idle') return <div className="diagnostics diagnostics-idle">类型检查会在示例出现在屏幕上时自动开始。</div>;
  if (status === 'error') return <div className="diagnostics diagnostics-error" role="alert">类型检查器出错：{error}</div>;
  return (
    <div className="diagnostics" aria-live="polite">
      <div className={`diagnostics-summary ${errors.length ? 'has-errors' : 'no-errors'}`}>
        <Icon name={errors.length ? 'cross' : 'check'} />
        {status === 'checking' && errors.length === 0 ? (
          <span>正在类型检查…</span>
        ) : errors.length === 0 ? (
          <span>类型检查通过：没有错误</span>
        ) : (
          <span>
            类型检查发现 {errors.length} 个错误
            {errors.every(isExpected) ? '（都是本示例故意演示的）' : ''}
          </span>
        )}
        <span className="diagnostics-engine">TypeScript 6.0.3 · strict</span>
      </div>
      {errors.length > 0 && (
        <ul className="diagnostic-items">
          {errors.map((d, i) => {
            const explain = explainDiagnostic(d.code);
            return (
              <li key={i} className={isExpected(d) ? 'expected' : ''}>
                <button type="button" className="diagnostic-loc" onClick={() => d.file && d.line && onJump?.(d.file, d.line, d.column ?? 1)}>
                  {d.file ?? '全局'}
                  {d.line ? `:${d.line}:${d.column}` : ''}
                </button>
                <code className="diagnostic-code">TS{d.code}</code>
                {isExpected(d) && <span className="badge badge-info">故意的</span>}
                <pre className="diagnostic-message">{d.message}</pre>
                {explain && <p className="diagnostic-explain">{explain}</p>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
