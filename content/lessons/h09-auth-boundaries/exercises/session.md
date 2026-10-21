---
kind: challenge
title: 签名的会话
---
在 `session.ts` 中实现 `timingSafeEqual(a, b)` 和 `createSessionCodec(secrets)`：把会话放进 cookie 时，用 HMAC-SHA256 签名，让服务器能确认它没有被改过。

真实的项目中用 `crypto.subtle`（浏览器、Node.js 和 Next.js 的 Proxy 中都有）或者 `node:crypto`。但练习的代码运行在一个不透明来源的沙箱中，在一些浏览器中（实测 Chromium）它不是安全上下文，**没有** `crypto.subtle`（见正文）。所以这里提供了只读的 `hmac-sha256.ts`：`hmacSha256(key, message)` 返回 32 个字节的签名，结果和 `crypto.subtle.sign('HMAC', …)` 完全一样。

1. **`timingSafeEqual(a, b)`**：两个字节数组长度相同、每个字节都相同时返回 `true`。不要在第一个不同的字节处提前返回：不管在哪里不同，都把所有的字节比较完；
2. **创建**：`secrets` 为空，或者其中任何一个少于 32 个字符时，抛出 `Error`；
3. **`sign(session)`**：令牌是 `payload.signature`。`payload` 是 `JSON.stringify(session)` 的 UTF-8 字节的 base64url 编码；`signature` 是用 `secrets[0]`（的 UTF-8 字节）对 **`payload` 这个字符串**（的 UTF-8 字节）计算的 HMAC-SHA256 的 base64url 编码。base64url 是把 base64 中的 `+` 换成 `-`、`/` 换成 `_`，并去掉末尾的 `=`；
4. **`verify(token, now)`**：任何不合格的情况都返回 `null`，不抛出错误：
   - `token` 不是正好两个非空的部分（用 `.` 分隔），或者某一部分含有 base64url 以外的字符，或者不能解码；
   - 签名和 `secrets` 中**任何一个**密钥算出的签名都不相同（用 `timingSafeEqual` 比较）；
   - `payload` 解码之后不是 JSON，或者不是合法的会话：`userId` 是非空的字符串，`role` 是 `'admin'`、`'member'`、`'viewer'` 之一，`expiresAt` 是有限的数字；
   - 已经过期：`now >= expiresAt`（单位都是秒）；

   都通过时返回会话。

:::files{role=support}
```ts file=hmac-sha256.ts readonly
/**
 * SHA-256（FIPS 180-4）和 HMAC-SHA256（RFC 2104）的一个简短的实现。
 * 只是因为练习的沙箱不是安全上下文、没有 crypto.subtle（见正文）；真实的项目中用 crypto.subtle 或者 node:crypto。
 */
const K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));

export function sha256(data: Uint8Array): Uint8Array<ArrayBuffer> {
  const h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  const length = Math.ceil((data.length + 9) / 64) * 64;
  const padded = new Uint8Array(length);
  padded.set(data);
  padded[data.length] = 0x80;
  const view = new DataView(padded.buffer);
  const bits = data.length * 8;
  view.setUint32(length - 8, Math.floor(bits / 0x100000000));
  view.setUint32(length - 4, bits >>> 0);

  const w = new Array<number>(64).fill(0);
  for (let offset = 0; offset < length; offset += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(offset + i * 4);
    for (let i = 16; i < 64; i++) {
      const w15 = w[i - 15] ?? 0;
      const w2 = w[i - 2] ?? 0;
      const s0 = rotr(w15, 7) ^ rotr(w15, 18) ^ (w15 >>> 3);
      const s1 = rotr(w2, 17) ^ rotr(w2, 19) ^ (w2 >>> 10);
      w[i] = ((w[i - 16] ?? 0) + s0 + (w[i - 7] ?? 0) + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, hh] = h.map((x) => x);
    a ??= 0;
    b ??= 0;
    c ??= 0;
    d ??= 0;
    e ??= 0;
    f ??= 0;
    g ??= 0;
    hh ??= 0;
    for (let i = 0; i < 64; i++) {
      const t1: number = (hh + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + (K[i] ?? 0) + (w[i] ?? 0)) >>> 0;
      const t2: number = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      hh = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }
    [a, b, c, d, e, f, g, hh].forEach((value, i) => {
      h[i] = ((h[i] ?? 0) + value) >>> 0;
    });
  }

  const out = new Uint8Array(32);
  const outView = new DataView(out.buffer);
  h.forEach((value, i) => outView.setUint32(i * 4, value));
  return out;
}

export function hmacSha256(key: Uint8Array, message: Uint8Array): Uint8Array<ArrayBuffer> {
  const block = new Uint8Array(64);
  block.set(key.length > 64 ? sha256(key) : key);
  const inner = new Uint8Array(64 + message.length);
  const outer = new Uint8Array(64 + 32);
  for (let i = 0; i < 64; i++) {
    const byte = block[i] ?? 0;
    inner[i] = byte ^ 0x36;
    outer[i] = byte ^ 0x5c;
  }
  inner.set(message, 64);
  outer.set(sha256(inner), 64);
  return sha256(outer);
}
```
:::

