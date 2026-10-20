/**
 * 极简、安全的 Markdown 渲染（用于 AI 回答）：只识别代码块、行内代码、粗体、标题与列表，
 * 全部通过 React 文本节点输出，不会把任何字符串当作 HTML 注入。
 */
import type { ReactNode } from 'react';

function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(`[^`\n]+`|\*\*[^*\n]+\*\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const token = m[0];
    if (token.startsWith('`')) out.push(<code key={i++}>{token.slice(1, -1)}</code>);
    else out.push(<strong key={i++}>{token.slice(2, -2)}</strong>);
    last = m.index + token.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function SafeMarkdown({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  const parts = text.split(/```/);
  parts.forEach((part, idx) => {
    if (idx % 2 === 1) {
      const nl = part.indexOf('\n');
      const code = nl >= 0 ? part.slice(nl + 1) : part;
      blocks.push(
        <pre key={`c${idx}`} className="code-static">
          {code.replace(/\n$/, '')}
        </pre>,
      );
      return;
    }
    const paragraphs = part.split(/\n{2,}/);
    paragraphs.forEach((para, j) => {
      const lines = para.split('\n').filter((l) => l.trim() !== '');
      if (lines.length === 0) return;
      const key = `p${idx}-${j}`;
      if (lines.every((l) => /^\s*([-*]|\d+\.)\s+/.test(l))) {
        const ordered = /^\s*\d+\./.test(lines[0]!);
        const items = lines.map((l, k) => <li key={k}>{inline(l.replace(/^\s*([-*]|\d+\.)\s+/, ''))}</li>);
        blocks.push(ordered ? <ol key={key}>{items}</ol> : <ul key={key}>{items}</ul>);
      } else if (lines.length === 1 && /^#{1,4}\s/.test(lines[0]!)) {
        blocks.push(<h4 key={key}>{inline(lines[0]!.replace(/^#{1,4}\s/, ''))}</h4>);
      } else {
        blocks.push(
          <p key={key}>
            {lines.map((l, k) => (
              <span key={k}>
                {k > 0 && <br />}
                {inline(l)}
              </span>
            ))}
          </p>,
        );
      }
    });
  });
  return <div className="ai-answer">{blocks}</div>;
}
