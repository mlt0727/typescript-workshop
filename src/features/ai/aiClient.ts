/** “问 AI”客户端：密钥在服务器上，浏览器只携带同步密码调用 /api/ai。 */
import { syncManager } from '../sync/syncManager.ts';

export interface AiStatus {
  configured: boolean;
  model: string | null;
}

let statusPromise: Promise<AiStatus> | undefined;

export function getAiStatus(): Promise<AiStatus> {
  statusPromise ??= fetch(`${import.meta.env.BASE_URL}api/ai/status`, { cache: 'no-store' })
    .then(async (r) => {
      if (!r.ok) return { configured: false, model: null };
      const data = (await r.json()) as Partial<AiStatus>;
      return { configured: data.configured === true, model: typeof data.model === 'string' ? data.model : null };
    })
    .catch(() => ({ configured: false, model: null }));
  return statusPromise;
}

export interface AskPayload {
  lessonId: string;
  lessonTitle: string;
  blockTitle?: string;
  context?: string;
  mode: 'ts' | 'dom' | 'react';
  files: Record<string, string>;
  diagnostics: string[];
  output: string[];
  result?: string;
  question: string;
  history?: { role: 'user' | 'assistant'; content: string }[];
}

/** 流式提问：onText 收到增量文本。返回完整回答。 */
export async function askAi(payload: AskPayload, onText: (chunk: string) => void, signal: AbortSignal): Promise<string> {
  const password = syncManager.password;
  if (!password) throw new Error('请先在“设置 → 跨设备同步”中输入同步密码（问 AI 使用同一个密码）。');
  const res = await fetch(`${import.meta.env.BASE_URL}api/ai`, {
    method: 'POST',
    headers: { authorization: `Bearer ${password}`, 'content-type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      msg = ((await res.json()) as { error?: string }).error ?? msg;
    } catch {
      // ignore
    }
    throw new Error(msg);
  }
  if (!res.body) throw new Error('服务器没有返回内容');
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let full = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    full += value;
    onText(value);
  }
  return full;
}
