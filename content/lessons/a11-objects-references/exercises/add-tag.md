---
kind: challenge
title: 给文章加标签
---
实现 `addTag(post, tag)`：返回一篇**新的**文章对象，`tags` 末尾多了 `tag`。

- 如果 `tags` 中已经有完全相同的标签（区分大小写），不重复添加，返回的新文章的 `tags` 与原来内容相同；
- **不能修改**传入的 `post`，也不能修改它的 `tags` 数组；
- 返回的文章和它的 `tags` 都必须是新的对象和数组，即使没有添加新标签也是如此：调用方会继续修改返回的文章（例如接着添加别的标签），它必须和原数据完全独立。

:::files{role=starter}
```ts file=post.ts
export function addTag(
  post: { title: string; tags: string[] },
  tag: string,
): { title: string; tags: string[] } {
  const copy = { ...post };
  copy.tags.push(tag);
  return copy;
}

const post = { title: '学习 TypeScript', tags: ['ts'] };
const updated = addTag(post, '入门');
console.log(post, updated);
```
:::

:::files{role=solution}
```ts file=post.ts
export function addTag(
  post: { title: string; tags: string[] },
  tag: string,
): { title: string; tags: string[] } {
  const tags = [...post.tags];
  if (!tags.includes(tag)) {
    tags.push(tag);
  }
  return { ...post, tags: tags };
}

const post = { title: '学习 TypeScript', tags: ['ts'] };
const updated = addTag(post, '入门');
console.log(post, updated);
```
:::

:::files{role=tests}
```ts file=post.test.ts
import { describe, expect, test } from 'vitest';
import { addTag } from './post';

describe('addTag', () => {
  test('在末尾添加标签', () => {
    const post = { title: 'A', tags: ['ts', 'js'] };
    expect(addTag(post, '入门')).toEqual({ title: 'A', tags: ['ts', 'js', '入门'] });
  });

  test('不修改原文章和原标签数组', () => {
    const tags = ['ts'];
    const post = { title: 'A', tags: tags };
    addTag(post, 'react');
    expect(post).toEqual({ title: 'A', tags: ['ts'] });
    expect(post.tags).toBe(tags);
    expect(tags).toEqual(['ts']);
  });

  test('返回新的对象和新的数组', () => {
    const post = { title: 'A', tags: ['ts'] };
    const result = addTag(post, 'react');
    expect(result).not.toBe(post);
    expect(result.tags).not.toBe(post.tags);
  });

  test('已有的标签不重复添加，但仍然返回新的对象和数组', () => {
    const post = { title: 'A', tags: ['ts', 'js'] };
    const result = addTag(post, 'ts');
    expect(result).toEqual({ title: 'A', tags: ['ts', 'js'] });
    expect(result).not.toBe(post);
    expect(result.tags).not.toBe(post.tags);
  });

  test('区分大小写', () => {
    const post = { title: 'A', tags: ['ts'] };
    expect(addTag(post, 'TS').tags).toEqual(['ts', 'TS']);
  });
});
```
:::

:::hint{level=1}
起始代码复制了文章对象，但 `copy.tags` 和 `post.tags` 仍然是同一个数组。标签数组也要单独复制一份。
:::

:::hint{level=2}
`const tags = [...post.tags];` 复制数组；不包含 `tag` 时 `tags.push(tag)`；最后 `return { ...post, tags: tags };`。在对象展开后面写的属性会覆盖展开得到的同名属性。
:::

:::explanation
`{ ...post }` 是浅拷贝：新对象的 `tags` 属性仍然指向原来的数组，`copy.tags.push(tag)` 修改的就是调用方的数组。这是浅拷贝最常见的陷阱。

参考答案分两层复制：`[...post.tags]` 得到一个新数组，在新数组上 `push`；`{ ...post, tags: tags }` 得到一个新对象，并用新数组替换 `tags` 属性。原文章和原数组都没有被修改。

`structuredClone(post)` 一次深拷贝整篇文章也是正确的做法；不过当对象很大、只改动一小部分时，按需复制被修改的那一层更常见，React 等框架的状态更新就是这样做的（G 阶段会再遇到）。
:::

:::variant{kind=alt name=structured-clone}
```ts file=post.ts
export function addTag(
  post: { title: string; tags: string[] },
  tag: string,
): { title: string; tags: string[] } {
  const copy = structuredClone(post);
  if (!copy.tags.includes(tag)) {
    copy.tags.push(tag);
  }
  return copy;
}
```
:::

:::variant{kind=wrong name=shallow-only fails=tests reason="只复制了文章对象，标签数组仍然共享"}
```ts file=post.ts
export function addTag(
  post: { title: string; tags: string[] },
  tag: string,
): { title: string; tags: string[] } {
  const copy = { ...post };
  if (!copy.tags.includes(tag)) {
    copy.tags.push(tag);
  }
  return copy;
}
```
:::

:::variant{kind=wrong name=same-when-exists fails=tests reason="标签已存在时直接返回了原对象，调用方之后修改它会改动原数据"}
```ts file=post.ts
export function addTag(
  post: { title: string; tags: string[] },
  tag: string,
): { title: string; tags: string[] } {
  if (post.tags.includes(tag)) {
    return post;
  }
  return { ...post, tags: [...post.tags, tag] };
}
```
:::

:::variant{kind=wrong name=no-duplicate-check fails=tests reason="没有检查重复，已有的标签又被添加了一次"}
```ts file=post.ts
export function addTag(
  post: { title: string; tags: string[] },
  tag: string,
): { title: string; tags: string[] } {
  return { ...post, tags: [...post.tags, tag] };
}
```
:::
