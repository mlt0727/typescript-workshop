import { beforeEach, describe, expect, test } from 'vitest';
import { loadConversation, MAX_TURNS, saveConversation, type Turn } from './conversation.ts';

describe('每课一个 AI 对话', () => {
  beforeEach(() => localStorage.clear());

  test('保存后按课读出；不同的课互不影响；清空时删除', () => {
    const turns: Turn[] = [
      { role: 'user', content: '为什么？', attachment: '示例 · main.ts' },
      { role: 'assistant', content: '因为……', model: 'claude-sonnet-5-5' },
    ];
    saveConversation('a01', turns);
    expect(loadConversation('a01')).toEqual(turns);
    expect(loadConversation('a02')).toEqual([]);
    saveConversation('a01', []);
    expect(localStorage.getItem('tsw:ai-chat:a01')).toBeNull();
  });

  test('读出的内容只当作数据：坏的 JSON、不合格的条目被丢掉', () => {
    localStorage.setItem('tsw:ai-chat:a01', '{not json');
    expect(loadConversation('a01')).toEqual([]);
    localStorage.setItem('tsw:ai-chat:a01', JSON.stringify({ role: 'user' }));
    expect(loadConversation('a01')).toEqual([]);
    localStorage.setItem(
      'tsw:ai-chat:a01',
      JSON.stringify([{ role: 'system', content: 'x' }, { role: 'user', content: 1 }, null, { role: 'assistant', content: 'ok', model: 5, extra: '<img>' }]),
    );
    expect(loadConversation('a01')).toEqual([{ role: 'assistant', content: 'ok' }]);
  });

  test('只保留最近的对话', () => {
    const many: Turn[] = Array.from({ length: MAX_TURNS + 10 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: String(i) }));
    saveConversation('a01', many);
    const loaded = loadConversation('a01');
    expect(loaded).toHaveLength(MAX_TURNS);
    expect(loaded[0]?.content).toBe('10');
  });
});
