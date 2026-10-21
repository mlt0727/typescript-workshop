import { useEffect, useMemo, useState } from 'react';
import type { Exercise, Lesson } from '../../content/types.ts';
import { hashFiles } from '../../judge/hash.ts';
import { judge, mutantInputs, type JudgeResult } from '../../judge/judge.ts';
import { downloadLocalProject } from '../../shared/export/download.ts';
import { progressStore, useProgress } from '../../storage/store.ts';
import { Icon } from '../../ui/Icon.tsx';
import { AskAiButton } from '../ai/AskAiButton.tsx';
import { DiagnosticList } from '../workspace/Diagnostics.tsx';
import { OutputPanel } from '../workspace/OutputPanel.tsx';
import { useDraftFiles } from '../workspace/useDraftFiles.ts';
import { useProject, useSeen } from '../workspace/useProject.ts';
import { useRunner } from '../workspace/useRunner.ts';
import { useJump, Workspace } from '../workspace/Workspace.tsx';
import { MODE_LABEL } from './Playground.tsx';
import { ResultPanel } from './ResultPanel.tsx';

const EMPTY: Record<string, string> = {};

export function ExerciseCard({ lesson, exercise }: { lesson: Lesson; exercise: Exercise }) {
  const draft = useDraftFiles(lesson.id, exercise.id, exercise.starter, exercise.baseHash);
  const progress = useProgress((s) => s.state.lessons[lesson.id]?.exercises[exercise.id]);
  const { ref, seen } = useSeen<HTMLElement>();
  const [showTests, setShowTests] = useState(false);
  const [hintLevel, setHintLevel] = useState(progress?.hintLevel ?? 0);
  const [showSolution, setShowSolution] = useState(false);
  const [result, setResult] = useState<JudgeResult | undefined>(() => progressStore.lastResult(lesson.id, exercise.id));
  const [judging, setJudging] = useState(false);
  const [currentHash, setCurrentHash] = useState<string>();
  const { jump, jumpTo } = useJump();

  const projectId = `${lesson.id}::${exercise.id}`;
  const support = useMemo(() => Object.fromEntries(exercise.support.map((f) => [f.path, f.content])), [exercise.support]);
  const tests = useMemo(() => Object.fromEntries(exercise.tests.map((f) => [f.path, f.content])), [exercise.tests]);
  const student = draft.files;
  const all = useMemo(() => ({ ...support, ...student, ...tests }), [support, student, tests]);
  const project = useProject({ projectId, mode: exercise.mode, overrides: exercise.compiler.overrides, files: all, withTests: true, enabled: seen });
  const runner = useRunner({
    projectId: `${projectId}::run`,
    mode: exercise.mode,
    overrides: exercise.compiler.overrides,
    entry: exercise.entry,
    timeoutMs: exercise.timeoutMs,
    fixtures: exercise.fixtures,
  });
  const runFiles = useMemo(() => ({ ...support, ...student }), [support, student]);

  useEffect(() => {
    let cancelled = false;
    void hashFiles(student).then((h) => {
      if (!cancelled) setCurrentHash(h);
    });
    return () => {
      cancelled = true;
    };
  }, [student]);

  const visibleFiles = useMemo(
    () => [
      ...exercise.starter.map((f) => ({ path: f.path, content: student[f.path] ?? f.content, readOnly: f.readonly })),
      ...exercise.support.filter((f) => !f.hidden).map((f) => ({ path: f.path, content: f.content, readOnly: true })),
      ...(showTests ? exercise.tests.map((f) => ({ path: f.path, content: f.content, readOnly: true })) : []),
    ],
    [exercise, student, showTests],
  );

  const run = () => {
    progressStore.recordExerciseRun(lesson.id, lesson.version, exercise.id);
    void runner.run(runFiles);
  };

  const submit = async () => {
    if (judging) return;
    setJudging(true);
    try {
      const r = await judge(
        {
          projectId: `${projectId}::judge`,
          mode: exercise.mode,
          overrides: exercise.compiler.overrides,
          entry: exercise.entry,
          runTests: exercise.runTests,
          forbid: exercise.forbid,
          expectDiagnostics: exercise.expectDiagnostics,
          timeoutMs: exercise.timeoutMs,
          perTestTimeoutMs: exercise.perTestTimeoutMs,
          fixtures: exercise.fixtures,
          grading: exercise.grading,
        },
        { student: { ...student }, support, tests, mutants: mutantInputs(exercise.mutants) },
      );
      setResult(r);
      progressStore.recordSubmission(lesson.id, lesson.version, exercise.id, r);
    } finally {
      setJudging(false);
    }
  };

  const openHint = (level: number) => {
    setHintLevel(level);
    progressStore.recordHint(lesson.id, lesson.version, exercise.id, level);
  };

  const revealSolution = () => {
    if (!progress?.viewedSolutionAt && !window.confirm('查看参考答案会被记录为“已查看答案”。先试试提示也许更有收获。确定要查看吗？')) return;
    progressStore.recordViewedSolution(lesson.id, lesson.version, exercise.id);
    setShowSolution(true);
  };

  const studentErrors = project.diagnostics.filter((d) => d.category === 'error' && d.file !== undefined && d.file in student).length;
  const resultStale = result !== undefined && currentHash !== undefined && result.snapshotHash !== currentHash;
  const busy = runner.state.status === 'running' || runner.state.status === 'compiling';
  const kindLabel = exercise.kind === 'task' ? '小任务' : '编程挑战';

  return (
    <section ref={ref} className={`exercise exercise-${exercise.kind}`} aria-labelledby={`${exercise.id}-title`} data-block={exercise.id}>
      <header className="block-header">
        <span className="block-kind">{kindLabel}</span>
        <h3 id={`${exercise.id}-title`}>{exercise.title}</h3>
        <span className="badge">{MODE_LABEL[exercise.mode]}</span>
        {exercise.grading === 'tests' && <span className="badge badge-info">写测试</span>}
      </header>
      <ul className="status-chips" aria-label="练习状态">
        <li className={progress?.ranAt ? 'on' : ''}>
          <Icon name={progress?.ranAt ? 'check' : 'circle'} /> {progress?.ranAt ? '运行过' : '未运行'}
        </li>
        <li className={project.status === 'ready' && studentErrors === 0 ? 'on' : project.status === 'ready' ? 'bad' : ''}>
          <Icon name={project.status === 'ready' && studentErrors === 0 ? 'check' : project.status === 'ready' ? 'cross' : 'circle'} />
          {project.status === 'ready' ? (studentErrors === 0 ? '当前代码类型正确' : `当前代码有 ${studentErrors} 个类型错误`) : '类型检查未完成'}
        </li>
        <li className={result && !resultStale ? (result.passed ? 'on' : 'bad') : ''}>
          <Icon name={result && !resultStale ? (result.passed ? 'check' : 'cross') : 'circle'} />
          {!result ? '尚未提交' : resultStale ? '上次提交结果已过期' : result.passed ? '当前代码通过验收' : '当前代码未通过验收'}
        </li>
        {progress?.passedAt && (
          <li className="on">
            <Icon name="check" /> 曾于 {new Date(progress.passedAt).toLocaleDateString('zh-CN')} 通过
          </li>
        )}
        {progress?.viewedSolutionAt && (
          <li className="warn">
            <Icon name="eye" /> 已查看答案
          </li>
        )}
      </ul>
      <div className="prose exercise-prompt" dangerouslySetInnerHTML={{ __html: exercise.promptHtml }} />
      {exercise.compiler.note && (
        <div className="notice notice-info">
          <Icon name="info" /> 本题编译配置：{exercise.compiler.note}
        </div>
      )}
      {draft.status === 'outdated' && (
        <div className="notice notice-warn" role="status">
          课程已更新，这道题的起始代码变了；编辑器里是你基于旧版本的代码。
          <button type="button" className="btn btn-small" onClick={draft.keepDraft}>保留我的代码</button>
          <button type="button" className="btn btn-small" onClick={() => { if (window.confirm('改用新版起始代码会丢弃你在这道题里的代码，确定吗？')) draft.reset(); }}>
            改用新版起始代码
          </button>
        </div>
      )}
      <div className="toolbar">
        <button type="button" className="btn" onClick={run} disabled={busy && exercise.mode === 'ts'} title="运行（Ctrl+Enter）">
          <Icon name="play" /> 运行
        </button>
        <button type="button" className="btn" onClick={runner.stop} disabled={!busy}>
          <Icon name="stop" /> 停止
        </button>
        <button type="button" className="btn btn-primary" onClick={() => void submit()} disabled={judging} title="提交检查（Ctrl+Shift+Enter）">
          <Icon name="check" /> {judging ? '检查中…' : '提交检查'}
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => {
            if (!draft.isModified || window.confirm('重置会丢弃你在这道题里写的代码，确定吗？')) {
              draft.reset();
              runner.clear();
            }
          }}
          disabled={!draft.isModified}
        >
          <Icon name="reset" /> 重置
        </button>
        {exercise.tests.length > 0 && (
          <button type="button" className="btn btn-ghost" onClick={() => setShowTests((s) => !s)} aria-pressed={showTests}>
            {showTests ? '隐藏验收测试' : '查看验收测试'}
          </button>
        )}
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => downloadLocalProject(lesson, exercise, all)}
          title="把当前代码、支持文件和验收测试下载为可以在本机运行的 Vite + Vitest 项目（.zip）"
        >
          <Icon name="download" /> 下载本地项目
        </button>
        <AskAiButton lesson={lesson} blockId={exercise.id} files={student} diagnostics={project.diagnostics} logs={runner.state.logs} exercise={exercise} />
      </div>
      <div className="playground-body">
        <div className="playground-editor">
          <Workspace files={visibleFiles} diagnostics={project.diagnostics} onChange={draft.setFile} service={project.service} onRun={run} onSubmit={() => void submit()} label={`${kindLabel}“${exercise.title}”`} jump={jump} />
          <DiagnosticList diagnostics={project.diagnostics.filter((d) => d.file === undefined || d.file in student || showTests)} status={project.status} error={project.error} expected={exercise.expectDiagnostics} onJump={jumpTo} />
        </div>
        <OutputPanel mode={exercise.mode} state={runner.state} stale={runner.state.ranFiles !== undefined && runner.state.ranFiles !== EMPTY && JSON.stringify(runner.state.ranFiles) !== JSON.stringify(runFiles)} previewRef={runner.previewRef} onJump={(l, c, f) => jumpTo(f, l, c)} />
      </div>
      {result && <ResultPanel result={result} stale={resultStale} grading={exercise.grading} onJump={jumpTo} />}

      <div className="hints">
        {exercise.hints.map((h) =>
          hintLevel >= h.level ? (
            <div key={h.level} className="hint">
              <div className="hint-label">
                <Icon name="bulb" /> {h.level === 1 ? '方向提示' : '更具体的提示'}
              </div>
              <div className="prose" dangerouslySetInnerHTML={{ __html: h.html }} />
            </div>
          ) : null,
        )}
        <div className="hint-actions">
          {exercise.hints.some((h) => h.level === hintLevel + 1) && (
            <button type="button" className="btn btn-small" onClick={() => openHint(hintLevel + 1)}>
              <Icon name="bulb" /> {hintLevel === 0 ? '显示方向提示' : '显示更具体的提示'}
            </button>
          )}
          {!showSolution && (
            <button type="button" className="btn btn-small btn-ghost" onClick={revealSolution}>
              <Icon name="eye" /> 查看参考答案
            </button>
          )}
        </div>
        {showSolution && (
          <div className="solution">
            <h4>参考答案</h4>
            {exercise.solution.map((f) => (
              <div key={f.path} className="solution-file">
                <div className="file-name">{f.path}</div>
                <pre className="code-static">{f.content}</pre>
              </div>
            ))}
            {exercise.explanationHtml && <div className="prose" dangerouslySetInnerHTML={{ __html: exercise.explanationHtml }} />}
            <p className="muted">参考答案只是其中一种写法：其他写法只要通过全部检查同样正确。</p>
          </div>
        )}
      </div>
    </section>
  );
}
