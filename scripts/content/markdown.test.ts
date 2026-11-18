import { describe, expect, test } from 'vitest';
import { findRawHtml, lessonShortId, renderMarkdown, setLessonRefs } from './markdown.ts';

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

describe('课文中引用其他课时的简称', () => {
  const refs = new Map([
    ['a13', { id: 'a13-functions', title: '普通函数、箭头函数与参数' }],
    ['p3-02', { id: 'p3-02-api-validation', title: '项目 3·接口与校验' }],
    ['e10', { id: 'e10-url-routing', title: 'URL、History 与基础路由' }],
  ]);
  const withRefs = (source: string, self?: string) => {
    setLessonRefs(refs, self);
    try {
      return renderMarkdown(source);
    } finally {
      setLessonRefs(undefined);
    }
  };

  test('简称：第一个“-”之前的部分；项目课时带上里程碑的编号', () => {
    expect(lessonShortId('a13-functions')).toBe('a13');
    expect(lessonShortId('p3-02-api-validation')).toBe('p3-02');
  });

  test('正文中的简称变成链接：相对地址、标题是课名', () => {
    expect(withRefs('函数的更多写法在 a13 详细讲（p3-02）。')).toBe(
      '<p>函数的更多写法在 <a href="./a13-functions" title="普通函数、箭头函数与参数" class="lesson-ref" data-lesson="a13-functions">a13</a> 详细讲（' +
        '<a href="./p3-02-api-validation" title="项目 3·接口与校验" class="lesson-ref" data-lesson="p3-02-api-validation">p3-02</a>）。</p>',
    );
  });

  test('代码、已有的链接、标题、本课自己、不存在的课时、更长的词中的一段都不加链接', () => {
    expect(withRefs('`a13` 和 [a13](https://example.com/a13)')).not.toContain('lesson-ref');
    expect(withRefs('## a13 的回顾')).not.toContain('lesson-ref');
    expect(withRefs('本课（a13）', 'a13-functions')).not.toContain('lesson-ref');
    expect(withRefs('见 b99、a11y、1e10、a13-functions 和 xa13')).not.toContain('lesson-ref');
    expect(withRefs('见 a13')).toContain('lesson-ref');
  });

  test('没有设置时不处理', () => {
    expect(renderMarkdown('见 a13')).toBe('<p>见 a13</p>');
  });
});
