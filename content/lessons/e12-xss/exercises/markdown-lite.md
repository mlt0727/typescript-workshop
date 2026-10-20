---
kind: challenge
title: 安全地渲染简化的 Markdown
mode: dom
---
评论区要支持一种很小的格式。实现 `renderMarkdownLite(source)`，把用户输入的文字渲染成一个 `DocumentFragment`，**只能**产生下面这几种元素：

1. **段落**：只含空白的行（包括空行）分隔段落，每个段落是一个 `<p>`。开头、结尾和连续的空行都不产生空段落。换行可能是 `\n`，也可能是 `\r\n`；
2. **换行**：同一个段落中的多行之间插入 `<br>`，行内的文字（包括首尾的空格）原样保留；
3. **粗体**：`**文字**` 变成 `<strong>文字</strong>`，取最短的配对；不成对的 `**` 原样显示；
4. **链接**：`[文字](地址)` 变成 `<a href="…">文字</a>`。地址不能包含空白和 `)`；它必须能用 `URL.parse(地址)` 解析成**绝对地址**（不传基准地址），并且协议是 `http:`、`https:`、`mailto:` 之一，`href` 使用解析之后的 `url.href`。否则不生成链接，只显示方括号中的文字；
5. 粗体和链接都不能跨行，它们的文字中不再识别其他格式；其他一切内容，包括 HTML 标签，都是**文字**。

起始代码用 `innerHTML` 拼出 HTML，评论中的 `<img onerror>` 会变成真正的元素。

:::files{role=starter}
```ts file=markdown.ts
export function renderMarkdownLite(source: string): DocumentFragment {
  const html = source
    .split('\n\n')
    .map((block) => `<p>${block.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>')}</p>`)
    .join('');
  const template = document.createElement('template');
  template.innerHTML = html;
  return template.content;
}
```
:::

:::files{role=solution}
```ts file=markdown.ts
const INLINE = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
const SAFE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);

function safeUrl(text: string): string | null {
  const url = URL.parse(text);
  return url !== null && SAFE_PROTOCOLS.has(url.protocol) ? url.href : null;
}

function appendInline(parent: HTMLElement, line: string): void {
  let last = 0;
  for (const match of line.matchAll(INLINE)) {
    const [whole, bold, label, href] = match;
    parent.append(line.slice(last, match.index));
    if (bold !== undefined) {
      const strong = document.createElement('strong');
      strong.textContent = bold;
      parent.append(strong);
    } else if (label !== undefined && href !== undefined) {
      const safe = safeUrl(href);
      if (safe === null) {
        parent.append(label);
      } else {
        const link = document.createElement('a');
        link.href = safe;
        link.textContent = label;
        parent.append(link);
      }
    }
    last = match.index + whole.length;
  }
  parent.append(line.slice(last));
}

export function renderMarkdownLite(source: string): DocumentFragment {
  const fragment = document.createDocumentFragment();
  let lines: string[] = [];
  const flush = (): void => {
    if (lines.length === 0) return;
    const paragraph = document.createElement('p');
    lines.forEach((line, index) => {
      if (index > 0) paragraph.append(document.createElement('br'));
      appendInline(paragraph, line);
    });
    fragment.append(paragraph);
    lines = [];
  };
  for (const line of source.split(/\r?\n/)) {
    if (line.trim() === '') flush();
    else lines.push(line);
  }
  flush();
  return fragment;
}
```
:::

:::files{role=tests}
```ts file=markdown.test.ts
import { describe, expect, test } from 'vitest';
import { renderMarkdownLite } from './markdown';

function html(source: string): string {
  const container = document.createElement('div');
  container.append(renderMarkdownLite(source));
  return container.innerHTML;
}

describe('段落与换行', () => {
  test('空行分隔段落，段落内的换行变成 <br>', () => {
    expect(html('第一行\n第二行\n\n第二段')).toBe('<p>第一行<br>第二行</p><p>第二段</p>');
  });

  test('多个空行、只有空白的行、开头结尾的空行，以及 \\r\\n', () => {
    expect(html('\n\n  a\r\nb \r\n \r\n\t\n\nc\n')).toBe('<p>  a<br>b </p><p>c</p>');
    expect(html('')).toBe('');
    expect(html('  \n\n ')).toBe('');
  });
});

