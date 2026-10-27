/**
 * 服务端的错误日志：每条一行 JSON（课程 i03 的写法）。
 * 错误只记录 name、message 和 cause；环境变量中密钥的值在任何字符串中都换成 [REDACTED]；
 * 只记录路径，不记录查询参数和请求头。不管传进来什么都不抛出错误。
 */

const REDACTED = '[REDACTED]';
const MAX_LENGTH = 500;
const MAX_CAUSES = 5;

/** 不能出现在日志中的值：数据库连接串（其中的密码单独再列一次）、同步密码的哈希、API 密钥 */
export function secretsFromEnv(env: Record<string, string | undefined>): string[] {
  const values = [env.DATABASE_URL, env.SYNC_PASSWORD_HASH, env.ANTHROPIC_API_KEY];
  if (env.DATABASE_URL) {
    try {
      // 驱动的错误信息中可能只有密码，也可能是编码前或编码后的写法
      const { password } = new URL(env.DATABASE_URL);
      values.push(password, decodeURIComponent(password));
    } catch {
      // 不是网址：整串已经在列表中
    }
  }
  // 太短的值会把普通的文字也替换掉；长的先替换，一个密钥包含另一个时不会只替换一半
  return [...new Set(values)].filter((v): v is string => typeof v === 'string' && v.length >= 8).toSorted((a, b) => b.length - a.length);
}

function scrub(text: string, secrets: readonly string[]): string {
  let result = text;
  for (const secret of secrets) result = result.replaceAll(secret, REDACTED);
  // 先替换再截断：截断的地方落在密钥中间时也不会漏出一半
  const chars = [...result];
  return chars.length > MAX_LENGTH ? `${chars.slice(0, MAX_LENGTH).join('')}…（共 ${chars.length} 个字符）` : result;
}

function describe(error: unknown, secrets: readonly string[], depth: number): unknown {
  try {
    if (error instanceof Error) {
      const result: Record<string, unknown> = { name: scrub(String(error.name), secrets), message: scrub(String(error.message), secrets) };
      if (error.cause !== undefined) result.cause = depth < MAX_CAUSES ? describe(error.cause, secrets, depth + 1) : '[Too deep]';
      return result;
    }
    // 抛出的不是 Error（字符串、对象等）
    return scrub(String(error), secrets);
  } catch {
    return '[Unreadable]';
  }
}

/** 一个请求出错时的一行日志 */
export function formatErrorLog(request: Request, error: unknown, secrets: readonly string[], time = new Date()): string {
  let method = 'UNKNOWN';
  let path = '';
  try {
    method = request.method;
    path = scrub(new URL(request.url).pathname, secrets);
  } catch {
    // 读不出来的请求也要留下这一行
  }
  return JSON.stringify({ time: time.toISOString(), level: 'error', message: `${method} ${path} 出错`, method, path, error: describe(error, secrets, 0) });
}
