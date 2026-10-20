import { describe, expect, test } from 'vitest';
import { findRawHtml, renderMarkdown } from './markdown.ts';

describe('课程 Markdown 中的原始 HTML', () => {
  test('没有放进反引号的标签当作文字显示，不会被浏览器当成元素', () => {
    const html = renderMarkdown('类型 Ref<HTMLInputElement> 和 <ChatRoom key={id} />');
    expect(html).not.toContain('<HTMLInputElement>');
    expect(html).not.toContain('<ChatRoom');
    expect(html).toContain('&#x3C;HTMLInputElement>');
  });

  test('行内代码照常显示', () => {
    expect(renderMarkdown('写成 `<T>`')).toBe('<p>写成 <code>&#x3C;T></code></p>');
  });

  test('findRawHtml 报告这些标签，代码中的不算', () => {
    expect(findRawHtml('选 <option> 还是 `<select>`？')).toEqual(['<option>']);
    expect(findRawHtml('没有标签')).toEqual([]);
  });
});