:::files{role=starter}
```ts file=session.ts
import { hmacSha256 } from './hmac-sha256';

export type Session = Readonly<{ userId: string; role: 'admin' | 'member' | 'viewer'; expiresAt: number }>;

export type SessionCodec = Readonly<{
  sign(session: Session): string;
  /** now 和 expiresAt 都是秒；任何不合格的令牌都返回 null，不抛出错误 */
  verify(token: string | undefined, now: number): Session | null;
}>;

/** 常数时间的比较：不管在哪一个字节不同，都把所有的字节比较完 */
export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  // TODO
  return false;
}

/** secrets[0] 用来签名；验证时依次尝试每一个，这样可以更换密钥而不让已经登录的人全部掉线 */
export function createSessionCodec(secrets: readonly string[]): SessionCodec {
  // TODO
  return {
    sign(session) {
      return JSON.stringify(session);
    },
    verify() {
      return null;
    },
  };
}
```
```ts file=main.ts readonly
import { createSessionCodec } from './session';

const codec = createSessionCodec(['current-secret-0123456789abcdefghij']);
const token = codec.sign({ userId: 'u1', role: 'member', expiresAt: 2_000_000_000 });
console.log('令牌：', token);

const now = Math.floor(Date.now() / 1000);
console.log('验证：', codec.verify(token, now));

// 把角色改成 admin，签名沿用原来的
const [payload = '', signature = ''] = token.split('.');
const decoded = JSON.parse(atob(payload.replaceAll('-', '+').replaceAll('_', '/')));
const forged = btoa(JSON.stringify({ ...decoded, role: 'admin' })).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
console.log('伪造：', codec.verify(`${forged}.${signature}`, now));
```
:::

:::files{role=solution}
```ts file=session.ts
import { hmacSha256 } from './hmac-sha256';

export type Session = Readonly<{ userId: string; role: 'admin' | 'member' | 'viewer'; expiresAt: number }>;

export type SessionCodec = Readonly<{
  sign(session: Session): string;
  /** now 和 expiresAt 都是秒；任何不合格的令牌都返回 null，不抛出错误 */
  verify(token: string | undefined, now: number): Session | null;
}>;

const encoder = new TextEncoder();
const BASE64URL = /^[A-Za-z0-9_-]+$/;

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text.replaceAll('-', '+').replaceAll('_', '/'));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

/** 常数时间的比较：不管在哪一个字节不同，都把所有的字节比较完 */
export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return difference === 0;
}

function isSession(value: unknown): value is Session {
  if (typeof value !== 'object' || value === null) return false;
  if (!('userId' in value) || typeof value.userId !== 'string' || value.userId === '') return false;
  if (!('role' in value) || (value.role !== 'admin' && value.role !== 'member' && value.role !== 'viewer')) return false;
  return 'expiresAt' in value && typeof value.expiresAt === 'number' && Number.isFinite(value.expiresAt);
}

/** secrets[0] 用来签名；验证时依次尝试每一个，这样可以更换密钥而不让已经登录的人全部掉线 */
export function createSessionCodec(secrets: readonly string[]): SessionCodec {
  if (secrets.length === 0 || secrets.some((secret) => secret.length < 32)) throw new Error('每个密钥至少要有 32 个字符');
  const keys = secrets.map((secret) => encoder.encode(secret));

  return {
    sign(session) {
      const [current] = keys;
      if (current === undefined) throw new Error('没有密钥');
      const payload = toBase64Url(encoder.encode(JSON.stringify(session)));
      return `${payload}.${toBase64Url(hmacSha256(current, encoder.encode(payload)))}`;
    },
    verify(token, now) {
      const parts = token?.split('.') ?? [];
      const [payload, signature] = parts;
      if (parts.length !== 2 || payload === undefined || signature === undefined) return null;
      if (!BASE64URL.test(payload) || !BASE64URL.test(signature)) return null;
      try {
        const signatureBytes = fromBase64Url(signature);
        const data = encoder.encode(payload);
        if (!keys.some((key) => timingSafeEqual(hmacSha256(key, data), signatureBytes))) return null;
        const value: unknown = JSON.parse(new TextDecoder().decode(fromBase64Url(payload)));
        if (!isSession(value) || now >= value.expiresAt) return null;
        return value;
      } catch {
        return null;
      }
    },
  };
}
```
```ts file=main.ts readonly
import { createSessionCodec } from './session';

const codec = createSessionCodec(['current-secret-0123456789abcdefghij']);
const token = codec.sign({ userId: 'u1', role: 'member', expiresAt: 2_000_000_000 });
console.log('令牌：', token);

const now = Math.floor(Date.now() / 1000);
console.log('验证：', codec.verify(token, now));

// 把角色改成 admin，签名沿用原来的
const [payload = '', signature = ''] = token.split('.');
const decoded = JSON.parse(atob(payload.replaceAll('-', '+').replaceAll('_', '/')));
const forged = btoa(JSON.stringify({ ...decoded, role: 'admin' })).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
console.log('伪造：', codec.verify(`${forged}.${signature}`, now));
```
:::