describe('粗体', () => {
  test('**文字** 变成 <strong>', () => {
    expect(html('我**很**喜欢 **TypeScript**')).toBe('<p>我<strong>很</strong>喜欢 <strong>TypeScript</strong></p>');
  });

  test('不成对的 ** 和不跨行', () => {
    expect(html('a ** b')).toBe('<p>a ** b</p>');
    expect(html('**开始\n结束**')).toBe('<p>**开始<br>结束**</p>');
  });
});

describe('链接', () => {
  test('[文字](地址) 变成链接，地址是解析之后的结果', () => {
    expect(html('看 [MDN](https://developer.mozilla.org) 的文档')).toBe('<p>看 <a href="https://developer.mozilla.org/">MDN</a> 的文档</p>');
    expect(html('[写信](mailto:hi@example.com)')).toBe('<p><a href="mailto:hi@example.com">写信</a></p>');
  });

  test('不安全或不完整的地址只显示文字', () => {
    expect(html('[点我](javascript:stealCookies)')).toBe('<p>点我</p>');
    expect(html('[点我](JavaScript:stealCookies)')).toBe('<p>点我</p>');
    expect(html('[图片](data:text/html;base64,PHNjcmlwdD4=)')).toBe('<p>图片</p>');
    expect(html('[文档](/docs)')).toBe('<p>文档</p>');
  });

  test('只放行 http、https、mailto，其他协议和各种变形都不生成链接', () => {
    const inputs = [
      '\u0001javascript:stealCookies',
      'JAVASCRIPT:stealCookies',
      'vbscript:msgbox',
      'file:///etc/passwd',
      'blob:https://ok.example/5f1c',
      'about:blank',
      'tel:10086',
    ];
    for (const href of inputs) {
      expect(html(`[链接](${href})`), JSON.stringify(href)).toBe('<p>链接</p>');
    }
  });
});

describe('用户输入只能是文字', () => {
  test('HTML 标签原样显示，不会产生元素', () => {
    const payloads = [
      '<script>alert(1)</script>',
      '<img src=x onerror=alert(1)>',
      '**<b>粗</b>**',
      '[<img src=x onerror=alert(1)>](https://ok.example/)',
      '[x](https://ok.example/?q="><img/src/onerror=alert(1)>)',
    ];
    for (const source of payloads) {
      const container = document.createElement('div');
      container.append(renderMarkdownLite(source));
      expect(container.querySelectorAll('script, img'), source).toHaveLength(0);
      const tags = [...container.querySelectorAll('*')].map((el) => el.tagName);
      expect(tags.every((tag) => ['P', 'BR', 'STRONG', 'A'].includes(tag)), source).toBe(true);
    }
    expect(html('<script>alert(1)</script>')).toBe('<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>');
    expect(html('**<b>粗</b>**')).toBe('<p><strong>&lt;b&gt;粗&lt;/b&gt;</strong></p>');
  });

  test('链接的属性不会被引号“打破”', () => {
    const container = document.createElement('div');
    container.append(renderMarkdownLite('[x](https://ok.example/?q="onmouseover="alert`1`)'));
    const link = container.querySelector('a');
    expect(link?.getAttribute('href')).toBe('https://ok.example/?q=%22onmouseover=%22alert`1`');
    expect(link?.hasAttribute('onmouseover')).toBe(false);
  });
});
```
:::

:::hint{level=1}
不要拼 HTML 字符串。先把输入按行拆开（`split(/\r?\n/)`），遇到空白行就把攒下的行变成一个 `<p>`；每一行再交给一个函数处理行内的格式。所有用户的文字都通过 `append(字符串)` 或 `textContent` 放进去，结构用 `createElement` 创建。
:::

:::hint{level=2}
行内格式可以用一个正则一起匹配：`/\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g`，配合 `line.matchAll(...)`：它返回一个可以用 `for…of` 遍历的序列，每一项是一次匹配的结果（和 `exec` 的返回值一样，是一个数组）：`match[0]` 是匹配到的整段文字，`match[1]`、`match[2]`、`match[3]` 是三对圆括号（**捕获组**）匹配到的部分，没有参与匹配的组是 `undefined`；`match.index` 是这次匹配开始的位置。两次匹配之间的那一段是普通文字。第 1 个组有值就是粗体，否则第 2、3 个组是链接的文字和地址。检查地址的方法和小任务相同，只是不传基准地址。
:::

:::explanation
这道题的关键是**结构由代码决定，数据只是文字**。用户输入里的 `<img onerror=…>` 从头到尾都只是字符串，它只会通过 `append(字符串)` 和 `textContent` 进入页面，变成文本节点；能出现在页面上的元素只有代码亲手 `createElement` 的四种。测试检查的正是这一点：无论输入什么，结果中都只有 `p`、`br`、`strong`、`a`。

链接是唯一由用户决定的“属性”，所以它要经过两道检查：解析成绝对地址，协议在白名单中。最后一个测试中的地址带着 `"`，如果拼接 HTML，它会提前结束 `href` 属性、加上一个 `onmouseover` 事件属性；而 `link.href = …` 设置的是属性的**值**，引号只是值中的一个字符，不可能变成新的属性（测试中看到的 `%22`，是 `URL` 解析时对引号做的百分号编码）。

