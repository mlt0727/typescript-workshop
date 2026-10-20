/**
 * 课程 Markdown 处理：解析（GFM + 指令块）、代码高亮（构建时 Shiki，浅/深双主题）与 HTML 输出。
 * 课程内容是仓库中受信任的文件，只在构建时处理；进度导入等用户数据永远不会经过这里。
 */
import type { Code, Root, RootContent } from 'mdast';
import remarkDirective from 'remark-directive';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import { createHighlighter, type Highlighter } from 'shiki';
import { unified } from 'unified';

let highlighter: Highlighter | undefined;

export async function initHighlighter() {
  highlighter ??= await createHighlighter({
    themes: ['github-light', 'github-dark'],
    langs: ['typescript', 'tsx', 'javascript', 'html', 'css', 'json', 'bash', 'python', 'java', 'cpp', 'text'],
  });
}

const LANG_ALIASES: Record<string, string> = {
  ts: 'typescript',
  js: 'javascript',
  sh: 'bash',
  shell: 'bash',
  py: 'python',
  'c++': 'cpp',
  txt: 'text',
  plain: 'text',
  console: 'text',
};

export function highlight(code: string, lang: string | null | undefined): string {
  if (!highlighter) throw new Error('highlighter 未初始化');
  const l = LANG_ALIASES[lang ?? 'text'] ?? lang ?? 'text';
  const known = highlighter.getLoadedLanguages().includes(l) ? l : 'text';
  return highlighter.codeToHtml(code, {
    lang: known,
    themes: { light: 'github-light', dark: 'github-dark' },
    defaultColor: false,
  });
}

const parser = unified().use(remarkParse).use(remarkGfm).use(remarkDirective);

export function parseMarkdown(source: string): Root {
  return parser.runSync(parser.parse(source)) as Root;
}

function replaceCode(node: RootContent | Root): RootContent | Root {
  if (node.type === 'code') {
    const c = node as Code;
    return { type: 'html', value: `<div class="code-block" data-lang="${c.lang ?? 'text'}">${highlight(c.value, c.lang)}</div>` };
  }
  if ('children' in node && Array.isArray(node.children)) {
    (node as { children: RootContent[] }).children = node.children.map((c) => replaceCode(c) as RootContent);
  }
  return node;
}

const toHtml = unified().use(remarkRehype, { allowDangerousHtml: true }).use(rehypeStringify, { allowDangerousHtml: true });

/**
 * 课程作者写在 Markdown 中的原始 HTML（例如测验中没有加反引号的 `<T>`、`<input>`）当作普通文字显示，
 * 否则浏览器会把它当成标签“吞掉”。只有代码高亮生成的 HTML 才原样输出（见 replaceCode）。
 * content:check 会把这类写法报告出来（findRawHtml）。
 */
function escapeRawHtml(node: RootContent | Root): RootContent | Root {
  if (node.type === 'html') return { type: 'text', value: (node as { value: string }).value };
  if ('children' in node && Array.isArray(node.children)) {
    (node as { children: RootContent[] }).children = node.children.map((c) => escapeRawHtml(c) as RootContent);
  }
  return node;
}

/** 找出 Markdown 中作者写的原始 HTML（用于发布检查） */
export function findRawHtml(source: string): string[] {
  const out: string[] = [];
  const walk = (node: RootContent | Root) => {
    if (node.type === 'html') out.push((node as { value: string }).value);
    if ('children' in node && Array.isArray(node.children)) for (const c of node.children) walk(c as RootContent);
  };
  walk(parseMarkdown(source));
  return out;
}

/** 把一组 mdast 节点渲染成 HTML（代码块高亮、外部链接新窗口打开）。 */
export function renderNodes(nodes: RootContent[]): string {
  const root: Root = { type: 'root', children: nodes.map((n) => replaceCode(escapeRawHtml(structuredClone(n))) as RootContent) };
  const hast = toHtml.runSync(root as never);
  let html = String(toHtml.stringify(hast as never));
  html = html.replace(/<a href="(https?:\/\/[^"]+)"/g, '<a href="$1" target="_blank" rel="noopener noreferrer"');
  return html;
}

export function renderMarkdown(source: string): string {
  return renderNodes(parseMarkdown(source).children);
}

/** 解析代码块 meta：`file=main.ts hidden readonly` → { file: 'main.ts', hidden: true, readonly: true } */
export function parseMeta(meta: string | null | undefined): Record<string, string | true> {
  const out: Record<string, string | true> = {};
  for (const m of (meta ?? '').matchAll(/([\w-]+)(?:=(?:"([^"]*)"|(\S+)))?/g)) {
    out[m[1]!] = m[2] ?? m[3] ?? true;
  }
  return out;
}