:::files{role=tests}
```ts file=session.test.ts
import { describe, expect, test } from 'vitest';
import { hmacSha256 } from './hmac-sha256';
import { createSessionCodec, timingSafeEqual, type Session } from './session';

const CURRENT = 'current-secret-0123456789abcdefghij';
const PREVIOUS = 'previous-secret-0123456789abcdefgh';
const NOW = 1_800_000_000;
const session: Session = { userId: 'u1', role: 'member', expiresAt: 2_000_000_000 };

/** 用 Node.js 的 crypto.subtle 和 Buffer 的 base64url 算出来的结果：格式要完全一致 */
const EXPECTED = 'eyJ1c2VySWQiOiJ1MSIsInJvbGUiOiJtZW1iZXIiLCJleHBpcmVzQXQiOjIwMDAwMDAwMDB9.KDBHhMfQV5kvzqbp77k1-x0jFXPpGuGXDgn7HVG9EZU';

const toBase64Url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');

/** 测试自己签一个任意内容的令牌（不经过 sign），用来构造“签名正确、内容不对”的情况 */
function signRaw(text: string, secret = CURRENT): string {
  const encoder = new TextEncoder();
  const payload = toBase64Url(encoder.encode(text));
  return `${payload}.${toBase64Url(hmacSha256(encoder.encode(secret), encoder.encode(payload)))}`;
}

/** 把令牌的第一部分解码回 JSON：签名不是加密，谁都能读 */
const decodePayload = (token: string) => JSON.parse(new TextDecoder().decode(Uint8Array.from(atob((token.split('.')[0] ?? '').replaceAll('-', '+').replaceAll('_', '/')), (c) => c.charCodeAt(0))));

describe('timingSafeEqual', () => {
  test('相同的字节：true；任何一个字节不同或者长度不同：false', () => {
    expect(timingSafeEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3]))).toBe(true);
    expect(timingSafeEqual(new Uint8Array([]), new Uint8Array([]))).toBe(true);
    expect(timingSafeEqual(new Uint8Array([1, 2, 3]), new Uint8Array([9, 2, 3]))).toBe(false);
    expect(timingSafeEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 9]))).toBe(false);
    expect(timingSafeEqual(new Uint8Array([1, 2]), new Uint8Array([1, 2, 3]))).toBe(false);
    expect(timingSafeEqual(new Uint8Array([1, 2, 0]), new Uint8Array([1, 2]))).toBe(false);
  });
});

describe('createSessionCodec', () => {
  test('签名：base64url 的 JSON 加上一个点和 base64url 的 HMAC-SHA256，没有 = 填充', () => {
    expect(createSessionCodec([CURRENT]).sign(session)).toBe(EXPECTED);
  });

  test('签名之后能验证回来；中文的 userId 也一样', () => {
    const codec = createSessionCodec([CURRENT]);
    expect(codec.verify(codec.sign(session), NOW)).toStrictEqual(session);
    const chinese: Session = { userId: '张三', role: 'admin', expiresAt: 2_000_000_000 };
    const token = codec.sign(chinese);
    expect(token).toBe('eyJ1c2VySWQiOiLlvKDkuIkiLCJyb2xlIjoiYWRtaW4iLCJleHBpcmVzQXQiOjIwMDAwMDAwMDB9.H_cIoxOV8xY9WPygiZxIFRBuVuqaVEubgKfoc6pLPE4');
    expect(codec.verify(token, NOW)).toStrictEqual(chinese);
  });

  test('签名不是加密：令牌中的内容谁都能读出来', () => {
    expect(decodePayload(createSessionCodec([CURRENT]).sign(session))).toStrictEqual(session);
  });

  test('改了内容或者签名：无效', () => {
    const codec = createSessionCodec([CURRENT]);
    const [, signature] = EXPECTED.split('.');
    const forged = toBase64Url(new TextEncoder().encode(JSON.stringify({ ...session, role: 'admin' })));
    expect(codec.verify(`${forged}.${signature ?? ''}`, NOW)).toBeNull();
    expect(codec.verify(`${EXPECTED.slice(0, -2)}AA`, NOW)).toBeNull();
    // 签名少了最后几个字节：长度不同也不能通过
    expect(codec.verify(EXPECTED.slice(0, -4), NOW)).toBeNull();
  });

  test('别的密钥签的：无效', () => {
    const other = createSessionCodec(['another-secret-0123456789abcdefghij']);
    expect(createSessionCodec([CURRENT]).verify(other.sign(session), NOW)).toBeNull();
  });

  test('更换密钥：用新的密钥签名，旧的密钥签的令牌在列表中仍然有效', () => {
    const oldToken = createSessionCodec([PREVIOUS]).sign(session);
    const rotated = createSessionCodec([CURRENT, PREVIOUS]);
    expect(rotated.verify(oldToken, NOW)).toStrictEqual(session);
    expect(rotated.sign(session)).toBe(EXPECTED);
    expect(createSessionCodec([CURRENT]).verify(oldToken, NOW)).toBeNull();
  });

  test('过期：now 到达 expiresAt 就无效', () => {
    const codec = createSessionCodec([CURRENT]);
    expect(codec.verify(EXPECTED, 1_999_999_999)).toStrictEqual(session);
    expect(codec.verify(EXPECTED, 2_000_000_000)).toBeNull();
  });

  test('格式不对：无效，不抛出错误', () => {
    const codec = createSessionCodec([CURRENT]);
    for (const token of [undefined, '', 'abc', '.', 'abc.', '.abc', 'a.b.c', `${EXPECTED}.x`, '!!!.###', 'e30=.abc', 'ab cd.ef', 'a.b']) {
      expect(codec.verify(token, NOW), String(token)).toBeNull();
    }
  });

  test('签名正确，但内容不是合法的会话：无效', () => {
    const codec = createSessionCodec([CURRENT]);
    const bad = [
      { userId: '', role: 'member', expiresAt: 2e9 },
      { userId: 'u1', role: 'root', expiresAt: 2e9 },
      { userId: 'u1', role: 'member' },
      { userId: 'u1', role: 'member', expiresAt: '2000000000' },
      null,
      ['u1'],
    ];
    for (const value of bad) {
      expect(codec.verify(signRaw(JSON.stringify(value)), NOW), JSON.stringify(value)).toBeNull();
    }
    expect(codec.verify(signRaw('不是 JSON'), NOW)).toBeNull();
    // 同样的方法签一个合法的会话：可以通过，说明上面失败的原因是内容
    expect(codec.verify(signRaw(JSON.stringify(session)), NOW)).toStrictEqual(session);
  });

  test('没有密钥，或者密钥太短：创建时就报错', () => {
    expect(() => createSessionCodec([])).toThrow();
    expect(() => createSessionCodec(['short'])).toThrow();
    expect(() => createSessionCodec([CURRENT, 'short'])).toThrow();
  });
});
```
:::

