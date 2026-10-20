import { useState } from 'react';
import { explainDiagnostic } from '../../judge/explain.ts';
import type { JudgeResult } from '../../judge/judge.ts';
import { Icon } from '../../ui/Icon.tsx';

const RULE_LABEL: Record<string, string> = {
  any: '禁止 any',
  'type-assertion': '禁止类型断言',
  'non-null-assertion': '禁止非空断言',
  'ts-directive': '禁止 @ts-ignore 等指令',
  var: '禁止 var',
};

function Section(props: { ok: boolean; title: string; skipped?: boolean; children?: React.ReactNode }) {
  return (
    <div className={`result-section ${props.skipped ? 'skipped' : props.ok ? 'ok' : 'fail'}`}>
      <h4>
        <Icon name={props.skipped ? 'dot' : props.ok ? 'check' : 'cross'} />
        {props.title}：{props.skipped ? '本题不需要' : props.ok ? '通过' : '未通过'}
      </h4>
      {props.children}
    </div>
  );
}

export function ResultPanel(props: {
  result: JudgeResult;
  stale: boolean;
  onJump(file: string, line: number, column: number): void;
}) {
  const { result, stale, onJump } = props;
  const [showLogs, setShowLogs] = useState(false);
  const failedTests = result.tests.results.filter((t) => t.status === 'fail');
  return (
    <div className={`result ${result.passed ? 'passed' : 'failed'}`} role="status" aria-live="polite">
      <div className="result-head">
        <Icon name={result.passed ? 'check' : 'cross'} size={20} />
        <strong>{result.passed ? '通过全部检查' : '还没有通过'}</strong>
        <span className="result-time">提交于 {new Date(result.at).toLocaleTimeString('zh-CN')}</span>
      </div>
      {stale && (
        <div className="notice notice-info">
          <Icon name="info" /> 你在提交后修改了代码：以下结果对应提交时的那份代码，已经过期。再次提交才会检查当前代码。
        </div>
      )}
      {result.internalError && <div className="notice notice-error">平台错误（不是你的代码问题）：{result.internalError}</div>}

      <Section ok={result.types.ok} title="类型检查">
        {result.types.student.length > 0 && (
          <ul className="result-list">
            {result.types.student.map((d, i) => (
              <li key={i}>
                <button type="button" className="link-button" onClick={() => d.file && onJump(d.file, d.line ?? 1, d.column ?? 1)}>
                  {d.file}:{d.line}:{d.column}
                </button>{' '}
                <code>TS{d.code}</code>
                <pre>{d.message}</pre>
                {explainDiagnostic(d.code) && <p className="diagnostic-explain">{explainDiagnostic(d.code)}</p>}
              </li>
            ))}
          </ul>
        )}
        {result.types.tests.length > 0 && (
          <>
            <p>验收测试文件里出现了类型错误：通常说明你的函数签名或类型与题目要求不一致（例如类型过宽，本应报错的写法被接受了）。</p>
            <ul className="result-list">
              {result.types.tests.map((d, i) => (
                <li key={i}>
                  <span className="mono">{d.file}:{d.line}</span> <code>TS{d.code}</code>
                  <pre>{d.message}</pre>
                  {explainDiagnostic(d.code) && <p className="diagnostic-explain">{explainDiagnostic(d.code)}</p>}
                </li>
              ))}
            </ul>
          </>
        )}
        {result.types.missingExpected.length > 0 && (
          <p>
            题目要求出现的类型错误没有出现：
            {result.types.missingExpected.map((e) => `TS${e.code}（${e.file} 第 ${e.line} 行）`).join('、')}
          </p>
        )}
      </Section>

      <Section ok={result.rules.ok} title="代码规则">
        {result.rules.violations.length > 0 && (
          <ul className="result-list">
            {result.rules.violations.map((v, i) => (
              <li key={i}>
                <button type="button" className="link-button" onClick={() => onJump(v.file, v.line, v.column)}>
                  {v.file}:{v.line}:{v.column}
                </button>{' '}
                <strong>{RULE_LABEL[v.rule] ?? v.rule}</strong>
                <p>{v.message}</p>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section ok={result.tests.ok} skipped={!result.tests.required} title="行为测试">
        {result.tests.required && (
          <>
            {result.tests.error && (
              <div className="notice notice-error">
                {result.tests.error.name}: {result.tests.error.message}
              </div>
            )}
            <p className="result-count">
              {result.tests.results.filter((t) => t.status === 'pass').length} / {result.tests.results.length} 个测试通过
              {failedTests.length > 0 && `，${failedTests.length} 个失败`}
            </p>
            <ul className="test-list">
              {result.tests.results.map((t, i) => (
                <li key={i} className={`test test-${t.status}`}>
                  <Icon name={t.status === 'pass' ? 'check' : t.status === 'fail' ? 'cross' : 'dot'} />
                  <span className="sr-only">{t.status === 'pass' ? '通过' : t.status === 'fail' ? '失败' : '跳过'}：</span>
                  <span className="test-name">{t.name}</span>
                  {t.error && (
                    <div className="test-error">
                      <pre>{t.error.message}</pre>
                      {(t.error.expected !== undefined || t.error.actual !== undefined) && (
                        <dl className="expected-actual">
                          {t.error.expected !== undefined && (
                            <>
                              <dt>期望</dt>
                              <dd><pre>{t.error.expected}</pre></dd>
                            </>
                          )}
                          {t.error.actual !== undefined && (
                            <>
                              <dt>实际</dt>
                              <dd><pre>{t.error.actual}</pre></dd>
                            </>
                          )}
                        </dl>
                      )}
                      {t.error.location && (
                        <button type="button" className="link-button" onClick={() => onJump(t.error!.location!.file, t.error!.location!.line, t.error!.location!.column)}>
                          位置：{t.error.location.file}:{t.error.location.line}
                        </button>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
            {result.tests.logs.length > 0 && (
              <div>
                <button type="button" className="link-button" onClick={() => setShowLogs((s) => !s)} aria-expanded={showLogs}>
                  {showLogs ? '隐藏' : '显示'}测试期间的控制台输出（{result.tests.logs.length} 条）
                </button>
                {showLogs && (
                  <ol className="console-lines">
                    {result.tests.logs.map((l, i) => (
                      <li key={i} className={`log log-${l.level}`}>
                        <pre>{l.text}</pre>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            )}
          </>
        )}
      </Section>
    </div>
  );
}
