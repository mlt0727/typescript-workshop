import { useEffect, useMemo, useState } from 'react';
import type { Lesson, PlaygroundBlock } from '../../content/types.ts';
import { progressStore } from '../../storage/store.ts';
import { Icon } from '../../ui/Icon.tsx';
import { DiagnosticList } from '../workspace/Diagnostics.tsx';
import { JsPreview } from '../workspace/JsPreview.tsx';
import { OutputPanel } from '../workspace/OutputPanel.tsx';
import { useDraftFiles } from '../workspace/useDraftFiles.ts';
import { useProject, useSeen } from '../workspace/useProject.ts';
import { useRunner } from '../workspace/useRunner.ts';
import { useJump, Workspace } from '../workspace/Workspace.tsx';
import { AskAiButton } from '../ai/AskAiButton.tsx';

export const MODE_LABEL = { ts: 'TypeScript', dom: '网页（DOM）', react: 'React' } as const;

function sameFiles(a: Record<string, string> | undefined, b: Record<string, string>) {
  if (!a) return false;
  const ka = Object.keys(a);
  return ka.length === Object.keys(b).length && ka.every((k) => a[k] === b[k]);
}

export function Playground({ lesson, block }: { lesson: Lesson; block: PlaygroundBlock }) {
  const draft = useDraftFiles(lesson.id, block.id, block.files, block.baseHash);
  const files = draft.files;
  const { ref, seen } = useSeen<HTMLElement>();
  const projectId = `${lesson.id}::${block.id}`;
  const project = useProject({ projectId, mode: block.mode, overrides: block.compiler.overrides, files, withTests: false, enabled: seen });
  const runner = useRunner({ projectId, mode: block.mode, overrides: block.compiler.overrides, entry: block.entry, timeoutMs: block.timeoutMs, fixtures: block.fixtures });
  const { jump, jumpTo } = useJump();
  const [expanded, setExpanded] = useState(false);
  const [showJs, setShowJs] = useState(false);
  const busy = runner.state.status === 'running' || runner.state.status === 'compiling';
  const visible = useMemo(
    () => block.files.filter((f) => !f.hidden).map((f) => ({ path: f.path, content: files[f.path] ?? f.content, readOnly: f.readonly })),
    [block.files, files],
  );
  const stale = runner.state.ranFiles !== undefined && !sameFiles(runner.state.ranFiles, files);

  const run = () => {
    progressStore.recordPlaygroundRun(lesson.id, lesson.version, block.id);
    void runner.run(files);
  };

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !(e.target instanceof HTMLElement && e.target.closest('.cm-editor'))) setExpanded(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expanded]);

  return (
    <section ref={ref} className={`playground ${expanded ? 'expanded' : ''}`} aria-label="可运行示例" data-block={block.id}>
      <header className="block-header">
        <span className="block-kind">示例</span>
        <span className="badge">{MODE_LABEL[block.mode]}</span>
        {block.expectDiagnostics.length > 0 && (
          <span className="badge badge-warn">故意包含类型错误：{block.expectDiagnostics.map((d) => `TS${d.code}（第 ${d.line} 行）`).join('、')}</span>
        )}
        {block.expectRun === 'error' && <span className="badge badge-warn">演示运行时错误</span>}
        <div className="toolbar">
          <button type="button" className="btn btn-primary" onClick={run} disabled={busy && block.mode === 'ts'} title="运行（Ctrl+Enter）">
            <Icon name="play" /> 运行
          </button>
          <button type="button" className="btn" onClick={runner.stop} disabled={!busy && !(block.mode !== 'ts' && runner.state.status === 'done')}>
            <Icon name="stop" /> 停止
          </button>
          <button type="button" className="btn" onClick={() => { draft.reset(); runner.clear(); }} disabled={!draft.isModified && runner.state.status === 'idle'}>
            <Icon name="reset" /> 重置
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => setShowJs((v) => !v)} aria-pressed={showJs}>
            {showJs ? '隐藏 JS' : '查看 JS'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => setExpanded((e) => !e)} aria-pressed={expanded}>
            <Icon name="expand" /> {expanded ? '收起' : '展开'}
          </button>
          <AskAiButton lesson={lesson} blockId={block.id} files={files} diagnostics={project.diagnostics} logs={runner.state.logs} />
        </div>
      </header>
      {block.compiler.note && (
        <div className="notice notice-info">
          <Icon name="info" /> 本示例的编译配置：{block.compiler.note}
        </div>
      )}
      {draft.status === 'outdated' && (
        <div className="notice notice-warn" role="status">
          课程已更新，这个示例的起始代码变了；编辑器里是你基于旧版本的代码。
          <button type="button" className="btn btn-small" onClick={draft.keepDraft}>保留我的代码</button>
          <button type="button" className="btn btn-small" onClick={() => { if (window.confirm('改用新版起始代码会丢弃你在这里的修改，确定吗？')) draft.reset(); }}>
            改用新版起始代码
          </button>
        </div>
      )}
      <div className="playground-body">
        <div className="playground-editor">
          <Workspace files={visible} diagnostics={project.diagnostics} onChange={draft.setFile} service={project.service} onRun={run} label="示例代码" jump={jump} />
          <DiagnosticList diagnostics={project.diagnostics} status={project.status} error={project.error} expected={block.expectDiagnostics} onJump={jumpTo} />
          {showJs && <JsPreview mode={block.mode} files={visible} />}
        </div>
        <OutputPanel mode={block.mode} state={runner.state} stale={stale} previewRef={runner.previewRef} onJump={(l, c, f) => jumpTo(f, l, c)} />
      </div>
      {block.observeHtml && (
        <div className="observe">
          <div className="observe-label">
            <Icon name="eye" /> 观察
          </div>
          <div className="prose" dangerouslySetInnerHTML={{ __html: block.observeHtml }} />
        </div>
      )}
    </section>
  );
}