:::hint{level=1}
`timingSafeEqual`：长度不同直接返回 `false`（长度不是秘密）；长度相同时，把每一对字节的异或（`^`）用 `|=` 累积到一个变量中，最后看它是不是 0。base64url 的编码：把字节一个一个变成字符（`String.fromCharCode`），`btoa`，再替换那三个字符；字符串变成字节用 `new TextEncoder().encode(text)`。
:::

:::hint{level=2}
`verify` 中先检查格式（`split('.')` 的长度、`/^[A-Za-z0-9_-]+$/`），再把解码、比较签名、`JSON.parse` 都放在一个 `try` 中：`atob` 遇到长度不对的输入会抛出错误。会话的检查写成一个类型守卫 `isSession(value: unknown): value is Session`。
:::

:::explanation
签名让服务器可以把数据交给浏览器保管，又不怕它被改：只有知道密钥的人才能算出正确的签名，改了 `payload` 中的任何一个字符，签名就对不上了。正文中实测：把 cookie 中的角色改成 `admin`、沿用原来的签名，Proxy 把请求重定向到了登录页。

但签名**不是加密**：`payload` 只是 base64 编码，任何人都能解码读出来（正文中实测用 `base64 -d` 就读出了 `userId` 和 `role`）。会话中不要放敏感的信息；需要保密时用加密的格式（例如 JWE，或者 iron-session 这样的库），或者只在 cookie 中放一个随机的会话 id，数据留在数据库中。

比较签名不能用 `===`，也不能用“发现不同就返回”的循环：比较一发现不同就停下，花的时间会泄漏“前几个字节对了”，攻击者可以一个字节一个字节地猜（时序攻击）。`timingSafeEqual` 不管在哪里不同都比较完所有的字节。真实的项目中不用自己写：`crypto.subtle.verify` 内部就是这样比较的，Node.js 有 `crypto.timingSafeEqual`（这个网站的同步功能校验密码时用的就是它）。长度可以提前比较，因为 HMAC-SHA256 的长度是公开的 32 个字节；但不能只比较两者中较短的那一段，否则一个截短的签名也能通过。

多个密钥是为了**更换密钥**：新的令牌用新的密钥签名，旧的密钥留在列表中一段时间，已经登录的人不会全部掉线；等旧的令牌都过期了，再把旧的密钥去掉。

真实的项目中，用经过审查的库（jose、iron-session，或者 Auth.js、Better Auth 这样的完整方案），不要自己实现这些。这个练习是为了看清楚这些库在做什么。

替代解的 `timingSafeEqual` 不提前比较长度，而是把较短的一边当作补了 0，再把长度的差异也记进结果中；验证时对每一个密钥都算一遍（不在第一个通过时停下），并在返回时重新构造会话对象，不带上 `payload` 中多余的字段。
:::

:::variant{kind=alt name=check-all-keys}
```ts file=session.ts
import { hmacSha256 } from './hmac-sha256';

export type Session = Readonly<{ userId: string; role: 'admin' | 'member' | 'viewer'; expiresAt: number }>;

export type SessionCodec = Readonly<{
  sign(session: Session): string;
  /** now 和 expiresAt 都是秒；任何不合格的令牌都返回 null，不抛出错误 */
  verify(token: string | undefined, now: number): Session | null;
}>;

const ROLES: readonly unknown[] = ['admin', 'member', 'viewer'];

/** base64url 和普通 base64 只差两个字符和末尾的 = */
const base64url = {
  encode(bytes: Uint8Array): string {
    return btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join('')).replace(/[+/=]/g, (c) => (c === '+' ? '-' : c === '/' ? '_' : ''));
  },
  decode(text: string): Uint8Array<ArrayBuffer> | null {
    if (!/^[\w-]+$/.test(text)) return null;
    const binary = atob(text.replace(/[-_]/g, (c) => (c === '-' ? '+' : '/')));
    return Uint8Array.from(binary, (c) => c.charCodeAt(0));
  },
};

/** 常数时间的比较：先把两边补成一样长，结果中同时记下长度是否相同 */
export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  const length = Math.max(a.length, b.length);
  let difference = a.length ^ b.length;
  for (let i = 0; i < length; i++) difference |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return difference === 0;
}

/** secrets[0] 用来签名；验证时任何一个密钥通过都可以 */
export function createSessionCodec(secrets: readonly string[]): SessionCodec {
  const [first] = secrets;
  if (first === undefined || secrets.some((s) => s.length < 32)) throw new Error('每个密钥至少要有 32 个字符');
  const mac = (secret: string, text: string) => hmacSha256(new TextEncoder().encode(secret), new TextEncoder().encode(text));

  return {
    sign(session) {
      const payload = base64url.encode(new TextEncoder().encode(JSON.stringify(session)));
      return `${payload}.${base64url.encode(mac(first, payload))}`;
    },
    verify(token, now) {
      const parts = (token ?? '').split('.');
      if (parts.length !== 2) return null;
      const [payload = '', signature = ''] = parts;
      try {
        // 长度不对的 base64 会让 atob 抛出错误：也在 try 中
        const payloadBytes = base64url.decode(payload);
        const signatureBytes = base64url.decode(signature);
        if (payloadBytes === null || signatureBytes === null) return null;
        // 每个密钥都算一遍，不在第一个通过时提前结束
        const results = secrets.map((secret) => timingSafeEqual(mac(secret, payload), signatureBytes));
        if (!results.includes(true)) return null;
        const value: unknown = JSON.parse(new TextDecoder().decode(payloadBytes));
        if (typeof value !== 'object' || value === null) return null;
        const userId: unknown = Reflect.get(value, 'userId');
        const role: unknown = Reflect.get(value, 'role');
        const expiresAt: unknown = Reflect.get(value, 'expiresAt');
        if (typeof userId !== 'string' || userId === '' || !ROLES.includes(role) || typeof expiresAt !== 'number' || !Number.isFinite(expiresAt)) return null;
        if (role !== 'admin' && role !== 'member' && role !== 'viewer') return null;
        return now < expiresAt ? { userId, role, expiresAt } : null;
      } catch {
        return null;
      }
    },
  };
}
```
:::