为什么不用黑名单拦截 `javascript:`？测试里的 `\u0001javascript:`（开头藏着一个看不见的控制字符）、`JAVASCRIPT:` 都会被 URL 解析器规范化成 `javascript:` 协议，而 `vbscript:`、`file:`、`blob:` 这些协议，黑名单很容易漏掉。白名单只放行确认安全的三种。

起始代码还有几个功能上的问题：只按 `\n\n` 分段，`\r\n` 和多余的空行都处理不好。

为什么不要求相对链接？评论中的链接通常指向别的网站；即使允许相对地址，也要像小任务那样以当前页面为基准解析。真实的评论系统往往还会给用户的链接加上 `rel="ugc nofollow"`，告诉搜索引擎这是用户提交的内容。
:::

:::variant{kind=alt name=tokenizer}
```ts file=markdown.ts
type Piece = { kind: 'text' | 'strong'; text: string } | { kind: 'link'; text: string; href: string };

function linkTarget(raw: string): string | null {
  try {
    const url = new URL(raw);
    return ['http:', 'https:', 'mailto:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function tokenize(line: string): Piece[] {
  const pieces: Piece[] = [];
  let rest = line;
  while (rest !== '') {
    const bold = /^\*\*(.+?)\*\*/.exec(rest);
    const link = /^\[([^\]]+)\]\(([^)\s]+)\)/.exec(rest);
    if (bold && bold[1] !== undefined) {
      pieces.push({ kind: 'strong', text: bold[1] });
      rest = rest.slice(bold[0].length);
    } else if (link && link[1] !== undefined && link[2] !== undefined) {
      const href = linkTarget(link[2]);
      pieces.push(href === null ? { kind: 'text', text: link[1] } : { kind: 'link', text: link[1], href });
      rest = rest.slice(link[0].length);
    } else {
      const last = pieces.at(-1);
      const char = rest.slice(0, 1);
      if (last && last.kind === 'text') last.text += char;
      else pieces.push({ kind: 'text', text: char });
      rest = rest.slice(1);
    }
  }
  return pieces;
}

function toNode(piece: Piece): Node {
  if (piece.kind === 'text') return document.createTextNode(piece.text);
  const el = document.createElement(piece.kind === 'strong' ? 'strong' : 'a');
  el.textContent = piece.text;
  if (piece.kind === 'link') el.setAttribute('href', piece.href);
  return el;
}

export function renderMarkdownLite(source: string): DocumentFragment {
  const fragment = document.createDocumentFragment();
  const paragraphs: string[][] = [[]];
  for (const line of source.replaceAll('\r\n', '\n').split('\n')) {
    if (line.trim() === '') paragraphs.push([]);
    else paragraphs.at(-1)?.push(line);
  }
  for (const lines of paragraphs) {
    if (lines.length === 0) continue;
    const p = document.createElement('p');
    lines.forEach((line, i) => {
      if (i > 0) p.append(document.createElement('br'));
      p.append(...tokenize(line).map(toNode));
    });
    fragment.append(p);
  }
  return fragment;
}
```
:::

