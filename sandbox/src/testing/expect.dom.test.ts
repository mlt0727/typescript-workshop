import { describe, expect, test } from 'vitest';
import { expect as untypedExpect } from './expect.ts';

/** 平台的 expect 在沙箱中通过 sandbox/types/vitest.d.ts 获得类型，这里只声明测试用到的部分 */
type TextAssertion = { toHaveTextContent(text: string | RegExp): void };
const platformExpect = untypedExpect as unknown as (actual: unknown) => TextAssertion & { not: TextAssertion };

/** 平台 expect 的 DOM 匹配器应与 jest-dom 的行为一致 */
describe('toHaveTextContent', () => {
  function element(text: string): HTMLElement {
    const el = document.createElement('p');
    el.textContent = text;
    return el;
  }

  test('字符串是“包含”，正则是“匹配”', () => {
    expect(() => platformExpect(element('已保存 3 项')).toHaveTextContent('保存')).not.toThrow();
    expect(() => platformExpect(element('已保存')).toHaveTextContent(/^已保存$/)).not.toThrow();
    expect(() => platformExpect(element('已保存')).toHaveTextContent('删除')).toThrow();
  });

  test('用空字符串检查时，只有内容为空才通过（与 jest-dom 一致）', () => {
    expect(() => platformExpect(element('')).toHaveTextContent('')).not.toThrow();
    expect(() => platformExpect(element('已保存')).toHaveTextContent('')).toThrow(/toBeEmptyDOMElement/);
    expect(() => platformExpect(element('已保存')).not.toHaveTextContent('')).not.toThrow();
  });
});

describe('toHaveAccessibleDescription', () => {
  type DescriptionAssertion = { toHaveAccessibleDescription(description?: string | RegExp): void };
  const describedExpect = untypedExpect as unknown as (actual: unknown) => DescriptionAssertion & { not: DescriptionAssertion };

  test('按 aria-describedby 计算描述；不传参数时检查“有描述”', () => {
    document.body.innerHTML = '<div role="alertdialog" aria-describedby="d1 d2"><p id="d1">删除之后</p><p id="d2">无法恢复。</p></div><button>无描述</button>';
    const dialog = document.querySelector('[role="alertdialog"]');
    const button = document.querySelector('button');
    expect(() => describedExpect(dialog).toHaveAccessibleDescription('删除之后 无法恢复。')).not.toThrow();
    expect(() => describedExpect(dialog).toHaveAccessibleDescription(/无法恢复/)).not.toThrow();
    expect(() => describedExpect(dialog).toHaveAccessibleDescription()).not.toThrow();
    expect(() => describedExpect(dialog).toHaveAccessibleDescription('别的')).toThrow();
    expect(() => describedExpect(button).toHaveAccessibleDescription()).toThrow();
    expect(() => describedExpect(button).not.toHaveAccessibleDescription()).not.toThrow();
  });
});