:::variant{kind=wrong name=no-signature-check fails=tests reason="没有验证签名：任何人都可以自己写一个令牌，把角色改成 admin"}
```ts file=session.ts
import { hmacSha256 } from './hmac-sha256';

export type Session = Readonly<{ userId: string; role: 'admin' | 'member' | 'viewer'; expiresAt: number }>;

export type SessionCodec = Readonly<{
  sign(session: Session): string;
  /** now 和 expiresAt 都是秒；任何不合格的令牌都返回 null，不抛出错误 */
  verify(token: string | undefined, now: number): Session | null;
}>;

const encoder = new TextEncoder();
const BASE64URL = /^[A-Za-z0-9_-]+$/;

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text.replaceAll('-', '+').replaceAll('_', '/'));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

/** 常数时间的比较：不管在哪一个字节不同，都把所有的字节比较完 */
export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return difference === 0;
}

function isSession(value: unknown): value is Session {
  if (typeof value !== 'object' || value === null) return false;
  if (!('userId' in value) || typeof value.userId !== 'string' || value.userId === '') return false;
  if (!('role' in value) || (value.role !== 'admin' && value.role !== 'member' && value.role !== 'viewer')) return false;
  return 'expiresAt' in value && typeof value.expiresAt === 'number' && Number.isFinite(value.expiresAt);
}

/** secrets[0] 用来签名；验证时依次尝试每一个，这样可以更换密钥而不让已经登录的人全部掉线 */
export function createSessionCodec(secrets: readonly string[]): SessionCodec {
  if (secrets.length === 0 || secrets.some((secret) => secret.length < 32)) throw new Error('每个密钥至少要有 32 个字符');
  const keys = secrets.map((secret) => encoder.encode(secret));

  return {
    sign(session) {
      const [current] = keys;
      if (current === undefined) throw new Error('没有密钥');
      const payload = toBase64Url(encoder.encode(JSON.stringify(session)));
      return `${payload}.${toBase64Url(hmacSha256(current, encoder.encode(payload)))}`;
    },
    verify(token, now) {
      const parts = token?.split('.') ?? [];
      const [payload, signature] = parts;
      if (parts.length !== 2 || payload === undefined || signature === undefined) return null;
      if (!BASE64URL.test(payload) || !BASE64URL.test(signature)) return null;
      try {
        const signatureBytes = fromBase64Url(signature);
        const data = encoder.encode(payload);
        const value: unknown = JSON.parse(new TextDecoder().decode(fromBase64Url(payload)));
        if (!isSession(value) || now >= value.expiresAt) return null;
        return value;
      } catch {
        return null;
      }
    },
  };
}
```
:::

:::variant{kind=wrong name=first-key-only fails=tests reason="只用第一个密钥验证：更换密钥之后，所有已经登录的人都掉线了"}
```ts file=session.ts
import { hmacSha256 } from './hmac-sha256';

export type Session = Readonly<{ userId: string; role: 'admin' | 'member' | 'viewer'; expiresAt: number }>;

export type SessionCodec = Readonly<{
  sign(session: Session): string;
  /** now 和 expiresAt 都是秒；任何不合格的令牌都返回 null，不抛出错误 */
  verify(token: string | undefined, now: number): Session | null;
}>;

const encoder = new TextEncoder();
const BASE64URL = /^[A-Za-z0-9_-]+$/;

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text.replaceAll('-', '+').replaceAll('_', '/'));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

/** 常数时间的比较：不管在哪一个字节不同，都把所有的字节比较完 */
export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return difference === 0;
}

function isSession(value: unknown): value is Session {
  if (typeof value !== 'object' || value === null) return false;
  if (!('userId' in value) || typeof value.userId !== 'string' || value.userId === '') return false;
  if (!('role' in value) || (value.role !== 'admin' && value.role !== 'member' && value.role !== 'viewer')) return false;
  return 'expiresAt' in value && typeof value.expiresAt === 'number' && Number.isFinite(value.expiresAt);
}

/** secrets[0] 用来签名；验证时依次尝试每一个，这样可以更换密钥而不让已经登录的人全部掉线 */
export function createSessionCodec(secrets: readonly string[]): SessionCodec {
  if (secrets.length === 0 || secrets.some((secret) => secret.length < 32)) throw new Error('每个密钥至少要有 32 个字符');
  const keys = secrets.map((secret) => encoder.encode(secret));

  return {
    sign(session) {
      const [current] = keys;
      if (current === undefined) throw new Error('没有密钥');
      const payload = toBase64Url(encoder.encode(JSON.stringify(session)));
      return `${payload}.${toBase64Url(hmacSha256(current, encoder.encode(payload)))}`;
    },
    verify(token, now) {
      const parts = token?.split('.') ?? [];
      const [payload, signature] = parts;
      if (parts.length !== 2 || payload === undefined || signature === undefined) return null;
      if (!BASE64URL.test(payload) || !BASE64URL.test(signature)) return null;
      try {
        const signatureBytes = fromBase64Url(signature);
        const data = encoder.encode(payload);
        if (!keys.slice(0, 1).some((key) => timingSafeEqual(hmacSha256(key, data), signatureBytes))) return null;
        const value: unknown = JSON.parse(new TextDecoder().decode(fromBase64Url(payload)));
        if (!isSession(value) || now >= value.expiresAt) return null;
        return value;
      } catch {
        return null;
      }
    },
  };
}
```
:::

