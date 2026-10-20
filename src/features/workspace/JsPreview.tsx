import { useEffect, useState } from 'react';
import { getCompiler } from '../../compiler/client.ts';
import type { RunMode } from '../../compiler/config.ts';

/** 显示 TypeScript 文件转译后的 JavaScript（与运行时使用的转译设置一致），用于观察类型擦除。 */
export function JsPreview({ mode, files }: { mode: RunMode; files: { path: string; content: string }[] }) {
  const [outputs, setOutputs] = useState<{ path: string; code: string }[]>([]);
  const [error, setError] = useState<string>();
  const sources = files.filter((f) => /\.(ts|tsx)$/.test(f.path));

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const results = await Promise.all(
          sources.map(async (f) => ({ path: f.path, code: (await getCompiler().call('emitJs', { mode, file: f.path, content: f.content })).code })),
        );
        if (!cancelled) {
          setOutputs(results);
          setError(undefined);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // 依据文件内容变化重新转译
  }, [mode, JSON.stringify(sources)]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="js-preview" aria-live="polite">
      <p className="muted small">下面是转译后的 JavaScript：类型注解、类型声明与 <code>import type</code> 都被删除了，这才是真正运行的代码。</p>
      {error && <div className="notice notice-error">{error}</div>}
      {outputs.map((o) => (
        <div key={o.path}>
          <div className="file-name">{o.path.replace(/\.tsx?$/, '.js')}</div>
          <pre className="code-static">{o.code.trimEnd() || '（这个文件只包含类型，转译后为空）'}</pre>
        </div>
      ))}
    </div>
  );
}
