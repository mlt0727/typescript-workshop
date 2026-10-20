/**
 * 代码编辑器：CodeMirror 6。
 * - 诊断、补全、悬停信息都来自编译器 Worker（与判题相同的 TypeScript 6.0.3 与配置）；
 * - 多文件：每个文件一个 EditorState，切换标签时替换；
 * - 键盘：Tab 缩进；按 Esc 后两秒内按 Tab 可移出编辑器，Ctrl+M 切换 Tab 移动焦点模式。
 */
import { autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap, type CompletionContext, type CompletionResult } from '@codemirror/autocomplete';
import { defaultKeymap, history, historyKeymap, indentWithTab, temporarilySetTabFocusMode } from '@codemirror/commands';
import { css } from '@codemirror/lang-css';
import { html } from '@codemirror/lang-html';
import { javascript } from '@codemirror/lang-javascript';
import { bracketMatching, HighlightStyle, indentOnInput, indentUnit, syntaxHighlighting } from '@codemirror/language';
import { lintGutter, lintKeymap, setDiagnostics, type Diagnostic } from '@codemirror/lint';
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search';
import { EditorState, Prec, type Extension } from '@codemirror/state';
import {
  drawSelection,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  hoverTooltip,
  keymap,
  lineNumbers,
} from '@codemirror/view';
import { tags as t } from '@lezer/highlight';
import { useEffect, useLayoutEffect, useRef } from 'react';
import type { CompletionItem, DiagnosticInfo, QuickInfo } from '../compiler/core/types.ts';
import { explainDiagnostic } from '../judge/explain.ts';

export interface EditorLanguageService {
  completions(file: string, position: number): Promise<CompletionItem[]>;
  quickInfo(file: string, position: number): Promise<QuickInfo | null>;
}

export interface CodeEditorProps {
  path: string;
  value: string;
  readOnly?: boolean;
  /** 当前文件的诊断（来自编译器） */
  diagnostics: DiagnosticInfo[];
  onChange?(value: string): void;
  service?: EditorLanguageService;
  onRun?(): void;
  onSubmit?(): void;
  ariaLabel: string;
  /** 让外部控制光标跳转：每次 nonce 变化时跳到 line */
  jumpTo?: { line: number; column: number; nonce: number };
}

const highlightStyle = HighlightStyle.define([
  { tag: [t.keyword, t.modifier, t.controlKeyword, t.operatorKeyword], color: 'var(--code-keyword)' },
  { tag: [t.string, t.special(t.string), t.regexp], color: 'var(--code-string)' },
  { tag: [t.number, t.bool, t.null, t.atom], color: 'var(--code-number)' },
  { tag: [t.comment, t.lineComment, t.blockComment], color: 'var(--code-comment)', fontStyle: 'italic' },
  { tag: [t.typeName, t.className, t.namespace], color: 'var(--code-type)' },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: 'var(--code-function)' },
  { tag: [t.propertyName, t.attributeName], color: 'var(--code-property)' },
  { tag: [t.tagName, t.angleBracket], color: 'var(--code-tag)' },
  { tag: [t.definition(t.variableName)], color: 'var(--code-definition)' },
  { tag: t.invalid, color: 'var(--danger)' },
]);