:::variant{kind=wrong name=sign-with-last fails=tests reason="用最后一个密钥签名：新的令牌用的是正要淘汰的旧密钥"}
```ts file=session.ts
import { hmacSha256 } from './hmac-sha256';

export type Session = Readonly<{ userId: string; role: 'admin' | 'member' | 'viewer'; expiresAt: number }>;

export type SessionCodec = Readonly<{
  sign(session: Session): string;
  /** now 和 expiresAt 都是秒；任何不合格的令牌都返回 null，不抛出错误 */
  verify(token: string | undefined, now: number): Session | null;
}>;

const encoder = new TextEncoder();
const BASE64URL = /^[A-Za-z0-9_-]+$/;

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text.replaceAll('-', '+').replaceAll('_', '/'));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

/** 常数时间的比较：不管在哪一个字节不同，都把所有的字节比较完 */
export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return difference === 0;
}

function isSession(value: unknown): value is Session {
  if (typeof value !== 'object' || value === null) return false;
  if (!('userId' in value) || typeof value.userId !== 'string' || value.userId === '') return false;
  if (!('role' in value) || (value.role !== 'admin' && value.role !== 'member' && value.role !== 'viewer')) return false;
  return 'expiresAt' in value && typeof value.expiresAt === 'number' && Number.isFinite(value.expiresAt);
}

/** secrets[0] 用来签名；验证时依次尝试每一个，这样可以更换密钥而不让已经登录的人全部掉线 */
export function createSessionCodec(secrets: readonly string[]): SessionCodec {
  if (secrets.length === 0 || secrets.some((secret) => secret.length < 32)) throw new Error('每个密钥至少要有 32 个字符');
  const keys = secrets.map((secret) => encoder.encode(secret));

  return {
    sign(session) {
      const current = keys.at(-1);
      if (current === undefined) throw new Error('没有密钥');
      const payload = toBase64Url(encoder.encode(JSON.stringify(session)));
      return `${payload}.${toBase64Url(hmacSha256(current, encoder.encode(payload)))}`;
    },
    verify(token, now) {
      const parts = token?.split('.') ?? [];
      const [payload, signature] = parts;
      if (parts.length !== 2 || payload === undefined || signature === undefined) return null;
      if (!BASE64URL.test(payload) || !BASE64URL.test(signature)) return null;
      try {
        const signatureBytes = fromBase64Url(signature);
        const data = encoder.encode(payload);
        if (!keys.some((key) => timingSafeEqual(hmacSha256(key, data), signatureBytes))) return null;
        const value: unknown = JSON.parse(new TextDecoder().decode(fromBase64Url(payload)));
        if (!isSession(value) || now >= value.expiresAt) return null;
        return value;
      } catch {
        return null;
      }
    },
  };
}
```
:::

:::variant{kind=wrong name=expiry-inclusive fails=tests reason="到达 expiresAt 的那一秒仍然有效：过期的时间应该是第一个无效的时刻"}
```ts file=session.ts
import { hmacSha256 } from './hmac-sha256';

export type Session = Readonly<{ userId: string; role: 'admin' | 'member' | 'viewer'; expiresAt: number }>;

export type SessionCodec = Readonly<{
  sign(session: Session): string;
  /** now 和 expiresAt 都是秒；任何不合格的令牌都返回 null，不抛出错误 */
  verify(token: string | undefined, now: number): Session | null;
}>;

const encoder = new TextEncoder();
const BASE64URL = /^[A-Za-z0-9_-]+$/;

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text.replaceAll('-', '+').replaceAll('_', '/'));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

/** 常数时间的比较：不管在哪一个字节不同，都把所有的字节比较完 */
export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return difference === 0;
}

function isSession(value: unknown): value is Session {
  if (typeof value !== 'object' || value === null) return false;
  if (!('userId' in value) || typeof value.userId !== 'string' || value.userId === '') return false;
  if (!('role' in value) || (value.role !== 'admin' && value.role !== 'member' && value.role !== 'viewer')) return false;
  return 'expiresAt' in value && typeof value.expiresAt === 'number' && Number.isFinite(value.expiresAt);
}

/** secrets[0] 用来签名；验证时依次尝试每一个，这样可以更换密钥而不让已经登录的人全部掉线 */
export function createSessionCodec(secrets: readonly string[]): SessionCodec {
  if (secrets.length === 0 || secrets.some((secret) => secret.length < 32)) throw new Error('每个密钥至少要有 32 个字符');
  const keys = secrets.map((secret) => encoder.encode(secret));

  return {
    sign(session) {
      const [current] = keys;
      if (current === undefined) throw new Error('没有密钥');
      const payload = toBase64Url(encoder.encode(JSON.stringify(session)));
      return `${payload}.${toBase64Url(hmacSha256(current, encoder.encode(payload)))}`;
    },
    verify(token, now) {
      const parts = token?.split('.') ?? [];
      const [payload, signature] = parts;
      if (parts.length !== 2 || payload === undefined || signature === undefined) return null;
      if (!BASE64URL.test(payload) || !BASE64URL.test(signature)) return null;
      try {
        const signatureBytes = fromBase64Url(signature);
        const data = encoder.encode(payload);
        if (!keys.some((key) => timingSafeEqual(hmacSha256(key, data), signatureBytes))) return null;
        const value: unknown = JSON.parse(new TextDecoder().decode(fromBase64Url(payload)));
        if (!isSession(value) || now > value.expiresAt) return null;
        return value;
      } catch {
        return null;
      }
    },
  };
}
```
:::