:::variant{kind=wrong name=escape-then-innerhtml fails=tests reason="先转义再拼 HTML，但链接地址直接拼进了属性"}
```ts file=markdown.ts
function escapeText(text: string): string {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

export function renderMarkdownLite(source: string): DocumentFragment {
  const paragraphs = source
    .split(/\r?\n/)
    .reduce<string[][]>((acc, line) => {
      if (line.trim() === '') acc.push([]);
      else acc.at(-1)?.push(line);
      return acc;
    }, [[]])
    .filter((lines) => lines.length > 0);
  const html = paragraphs
    .map((lines) => {
      const body = lines
        .map((line) =>
          escapeText(line)
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label: string, href: string) =>
              /^(https?|mailto):/i.test(href) ? `<a href="${href}">${label}</a>` : label,
            ),
        )
        .join('<br>');
      return `<p>${body}</p>`;
    })
    .join('');
  const template = document.createElement('template');
  template.innerHTML = html;
  return template.content;
}
```
:::

:::variant{kind=wrong name=no-protocol-check fails=tests reason="只检查地址能否解析，没有检查协议"}
```ts file=markdown.ts
const INLINE = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;

function safeUrl(text: string): string | null {
  return URL.parse(text)?.href ?? null;
}

function appendInline(parent: HTMLElement, line: string): void {
  let last = 0;
  for (const match of line.matchAll(INLINE)) {
    const [whole, bold, label, href] = match;
    parent.append(line.slice(last, match.index));
    if (bold !== undefined) {
      const strong = document.createElement('strong');
      strong.textContent = bold;
      parent.append(strong);
    } else if (label !== undefined && href !== undefined) {
      const safe = safeUrl(href);
      if (safe === null) {
        parent.append(label);
      } else {
        const link = document.createElement('a');
        link.href = safe;
        link.textContent = label;
        parent.append(link);
      }
    }
    last = match.index + whole.length;
  }
  parent.append(line.slice(last));
}

export function renderMarkdownLite(source: string): DocumentFragment {
  const fragment = document.createDocumentFragment();
  let lines: string[] = [];
  const flush = (): void => {
    if (lines.length === 0) return;
    const paragraph = document.createElement('p');
    lines.forEach((line, index) => {
      if (index > 0) paragraph.append(document.createElement('br'));
      appendInline(paragraph, line);
    });
    fragment.append(paragraph);
    lines = [];
  };
  for (const line of source.split(/\r?\n/)) {
    if (line.trim() === '') flush();
    else lines.push(line);
  }
  flush();
  return fragment;
}
```
:::

:::variant{kind=wrong name=blacklist fails=tests reason="用黑名单拦截 javascript:，大写的写法和 data: 都能通过"}
```ts file=markdown.ts
const INLINE = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;

function safeUrl(text: string): string | null {
  if (text.startsWith('javascript:')) return null;
  return URL.parse(text)?.href ?? null;
}

function appendInline(parent: HTMLElement, line: string): void {
  let last = 0;
  for (const match of line.matchAll(INLINE)) {
    const [whole, bold, label, href] = match;
    parent.append(line.slice(last, match.index));
    if (bold !== undefined) {
      const strong = document.createElement('strong');
      strong.textContent = bold;
      parent.append(strong);
    } else if (label !== undefined && href !== undefined) {
      const safe = safeUrl(href);
      if (safe === null) {
        parent.append(label);
      } else {
        const link = document.createElement('a');
        link.href = safe;
        link.textContent = label;
        parent.append(link);
      }
    }
    last = match.index + whole.length;
  }
  parent.append(line.slice(last));
}

export function renderMarkdownLite(source: string): DocumentFragment {
  const fragment = document.createDocumentFragment();
  let lines: string[] = [];
  const flush = (): void => {
    if (lines.length === 0) return;
    const paragraph = document.createElement('p');
    lines.forEach((line, index) => {
      if (index > 0) paragraph.append(document.createElement('br'));
      appendInline(paragraph, line);
    });
    fragment.append(paragraph);
    lines = [];
  };
  for (const line of source.split(/\r?\n/)) {
    if (line.trim() === '') flush();
    else lines.push(line);
  }
  flush();
  return fragment;
}
```
:::