const baseTheme = EditorView.theme({
  '&': { fontSize: 'var(--editor-font-size)', backgroundColor: 'var(--editor-bg)', color: 'var(--text)', height: '100%' },
  '.cm-content': { fontFamily: 'var(--font-mono)', caretColor: 'var(--text)', padding: '8px 0' },
  '.cm-scroller': { fontFamily: 'var(--font-mono)', lineHeight: '1.6', overflow: 'auto' },
  '.cm-gutters': { backgroundColor: 'var(--editor-gutter)', color: 'var(--text-faint)', border: 'none' },
  '.cm-activeLine': { backgroundColor: 'var(--editor-active-line)' },
  '.cm-activeLineGutter': { backgroundColor: 'var(--editor-active-line)' },
  '&.cm-focused': { outline: '2px solid var(--focus)', outlineOffset: '-2px' },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection': { backgroundColor: 'var(--editor-selection) !important' },
  '.cm-cursor': { borderLeftColor: 'var(--text)' },
  '.cm-tooltip': { backgroundColor: 'var(--surface-raised)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '6px', maxWidth: 'min(560px, 90vw)' },
  '.cm-tooltip-autocomplete > ul > li[aria-selected]': { backgroundColor: 'var(--accent)', color: 'var(--on-accent)' },
  '.cm-diagnostic': { whiteSpace: 'pre-wrap', fontFamily: 'var(--font-sans)', padding: '6px 10px' },
  '.cm-diagnostic-error': { borderLeft: '4px solid var(--danger)' },
  '.cm-lintRange-error': { backgroundImage: 'none', textDecoration: 'underline wavy var(--danger)', textUnderlineOffset: '3px' },
  '.cm-lintRange-warning': { backgroundImage: 'none', textDecoration: 'underline wavy var(--warning)' },
  '.cm-lintRange-info': { backgroundImage: 'none', opacity: '0.65' },
});

function languageFor(path: string): Extension {
  if (path.endsWith('.tsx')) return javascript({ typescript: true, jsx: true });
  if (path.endsWith('.ts')) return javascript({ typescript: true });
  if (path.endsWith('.html')) return html();
  if (path.endsWith('.css')) return css();
  if (path.endsWith('.json')) return javascript();
  return [];
}

function toCmDiagnostics(list: DiagnosticInfo[], docLength: number): Diagnostic[] {
  return list
    .filter((d) => d.start !== undefined)
    .map((d) => {
      const from = Math.min(d.start ?? 0, docLength);
      const to = Math.min(from + Math.max(d.length ?? 0, 0), docLength);
      const explain = explainDiagnostic(d.code);
      return {
        from,
        to: to === from && from < docLength ? from + 1 : to,
        severity: d.category === 'error' ? 'error' : d.category === 'warning' ? 'warning' : 'info',
        source: `TS${d.code}`,
        message: explain ? `${d.message}\n—— ${explain}` : d.message,
      } satisfies Diagnostic;
    });
}

const KIND_TYPE: Record<string, string> = {
  keyword: 'keyword',
  function: 'function',
  method: 'method',
  property: 'property',
  var: 'variable',
  let: 'variable',
  const: 'constant',
  'local var': 'variable',
  parameter: 'variable',
  class: 'class',
  interface: 'interface',
  type: 'type',
  enum: 'enum',
  module: 'namespace',
};

export function CodeEditor(props: CodeEditorProps) {
  const host = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const statesRef = useRef(new Map<string, EditorState>());
  const prevPath = useRef<string | undefined>(undefined);
  const propsRef = useRef(props);
  useLayoutEffect(() => {
    propsRef.current = props;
  });

  // 创建 / 切换文件
  useEffect(() => {
    const createState = (path: string, doc: string, readOnly: boolean) => {
      const completionSource = async (ctx: CompletionContext): Promise<CompletionResult | null> => {
        const service = propsRef.current.service;
        if (!service) return null;
        const word = ctx.matchBefore(/[\w$]*/);
        const before = ctx.state.sliceDoc(Math.max(0, ctx.pos - 1), ctx.pos);
        if (!ctx.explicit && !word?.text && before !== '.') return null;
        const items = await service.completions(path, ctx.pos);
        if (ctx.aborted) return null;
        return {
          from: word ? word.from : ctx.pos,
          options: items.map((i) => ({ label: i.name, type: KIND_TYPE[i.kind] ?? i.kind, apply: i.insertText, boost: i.sortText < '11' ? 1 : 0 })),
          validFor: /^[\w$]*$/,
        };
      };
      const hover = hoverTooltip(async (_view, pos) => {
        const service = propsRef.current.service;
        if (!service) return null;
        const info = await service.quickInfo(path, pos);
        if (!info?.display) return null;
        return {
          pos: info.start,
          end: info.start + info.length,
          create() {
            const dom = document.createElement('div');
            dom.className = 'cm-quickinfo';
            const code = document.createElement('pre');
            code.textContent = info.display;
            dom.append(code);
            if (info.documentation) {
              const doc = document.createElement('p');
              doc.textContent = info.documentation;
              dom.append(doc);
            }
            return { dom };
          },
        };
      });
      const isCode = /\.(ts|tsx)$/.test(path);
      return EditorState.create({
        doc,
        extensions: [
          lineNumbers(),
          highlightActiveLineGutter(),
          highlightSpecialChars(),
          history(),
          drawSelection(),
          EditorState.allowMultipleSelections.of(true),
          indentOnInput(),
          indentUnit.of('  '),
          EditorState.tabSize.of(2),
          syntaxHighlighting(highlightStyle),
          bracketMatching(),
          closeBrackets(),
          highlightActiveLine(),
          highlightSelectionMatches(),
          languageFor(path),
          isCode ? autocompletion({ override: [completionSource], activateOnTypingDelay: 150 }) : [],
          isCode ? hover : [],
          lintGutter(),
          Prec.highest(
            keymap.of([
              { key: 'Mod-Enter', run: () => (propsRef.current.onRun?.(), true) },
              { key: 'Mod-Shift-Enter', run: () => (propsRef.current.onSubmit?.(), true) },
              { key: 'Escape', run: temporarilySetTabFocusMode },
            ]),
          ),
          keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...searchKeymap, ...historyKeymap, ...completionKeymap, ...lintKeymap, indentWithTab]),
          EditorState.readOnly.of(readOnly),
          EditorView.editable.of(!readOnly),
          EditorView.contentAttributes.of({ 'aria-label': `${propsRef.current.ariaLabel}：${path}${readOnly ? '（只读）' : ''}` }),
          EditorView.updateListener.of((u) => {
            if (u.docChanged && !readOnly) propsRef.current.onChange?.(u.state.doc.toString());
          }),
          baseTheme,
        ],
      });
    };

    const p = propsRef.current;
    const view = viewRef.current;
    // 保存离开文件的状态（含撤销历史与光标），切回时恢复
    if (view && prevPath.current && prevPath.current !== p.path) {
      statesRef.current.set(prevPath.current, view.state);
    }
    let state = statesRef.current.get(p.path);
    if (!state) {
      state = createState(p.path, p.value, p.readOnly ?? false);
      statesRef.current.set(p.path, state);
    }
    if (!view && host.current) {
      viewRef.current = new EditorView({ state, parent: host.current });
    } else if (view && view.state !== state) {
      view.setState(state);
    }
    prevPath.current = p.path;
    return undefined;
  }, [props.path]);

  // 外部值变化（重置、恢复草稿）时同步到编辑器
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== props.value) {
      view.dispatch({ changes: { from: 0, to: current.length, insert: props.value } });
    }
  }, [props.value, props.path]);

  // 诊断
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch(setDiagnostics(view.state, toCmDiagnostics(props.diagnostics, view.state.doc.length)));
  }, [props.diagnostics, props.path, props.value]);

  // 跳转到指定位置
  useEffect(() => {
    const view = viewRef.current;
    const j = props.jumpTo;
    if (!view || !j) return;
    const line = view.state.doc.line(Math.min(Math.max(1, j.line), view.state.doc.lines));
    const pos = Math.min(line.from + Math.max(0, j.column - 1), line.to);
    view.dispatch({ selection: { anchor: pos }, scrollIntoView: true });
    view.focus();
  }, [props.jumpTo?.nonce]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(
    () => () => {
      viewRef.current?.destroy();
      viewRef.current = null;
    },
    [],
  );

  return <div className="code-editor" ref={host} />;
}

export default CodeEditor;
