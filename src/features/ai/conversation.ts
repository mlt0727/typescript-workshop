/**
 * 每节课一个 AI 对话，保存在本机 localStorage（不跨设备同步）。
 * 读出来的内容只当作数据：逐项检查形状，不合格的丢掉；回答用 SafeMarkdown 显示。
 */

export interface Turn {
  role: 'user' | 'assistant';
  content: string;
  /** 用户的这条消息附带的代码块，例如“示例 · main.ts” */
  attachment?: string;
  /** 回答这条消息的模型 */
  model?: string;
}

const PREFIX = 'tsw:ai-chat:';
/** 只保留最近的这么多条，避免占满 localStorage */
export const MAX_TURNS = 60;
const MAX_CONTENT = 40_000;

function parseTurn(value: unknown): Turn | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const { role, content, attachment, model } = value as Record<string, unknown>;
  if ((role !== 'user' && role !== 'assistant') || typeof content !== 'string') return undefined;
  const turn: Turn = { role, content: content.slice(0, MAX_CONTENT) };
  if (typeof attachment === 'string') turn.attachment = attachment.slice(0, 200);
  if (typeof model === 'string') turn.model = model.slice(0, 100);
  return turn;
}

export function loadConversation(lessonId: string): Turn[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(PREFIX + lessonId) ?? '[]');
    if (!Array.isArray(value)) return [];
    return value.flatMap((v) => parseTurn(v) ?? []).slice(-MAX_TURNS);
  } catch {
    return [];
  }
}

export function saveConversation(lessonId: string, turns: readonly Turn[]): void {
  try {
    if (turns.length === 0) localStorage.removeItem(PREFIX + lessonId);
    else localStorage.setItem(PREFIX + lessonId, JSON.stringify(turns.slice(-MAX_TURNS)));
  } catch {
    // 存不下（隐私模式、空间满）时对话只在本次打开时有效
  }
}
