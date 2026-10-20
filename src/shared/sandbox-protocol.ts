/**
 * 主页面 ⇄ 沙箱 iframe 的消息协议。双方都用这些 schema 校验收到的每一条消息。
 *
 * 安全约定（详见 docs/SPEC.md §6）：
 * - iframe 只接受来自 window.parent 的第一条合法 init 消息，之后只通过专属 MessagePort 通信；
 * - 主页面从不处理 window 上的 message 事件，只处理绑定在该 frame 上的 port；
 * - 每条运行相关消息都带 runId，过期运行的消息被丢弃。
 */
import { z } from 'zod';
import { LIMITS } from './limits.ts';

export { LIMITS };

export const PROTOCOL_VERSION = 1;

const runId = z.string().min(1).max(64);
const shortText = z.string().max(LIMITS.maxLogEntryChars);

export const runModuleSchema = z.object({
  id: z.string().max(300),
  path: z.string().max(260),
  kind: z.enum(['js', 'css']),
  code: z.string().max(LIMITS.maxModuleBytes),
  map: z.string().max(LIMITS.maxModuleBytes * 2).optional(),
  deps: z.array(z.string().max(300)).max(LIMITS.maxModules),
});

export const runBundleSchema = z.object({
  nonce: z.string().regex(/^[a-z0-9]{6,32}$/),
  modules: z.array(runModuleSchema).max(LIMITS.maxModules),
  entries: z.array(z.string().max(300)).max(16),
  externalDeps: z.array(z.string().max(100)).max(16),
  missing: z.array(z.object({ from: z.string().max(260), specifier: z.string().max(300) })).max(64),
});

export const fetchFixtureSchema = z.object({
  method: z.string().max(10).optional(),
  url: z.string().max(500),
  status: z.number().int().min(100).max(599).optional(),
  statusText: z.string().max(100).optional(),
  headers: z.record(z.string().max(100), z.string().max(1000)).optional(),
  /** JSON 值（会被序列化）或字符串 */
  body: z.unknown().optional(),
  delayMs: z.number().int().min(0).max(10_000).optional(),
  /** 模拟网络失败（fetch 直接 reject） */
  networkError: z.boolean().optional(),
});
export type FetchFixture = z.infer<typeof fetchFixtureSchema>;

export const pageSchema = z.object({
  /** 学生的 index.html（DOM 模式）；React 模式可省略，默认 <div id="root"></div> */
  html: z.string().max(LIMITS.maxModuleBytes).optional(),
  /** index.html 中通过 <link> 引用的 CSS 文件内容：路径 → 内容 */
  css: z.record(z.string().max(260), z.string().max(LIMITS.maxModuleBytes)),
});

const mode = z.enum(['ts', 'dom', 'react']);

export const hostToSandboxSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('run'),
    runId,
    mode,
    bundle: runBundleSchema,
    page: pageSchema.optional(),
    timeoutMs: z.number().int().min(100).max(60_000),
    fixtures: z.array(fetchFixtureSchema).max(50).optional(),
  }),
  z.object({
    type: z.literal('test'),
    runId,
    mode,
    bundle: runBundleSchema,
    /** bundle.entries 中哪些是测试文件（其余为学生入口，DOM 模式在每个测试前重新执行） */
    testEntries: z.array(z.string().max(300)).max(16),
    page: pageSchema.optional(),
    timeoutMs: z.number().int().min(100).max(120_000),
    perTestTimeoutMs: z.number().int().min(50).max(30_000),
    fixtures: z.array(fetchFixtureSchema).max(50).optional(),
  }),
  z.object({ type: z.literal('stop'), runId }),
  z.object({ type: z.literal('ping'), nonce: z.string().max(64) }),
]);
export type HostToSandbox = z.infer<typeof hostToSandboxSchema>;

export const serializedErrorSchema = z.object({
  name: z.string().max(200),
  message: shortText,
  /** 已映射到源文件位置的调用栈（可能为空） */
  stack: z.string().max(20_000).optional(),
  location: z
    .object({ file: z.string().max(260), line: z.number().int(), column: z.number().int() })
    .optional(),
});
export type SerializedError = z.infer<typeof serializedErrorSchema>;

export const logEntrySchema = z.object({
  level: z.enum(['log', 'info', 'warn', 'error', 'debug', 'system']),
  text: shortText,
  /** 相对运行开始的毫秒数 */
  t: z.number(),
});
export type LogEntry = z.infer<typeof logEntrySchema>;

export const testResultSchema = z.object({
  name: z.string().max(1000),
  status: z.enum(['pass', 'fail', 'skip']),
  durationMs: z.number(),
  error: z
    .object({
      message: shortText,
      expected: shortText.optional(),
      actual: shortText.optional(),
      location: z
        .object({ file: z.string().max(260), line: z.number().int(), column: z.number().int() })
        .optional(),
    })
    .optional(),
});
export type TestResult = z.infer<typeof testResultSchema>;

export const runStatusSchema = z.enum(['running', 'done', 'error', 'timeout', 'stopped']);
export type RunStatus = z.infer<typeof runStatusSchema>;

export const sandboxToHostSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('ready'), sessionId: z.string().max(64), protocol: z.literal(PROTOCOL_VERSION) }),
  z.object({ type: z.literal('pong'), nonce: z.string().max(64) }),
  z.object({ type: z.literal('logs'), runId, entries: z.array(logEntrySchema).max(100) }),
  z.object({
    type: z.literal('status'),
    runId,
    status: runStatusSchema,
    error: serializedErrorSchema.optional(),
    /** 例如“仍有 1 个计时器在运行” */
    note: z.string().max(500).optional(),
    /** 本次运行用到了哪些模拟能力（用于在界面上标注“模拟”） */
    simulated: z.array(z.enum(['fetch', 'localStorage', 'sessionStorage', 'alert'])).max(4).optional(),
  }),
  z.object({
    type: z.literal('tests'),
    runId,
    results: z.array(testResultSchema).max(LIMITS.maxTests),
    /** 测试文件加载失败等全局错误 */
    error: serializedErrorSchema.optional(),
  }),
]);
export type SandboxToHost = z.infer<typeof sandboxToHostSchema>;

export const initMessageSchema = z.object({
  type: z.literal('tsw:init'),
  sessionId: z.string().regex(/^[a-z0-9]{8,64}$/),
  protocol: z.literal(PROTOCOL_VERSION),
  /** 需要额外加载的运行时（React 模式需要 react） */
  runtimes: z.array(z.enum(['react'])).max(2),
});
export type InitMessage = z.infer<typeof initMessageSchema>;