:::variant{kind=wrong name=regex-blacklist fails=tests reason="用正则黑名单拦截 javascript: 和 data:，开头带控制字符的写法和 vbscript:、file: 都能通过"}
```ts file=markdown.ts
const INLINE = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;

function safeUrl(text: string): string | null {
  return /^(javascript|data):/i.test(text) ? null : (URL.parse(text)?.href ?? null);
}

function appendInline(parent: HTMLElement, line: string): void {
  let last = 0;
  for (const match of line.matchAll(INLINE)) {
    const [whole, bold, label, href] = match;
    parent.append(line.slice(last, match.index));
    if (bold !== undefined) {
      const strong = document.createElement('strong');
      strong.textContent = bold;
      parent.append(strong);
    } else if (label !== undefined && href !== undefined) {
      const safe = safeUrl(href);
      if (safe === null) {
        parent.append(label);
      } else {
        const link = document.createElement('a');
        link.href = safe;
        link.textContent = label;
        parent.append(link);
      }
    }
    last = match.index + whole.length;
  }
  parent.append(line.slice(last));
}

export function renderMarkdownLite(source: string): DocumentFragment {
  const fragment = document.createDocumentFragment();
  let lines: string[] = [];
  const flush = (): void => {
    if (lines.length === 0) return;
    const paragraph = document.createElement('p');
    lines.forEach((line, index) => {
      if (index > 0) paragraph.append(document.createElement('br'));
      appendInline(paragraph, line);
    });
    fragment.append(paragraph);
    lines = [];
  };
  for (const line of source.split(/\r?\n/)) {
    if (line.trim() === '') flush();
    else lines.push(line);
  }
  flush();
  return fragment;
}
```
:::

:::variant{kind=wrong name=no-breaks fails=tests reason="段落内的换行没有变成 <br>"}
```ts file=markdown.ts
const INLINE = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
const SAFE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);

function safeUrl(text: string): string | null {
  const url = URL.parse(text);
  return url !== null && SAFE_PROTOCOLS.has(url.protocol) ? url.href : null;
}

function appendInline(parent: HTMLElement, line: string): void {
  let last = 0;
  for (const match of line.matchAll(INLINE)) {
    const [whole, bold, label, href] = match;
    parent.append(line.slice(last, match.index));
    if (bold !== undefined) {
      const strong = document.createElement('strong');
      strong.textContent = bold;
      parent.append(strong);
    } else if (label !== undefined && href !== undefined) {
      const safe = safeUrl(href);
      if (safe === null) {
        parent.append(label);
      } else {
        const link = document.createElement('a');
        link.href = safe;
        link.textContent = label;
        parent.append(link);
      }
    }
    last = match.index + whole.length;
  }
  parent.append(line.slice(last));
}

export function renderMarkdownLite(source: string): DocumentFragment {
  const fragment = document.createDocumentFragment();
  let lines: string[] = [];
  const flush = (): void => {
    if (lines.length === 0) return;
    const paragraph = document.createElement('p');
    lines.forEach((line, index) => {
      if (index > 0) paragraph.append(' ');
      appendInline(paragraph, line);
    });
    fragment.append(paragraph);
    lines = [];
  };
  for (const line of source.split(/\r?\n/)) {
    if (line.trim() === '') flush();
    else lines.push(line);
  }
  flush();
  return fragment;
}
```
:::

:::variant{kind=wrong name=split-on-blank-line fails=tests reason="只按 \\n\\n 分段，\\r\\n 和连续的空行处理错了"}
```ts file=markdown.ts
const INLINE = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
const SAFE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);

function safeUrl(text: string): string | null {
  const url = URL.parse(text);
  return url !== null && SAFE_PROTOCOLS.has(url.protocol) ? url.href : null;
}

function appendInline(parent: HTMLElement, line: string): void {
  let last = 0;
  for (const match of line.matchAll(INLINE)) {
    const [whole, bold, label, href] = match;
    parent.append(line.slice(last, match.index));
    if (bold !== undefined) {
      const strong = document.createElement('strong');
      strong.textContent = bold;
      parent.append(strong);
    } else if (label !== undefined && href !== undefined) {
      const safe = safeUrl(href);
      if (safe === null) {
        parent.append(label);
      } else {
        const link = document.createElement('a');
        link.href = safe;
        link.textContent = label;
        parent.append(link);
      }
    }
    last = match.index + whole.length;
  }
  parent.append(line.slice(last));
}

export function renderMarkdownLite(source: string): DocumentFragment {
  const fragment = document.createDocumentFragment();
  for (const block of source.split('\n\n')) {
    if (block === '') continue;
    const paragraph = document.createElement('p');
    block.split('\n').forEach((line, index) => {
      if (index > 0) paragraph.append(document.createElement('br'));
      appendInline(paragraph, line);
    });
    fragment.append(paragraph);
  }
  return fragment;
}
```
:::