:::variant{kind=wrong name=no-shape-check fails=tests reason="签名正确就相信内容：签名只说明是你签的，签的时候内容可能就有问题（例如一个旧版本的格式）"}
```ts file=session.ts
import { hmacSha256 } from './hmac-sha256';

export type Session = Readonly<{ userId: string; role: 'admin' | 'member' | 'viewer'; expiresAt: number }>;

export type SessionCodec = Readonly<{
  sign(session: Session): string;
  /** now 和 expiresAt 都是秒；任何不合格的令牌都返回 null，不抛出错误 */
  verify(token: string | undefined, now: number): Session | null;
}>;

const encoder = new TextEncoder();
const BASE64URL = /^[A-Za-z0-9_-]+$/;

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text.replaceAll('-', '+').replaceAll('_', '/'));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

/** 常数时间的比较：不管在哪一个字节不同，都把所有的字节比较完 */
export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return difference === 0;
}

function isSession(value: unknown): value is Session {
  if (typeof value !== 'object' || value === null) return false;
  if (!('userId' in value) || typeof value.userId !== 'string' || value.userId === '') return false;
  if (!('role' in value) || (value.role !== 'admin' && value.role !== 'member' && value.role !== 'viewer')) return false;
  return 'expiresAt' in value && typeof value.expiresAt === 'number' && Number.isFinite(value.expiresAt);
}

/** secrets[0] 用来签名；验证时依次尝试每一个，这样可以更换密钥而不让已经登录的人全部掉线 */
export function createSessionCodec(secrets: readonly string[]): SessionCodec {
  if (secrets.length === 0 || secrets.some((secret) => secret.length < 32)) throw new Error('每个密钥至少要有 32 个字符');
  const keys = secrets.map((secret) => encoder.encode(secret));

  return {
    sign(session) {
      const [current] = keys;
      if (current === undefined) throw new Error('没有密钥');
      const payload = toBase64Url(encoder.encode(JSON.stringify(session)));
      return `${payload}.${toBase64Url(hmacSha256(current, encoder.encode(payload)))}`;
    },
    verify(token, now) {
      const parts = token?.split('.') ?? [];
      const [payload, signature] = parts;
      if (parts.length !== 2 || payload === undefined || signature === undefined) return null;
      if (!BASE64URL.test(payload) || !BASE64URL.test(signature)) return null;
      try {
        const signatureBytes = fromBase64Url(signature);
        const data = encoder.encode(payload);
        if (!keys.some((key) => timingSafeEqual(hmacSha256(key, data), signatureBytes))) return null;
        const value: unknown = JSON.parse(new TextDecoder().decode(fromBase64Url(payload)));
        if (typeof value !== 'object' || value === null || !('expiresAt' in value) || typeof value.expiresAt !== 'number' || now >= value.expiresAt) return null;
        return { userId: String(Reflect.get(value, 'userId')), role: 'member', expiresAt: value.expiresAt };
      } catch {
        return null;
      }
    },
  };
}
```
:::

:::variant{kind=wrong name=base64-padding fails=tests reason="保留了 base64 末尾的 =：= 在 cookie 中要转义，格式也和约定的不一样"}
```ts file=session.ts
import { hmacSha256 } from './hmac-sha256';

export type Session = Readonly<{ userId: string; role: 'admin' | 'member' | 'viewer'; expiresAt: number }>;

export type SessionCodec = Readonly<{
  sign(session: Session): string;
  /** now 和 expiresAt 都是秒；任何不合格的令牌都返回 null，不抛出错误 */
  verify(token: string | undefined, now: number): Session | null;
}>;

const encoder = new TextEncoder();
const BASE64URL = /^[A-Za-z0-9_-]+$/;

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_');
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text.replaceAll('-', '+').replaceAll('_', '/'));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

/** 常数时间的比较：不管在哪一个字节不同，都把所有的字节比较完 */
export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return difference === 0;
}

function isSession(value: unknown): value is Session {
  if (typeof value !== 'object' || value === null) return false;
  if (!('userId' in value) || typeof value.userId !== 'string' || value.userId === '') return false;
  if (!('role' in value) || (value.role !== 'admin' && value.role !== 'member' && value.role !== 'viewer')) return false;
  return 'expiresAt' in value && typeof value.expiresAt === 'number' && Number.isFinite(value.expiresAt);
}

/** secrets[0] 用来签名；验证时依次尝试每一个，这样可以更换密钥而不让已经登录的人全部掉线 */
export function createSessionCodec(secrets: readonly string[]): SessionCodec {
  if (secrets.length === 0 || secrets.some((secret) => secret.length < 32)) throw new Error('每个密钥至少要有 32 个字符');
  const keys = secrets.map((secret) => encoder.encode(secret));

  return {
    sign(session) {
      const [current] = keys;
      if (current === undefined) throw new Error('没有密钥');
      const payload = toBase64Url(encoder.encode(JSON.stringify(session)));
      return `${payload}.${toBase64Url(hmacSha256(current, encoder.encode(payload)))}`;
    },
    verify(token, now) {
      const parts = token?.split('.') ?? [];
      const [payload, signature] = parts;
      if (parts.length !== 2 || payload === undefined || signature === undefined) return null;
      if (!BASE64URL.test(payload) || !BASE64URL.test(signature)) return null;
      try {
        const signatureBytes = fromBase64Url(signature);
        const data = encoder.encode(payload);
        if (!keys.some((key) => timingSafeEqual(hmacSha256(key, data), signatureBytes))) return null;
        const value: unknown = JSON.parse(new TextDecoder().decode(fromBase64Url(payload)));
        if (!isSession(value) || now >= value.expiresAt) return null;
        return value;
      } catch {
        return null;
      }
    },
  };
}
```
:::

