import { useId, useState } from 'react';
import type { DiagnosticInfo } from '../../compiler/core/types.ts';
import { CodeEditor, type EditorLanguageService } from '../../editor/CodeEditor.tsx';

export interface WorkspaceFile {
  path: string;
  content: string;
  readOnly?: boolean;
}

/** 文件标签 + 编辑器。诊断按文件分发，标签上显示错误数量。 */
export function Workspace(props: {
  files: WorkspaceFile[];
  diagnostics: DiagnosticInfo[];
  onChange(path: string, content: string): void;
  service?: EditorLanguageService;
  onRun?(): void;
  onSubmit?(): void;
  label: string;
  jump?: { file: string; line: number; column: number; nonce: number };
}) {
  const { files, diagnostics, onChange, service, onRun, onSubmit, label, jump } = props;
  const [active, setActive] = useState(files[0]?.path ?? '');
  const [handledJump, setHandledJump] = useState(0);
  const tabsId = useId();
  // 跳转请求指向其他文件时先切换标签（在渲染期间根据新的 nonce 调整状态）
  if (jump && jump.nonce !== handledJump) {
    setHandledJump(jump.nonce);
    if (files.some((f) => f.path === jump.file) && jump.file !== active) setActive(jump.file);
  }
  const current = files.find((f) => f.path === active) ?? files[0];

  if (!current) return null;
  const errorsIn = (path: string) => diagnostics.filter((d) => d.file === path && d.category === 'error').length;

  return (
    <div className="workspace">
      {files.length > 1 && (
        <div className="file-tabs" role="tablist" aria-label={`${label}的文件`}>
          {files.map((f) => {
            const n = errorsIn(f.path);
            return (
              <button
                key={f.path}
                type="button"
                role="tab"
                id={`${tabsId}-${f.path}`}
                aria-selected={f.path === current.path}
                className={`file-tab ${f.path === current.path ? 'active' : ''}`}
                onClick={() => setActive(f.path)}
              >
                {f.path}
                {f.readOnly && <span className="file-tab-note">只读</span>}
                {n > 0 && <span className="file-tab-errors" aria-label={`${n} 个错误`}>{n}</span>}
              </button>
            );
          })}
        </div>
      )}
      {files.length === 1 && <div className="file-name">{current.path}</div>}
      <div className="editor-host" role={files.length > 1 ? 'tabpanel' : undefined} aria-labelledby={files.length > 1 ? `${tabsId}-${current.path}` : undefined}>
        <CodeEditor
          path={current.path}
          value={current.content}
          readOnly={current.readOnly}
          diagnostics={diagnostics.filter((d) => d.file === current.path)}
          onChange={(v) => onChange(current.path, v)}
          service={service}
          onRun={onRun}
          onSubmit={onSubmit}
          ariaLabel={label}
          jumpTo={jump && jump.file === current.path ? jump : undefined}
        />
      </div>
    </div>
  );
}

/** 让外部（诊断列表、错误位置）可以切换到指定文件并跳转 */
export function useJump() {
  const [jump, setJump] = useState<{ file: string; line: number; column: number; nonce: number } | undefined>();
  return {
    jump,
    jumpTo: (file: string, line: number, column: number) => setJump((j) => ({ file, line, column, nonce: (j?.nonce ?? 0) + 1 })),
  };
}
