/**
 * 可选的“问 AI”：服务端用学习者配置的 ANTHROPIC_API_KEY 调用 Claude，流式返回中文解答。
 * 密钥只存在于服务器环境变量中，浏览器永远拿不到；调用需要同步密码。
 */
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';

export const DEFAULT_MODEL = 'claude-opus-5-5';

export const askSchema = z.object({
  lessonId: z.string().max(100),
  lessonTitle: z.string().max(200),
  blockTitle: z.string().max(200).optional(),
  /** 当前步骤附近的讲解（纯文本） */
  context: z.string().max(12_000).optional(),
  mode: z.enum(['ts', 'dom', 'react']),
  files: z.record(z.string().max(200), z.string().max(40_000)).refine((f) => Object.keys(f).length <= 12, '文件太多'),
  diagnostics: z.array(z.string().max(2000)).max(30),
  output: z.array(z.string().max(2000)).max(40),
  /** 判题结果摘要（如果有） */
  result: z.string().max(6000).optional(),
  question: z.string().min(1).max(4000),
  history: z
    .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(12_000) }))
    .max(12)
    .optional(),
});
export type AskInput = z.infer<typeof askSchema>;

const SYSTEM = `你是「TypeScript 工坊」里的学习助手。学习者已经会 Python、Java、C++，但没有系统学过 JavaScript；他们正在一节交互式课程里写 TypeScript。

回答规则：
- 用简体中文回答；重要术语第一次出现时附英文（例如“类型收窄（narrowing）”）；代码标识符保持英文。
- 先解释“为什么”：指出问题的根本原因、相关的语言规则，必要时与 Python/Java/C++ 做准确对比。
- 学习者在做练习时，默认先给思路与关键提示，不要直接给出完整的参考答案代码；只有学习者明确要求完整答案时才给。
- 只陈述你确信正确的事实。不确定时直接说不确定，并建议查阅官方文档（TypeScript Handbook、MDN、React 官方文档等）。不要编造 API、编译选项或报错信息。
- 回答要短而准确：通常几段话加一小段示例代码即可。代码用 Markdown 代码块。

平台运行环境（回答时以此为准）：
- 编译器是 TypeScript 6.0.3，strict 模式，target ES2025，开启 noUncheckedIndexedAccess、verbatimModuleSyntax、erasableSyntaxOnly（所以不能用 enum、namespace、构造函数参数属性）。
- “纯 TypeScript”模式的代码运行在浏览器的 Web Worker 里：没有 document/DOM；console.log 的输出格式与 Node.js 一致。
- “网页（DOM）”和“React”模式运行在隔离的沙箱 iframe 里；React 版本 19.3。
- 练习中的 fetch、localStorage、alert 都是平台模拟的；沙箱不能访问网络。`;

function buildUserMessage(input: AskInput): string {
  const parts: string[] = [];
  parts.push(`课程：${input.lessonTitle}（${input.lessonId}）${input.blockTitle ? `；当前位置：${input.blockTitle}` : ''}；运行模式：${input.mode}`);
  if (input.context) parts.push(`<lesson_context>\n${input.context}\n</lesson_context>`);
  for (const [path, content] of Object.entries(input.files)) {
    parts.push(`<file path="${path}">\n${content}\n</file>`);
  }
  if (input.diagnostics.length) parts.push(`<type_errors>\n${input.diagnostics.join('\n')}\n</type_errors>`);
  if (input.output.length) parts.push(`<run_output>\n${input.output.join('\n')}\n</run_output>`);
  if (input.result) parts.push(`<judge_result>\n${input.result}\n</judge_result>`);
  parts.push(`学习者的问题：${input.question}`);
  return parts.join('\n\n');
}

export interface AiConfig {
  apiKey?: string;
  model: string;
  effort: 'low' | 'medium' | 'high' | 'xhigh' | 'max';
}

export function aiConfigFromEnv(env: Record<string, string | undefined>): AiConfig {
  const effort = env.AI_EFFORT;
  return {
    apiKey: env.ANTHROPIC_API_KEY || undefined,
    model: env.AI_MODEL || DEFAULT_MODEL,
    effort: effort === 'low' || effort === 'high' || effort === 'xhigh' || effort === 'max' ? effort : 'medium',
  };
}

/** 返回一个纯文本流（UTF-8），边生成边发送。 */
export function streamAnswer(config: AiConfig, input: AskInput, signal: AbortSignal): ReadableStream<Uint8Array> {
  const client = new Anthropic({ apiKey: config.apiKey });
  const encoder = new TextEncoder();
  const messages: Anthropic.Beta.BetaMessageParam[] = [];
  for (const h of input.history ?? []) messages.push({ role: h.role, content: h.content });
  messages.push({ role: 'user', content: buildUserMessage(input) });

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const stream = client.beta.messages.stream(
          {
            model: config.model,
            max_tokens: 8000,
            system: SYSTEM,
            messages,
            output_config: { effort: config.effort },
            // 安全分类器拒答时，由服务端自动换用推荐的后备模型重试
            betas: ['server-side-fallback-2026-07-01'],
            fallbacks: 'default',
          },
          { signal },
        );
        for await (const event of stream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        const final = await stream.finalMessage();
        if (final.stop_reason === 'refusal') {
          controller.enqueue(encoder.encode('\n\n（这个问题被模型的安全策略拒绝回答了。可以换一种问法，或查阅课程中的参考资料。）'));
        } else if (final.stop_reason === 'max_tokens') {
          controller.enqueue(encoder.encode('\n\n（回答太长被截断了，可以让我继续或缩小问题范围。）'));
        }
        controller.close();
      } catch (err) {
        let message = 'AI 服务暂时不可用，请稍后再试。';
        if (err instanceof Anthropic.AuthenticationError) message = 'AI 密钥无效：请检查服务器的 ANTHROPIC_API_KEY。';
        else if (err instanceof Anthropic.RateLimitError) message = 'AI 服务调用太频繁或额度不足，请稍后再试。';
        else if (err instanceof Anthropic.BadRequestError) message = `AI 请求被拒绝：${err.message}`;
        else if (err instanceof Anthropic.APIError) message = `AI 服务出错（HTTP ${err.status}）。`;
        else if (signal.aborted) message = '';
        if (message) controller.enqueue(encoder.encode(`\n\n[错误] ${message}`));
        controller.close();
      }
    },
  });
}