:::variant{kind=wrong name=short-secrets-ok fails=tests reason="接受太短的密钥：短的密钥可以被暴力猜出来"}
```ts file=session.ts
import { hmacSha256 } from './hmac-sha256';

export type Session = Readonly<{ userId: string; role: 'admin' | 'member' | 'viewer'; expiresAt: number }>;

export type SessionCodec = Readonly<{
  sign(session: Session): string;
  /** now 和 expiresAt 都是秒；任何不合格的令牌都返回 null，不抛出错误 */
  verify(token: string | undefined, now: number): Session | null;
}>;

const encoder = new TextEncoder();
const BASE64URL = /^[A-Za-z0-9_-]+$/;

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text.replaceAll('-', '+').replaceAll('_', '/'));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

/** 常数时间的比较：不管在哪一个字节不同，都把所有的字节比较完 */
export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return difference === 0;
}

function isSession(value: unknown): value is Session {
  if (typeof value !== 'object' || value === null) return false;
  if (!('userId' in value) || typeof value.userId !== 'string' || value.userId === '') return false;
  if (!('role' in value) || (value.role !== 'admin' && value.role !== 'member' && value.role !== 'viewer')) return false;
  return 'expiresAt' in value && typeof value.expiresAt === 'number' && Number.isFinite(value.expiresAt);
}

/** secrets[0] 用来签名；验证时依次尝试每一个，这样可以更换密钥而不让已经登录的人全部掉线 */
export function createSessionCodec(secrets: readonly string[]): SessionCodec {
  if (secrets.length === 0) throw new Error('每个密钥至少要有 32 个字符');
  const keys = secrets.map((secret) => encoder.encode(secret));

  return {
    sign(session) {
      const [current] = keys;
      if (current === undefined) throw new Error('没有密钥');
      const payload = toBase64Url(encoder.encode(JSON.stringify(session)));
      return `${payload}.${toBase64Url(hmacSha256(current, encoder.encode(payload)))}`;
    },
    verify(token, now) {
      const parts = token?.split('.') ?? [];
      const [payload, signature] = parts;
      if (parts.length !== 2 || payload === undefined || signature === undefined) return null;
      if (!BASE64URL.test(payload) || !BASE64URL.test(signature)) return null;
      try {
        const signatureBytes = fromBase64Url(signature);
        const data = encoder.encode(payload);
        if (!keys.some((key) => timingSafeEqual(hmacSha256(key, data), signatureBytes))) return null;
        const value: unknown = JSON.parse(new TextDecoder().decode(fromBase64Url(payload)));
        if (!isSession(value) || now >= value.expiresAt) return null;
        return value;
      } catch {
        return null;
      }
    },
  };
}
```
:::

:::variant{kind=wrong name=prefix-compare fails=tests reason="只比较两者中较短的那一段：签名被截短之后也能通过验证"}
```ts file=session.ts
import { hmacSha256 } from './hmac-sha256';

export type Session = Readonly<{ userId: string; role: 'admin' | 'member' | 'viewer'; expiresAt: number }>;

export type SessionCodec = Readonly<{
  sign(session: Session): string;
  /** now 和 expiresAt 都是秒；任何不合格的令牌都返回 null，不抛出错误 */
  verify(token: string | undefined, now: number): Session | null;
}>;

const encoder = new TextEncoder();
const BASE64URL = /^[A-Za-z0-9_-]+$/;

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text.replaceAll('-', '+').replaceAll('_', '/'));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

/** 常数时间的比较：不管在哪一个字节不同，都把所有的字节比较完 */
export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  let difference = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) difference |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return difference === 0;
}

function isSession(value: unknown): value is Session {
  if (typeof value !== 'object' || value === null) return false;
  if (!('userId' in value) || typeof value.userId !== 'string' || value.userId === '') return false;
  if (!('role' in value) || (value.role !== 'admin' && value.role !== 'member' && value.role !== 'viewer')) return false;
  return 'expiresAt' in value && typeof value.expiresAt === 'number' && Number.isFinite(value.expiresAt);
}

/** secrets[0] 用来签名；验证时依次尝试每一个，这样可以更换密钥而不让已经登录的人全部掉线 */
export function createSessionCodec(secrets: readonly string[]): SessionCodec {
  if (secrets.length === 0 || secrets.some((secret) => secret.length < 32)) throw new Error('每个密钥至少要有 32 个字符');
  const keys = secrets.map((secret) => encoder.encode(secret));

  return {
    sign(session) {
      const [current] = keys;
      if (current === undefined) throw new Error('没有密钥');
      const payload = toBase64Url(encoder.encode(JSON.stringify(session)));
      return `${payload}.${toBase64Url(hmacSha256(current, encoder.encode(payload)))}`;
    },
    verify(token, now) {
      const parts = token?.split('.') ?? [];
      const [payload, signature] = parts;
      if (parts.length !== 2 || payload === undefined || signature === undefined) return null;
      if (!BASE64URL.test(payload) || !BASE64URL.test(signature)) return null;
      try {
        const signatureBytes = fromBase64Url(signature);
        const data = encoder.encode(payload);
        if (!keys.some((key) => timingSafeEqual(hmacSha256(key, data), signatureBytes))) return null;
        const value: unknown = JSON.parse(new TextDecoder().decode(fromBase64Url(payload)));
        if (!isSession(value) || now >= value.expiresAt) return null;
        return value;
      } catch {
        return null;
      }
    },
  };
}
```
:::

