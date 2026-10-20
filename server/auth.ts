/**
 * 单用户同步密码校验。服务器只保存密码的 SHA-256 哈希（环境变量 SYNC_PASSWORD_HASH），
 * 用常数时间比较。密码由部署者随机生成（约 125 位熵），因此不需要慢哈希。
 */
import crypto from 'node:crypto';

export function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password, 'utf8').digest('hex');
}

export function bearerToken(request: Request): string | undefined {
  const header = request.headers.get('authorization') ?? '';
  const m = /^Bearer\s+(.+)$/i.exec(header.trim());
  return m?.[1]?.trim() || undefined;
}

/** 返回 true 表示密码正确。expectedHash 为空时一律拒绝。 */
export function verifyPassword(password: string | undefined, expectedHash: string | undefined): boolean {
  if (!password || !expectedHash || !/^[0-9a-f]{64}$/i.test(expectedHash)) return false;
  const actual = Buffer.from(hashPassword(password), 'hex');
  const expected = Buffer.from(expectedHash.toLowerCase(), 'hex');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

/** 生成同步密码：tsw-XXXX-XXXX-XXXX-XXXX-XXXX-X（Crockford Base32，去掉易混淆字符，约 125 位熵） */
export function generatePassword(): string {
  const alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  const bytes = crypto.randomBytes(25);
  const chars = [...bytes].map((b) => alphabet[b % 32]).join('');
  return `tsw-${chars.match(/.{1,5}/g)!.join('-')}`;
}
