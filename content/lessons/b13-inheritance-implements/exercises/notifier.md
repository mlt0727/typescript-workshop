---
kind: challenge
title: 用接口组合通知渠道
---
一个通知系统可以通过不同的渠道发送消息。用接口描述“渠道”这种能力，再用**组合**（而不是继承）把多个渠道组装起来。已经给出的类型：

```ts
type Contact = { email?: string; phone?: string };

interface Channel {
  readonly name: string;
  send(contact: Contact, message: string): boolean;
}
```

实现三个类：

**`EmailChannel implements Channel`**：`name` 为 `'email'`。`send` 在 `contact.email` 存在并且包含 `@` 时“发送”成功：把 `{ to: email, message }` 记入私有的发件箱，返回 `true`；否则返回 `false`。`sent()` 返回发件箱记录的**副本**。

**`SmsChannel implements Channel`**：`name` 为 `'sms'`。`send` 在 `contact.phone` 正好是 11 位数字、并且 `message` 不超过 70 个字符时成功：记录 `{ to: phone, message }`，返回 `true`；否则返回 `false`。同样提供 `sent()`。

**`Notifier`**：构造函数接收一个渠道数组 `readonly Channel[]`。`notify(contact, message)` 依次尝试**每一个**渠道，返回发送成功的渠道名称数组（按渠道顺序）。某个渠道抛出异常时，当作发送失败，继续尝试后面的渠道。

:::files{role=starter}
```ts file=notify.ts
export type Contact = { email?: string; phone?: string };

export interface Channel {
  readonly name: string;
  send(contact: Contact, message: string): boolean;
}

export type Sent = { to: string; message: string };

export class EmailChannel implements Channel {}

export class SmsChannel implements Channel {}

export class Notifier {}
```
:::

:::files{role=solution}
```ts file=notify.ts
export type Contact = { email?: string; phone?: string };

export interface Channel {
  readonly name: string;
  send(contact: Contact, message: string): boolean;
}

export type Sent = { to: string; message: string };

export class EmailChannel implements Channel {
  readonly name = 'email';
  #outbox: Sent[] = [];

  send(contact: Contact, message: string): boolean {
    const email = contact.email;
    if (email === undefined || !email.includes('@')) {
      return false;
    }
    this.#outbox.push({ to: email, message });
    return true;
  }

  sent(): Sent[] {
    return [...this.#outbox];
  }
}

function isDigits(text: string): boolean {
  return [...text].every((ch) => ch >= '0' && ch <= '9');
}

export class SmsChannel implements Channel {
  readonly name = 'sms';
  #outbox: Sent[] = [];

  send(contact: Contact, message: string): boolean {
    const phone = contact.phone;
    if (phone === undefined || phone.length !== 11 || !isDigits(phone) || message.length > 70) {
      return false;
    }
    this.#outbox.push({ to: phone, message });
    return true;
  }

  sent(): Sent[] {
    return [...this.#outbox];
  }
}

export class Notifier {
  readonly #channels: readonly Channel[];

  constructor(channels: readonly Channel[]) {
    this.#channels = [...channels];
  }

  notify(contact: Contact, message: string): string[] {
    const delivered: string[] = [];
    for (const channel of this.#channels) {
      let ok = false;
      try {
        ok = channel.send(contact, message);
      } catch {
        ok = false;
      }
      if (ok) {
        delivered.push(channel.name);
      }
    }
    return delivered;
  }
}
```
:::

:::files{role=tests}
```ts file=notify.test.ts
import { describe, expect, test } from 'vitest';
import { EmailChannel, Notifier, SmsChannel, type Channel } from './notify';

describe('EmailChannel', () => {
  test('有效的邮箱', () => {
    const email = new EmailChannel();
    expect(email.name).toBe('email');
    expect(email.send({ email: 'ada@example.com' }, '你好')).toBe(true);
    expect(email.sent()).toEqual([{ to: 'ada@example.com', message: '你好' }]);
  });

  test('无效或缺失的邮箱', () => {
    const email = new EmailChannel();
    expect(email.send({}, 'x')).toBe(false);
    expect(email.send({ email: 'ada.example.com' }, 'x')).toBe(false);
    expect(email.sent()).toEqual([]);
  });

  test('sent 返回副本', () => {
    const email = new EmailChannel();
    email.send({ email: 'a@b' }, 'm');
    email.sent().push({ to: 'x', message: 'y' });
    expect(email.sent()).toHaveLength(1);
  });
});

describe('SmsChannel', () => {
  test('有效的手机号和长度', () => {
    const sms = new SmsChannel();
    expect(sms.send({ phone: '13800138000' }, '验证码 1234')).toBe(true);
    expect(sms.sent()).toEqual([{ to: '13800138000', message: '验证码 1234' }]);
  });

  test('手机号必须是 11 位数字', () => {
    const sms = new SmsChannel();
    expect(sms.send({ phone: '1380013800' }, 'x')).toBe(false);
    expect(sms.send({ phone: '1380013800a' }, 'x')).toBe(false);
    expect(sms.send({}, 'x')).toBe(false);
  });

  test('短信不能超过 70 个字符', () => {
    const sms = new SmsChannel();
    expect(sms.send({ phone: '13800138000' }, '字'.repeat(70))).toBe(true);
    expect(sms.send({ phone: '13800138000' }, '字'.repeat(71))).toBe(false);
  });
});

describe('Notifier', () => {
  test('依次尝试每个渠道，返回成功的名称', () => {
    const notifier = new Notifier([new EmailChannel(), new SmsChannel()]);
    expect(notifier.notify({ email: 'a@b', phone: '13800138000' }, '上线了')).toEqual(['email', 'sms']);
    expect(notifier.notify({ phone: '13800138000' }, '上线了')).toEqual(['sms']);
    expect(notifier.notify({}, '上线了')).toEqual([]);
  });

  test('任何形状相符的对象都可以作为渠道', () => {
    const log: string[] = [];
    const console2: Channel = {
      name: 'log',
      send: (contact, message) => {
        log.push(`${contact.email ?? '?'}:${message}`);
        return true;
      },
    };
    expect(new Notifier([console2]).notify({ email: 'x@y' }, 'hi')).toEqual(['log']);
    expect(log).toEqual(['x@y:hi']);
  });

  test('抛出异常的渠道当作失败，不影响后面的渠道', () => {
    const broken: Channel = {
      name: 'broken',
      send: () => {
        throw new Error('网络断开');
      },
    };
    const notifier = new Notifier([broken, new EmailChannel()]);
    expect(notifier.notify({ email: 'a@b' }, 'm')).toEqual(['email']);
  });

  test('构造后修改传入的数组不影响 Notifier', () => {
    const channels: Channel[] = [new EmailChannel()];
    const notifier = new Notifier(channels);
    channels.push(new SmsChannel());
    expect(notifier.notify({ email: 'a@b', phone: '13800138000' }, 'm')).toEqual(['email']);
  });
});
```
:::

:::hint{level=1}
两个渠道类结构相同：一个 `readonly name`，一个 `#outbox` 数组，`send` 先检查联系方式再记录，`sent()` 返回副本。`Notifier` 保存一份渠道数组的副本，`notify` 用 `for...of` 遍历，每个渠道的调用用 `try/catch` 包起来。
:::

:::hint{level=2}
判断“全是数字”可以用 `[...phone].every((ch) => ch >= '0' && ch <= '9')`。注意 `implements` 不会给方法参数提供类型，`send(contact: Contact, message: string): boolean` 的参数类型要自己写。`notify` 不能在第一个成功的渠道之后停下，每个渠道都要尝试。
:::

:::explanation
`Channel` 接口只描述“能发送消息”这一能力。`EmailChannel` 和 `SmsChannel` 各自实现它，`Notifier` 则通过**组合**——持有一组 `Channel`——获得发送能力，而不是继承某个渠道类。要增加一种新渠道，只需再写一个满足接口的类（甚至一个普通对象，见测试中的 `console2`），`Notifier` 不需要修改。

测试里的普通对象没有写 `implements`，也能当作 `Channel` 使用：结构化类型下，`implements` 只是让类在声明处就接受检查。

每个渠道的调用都包在 `try/catch` 里：一个渠道出问题，不应该影响其他渠道。构造函数复制渠道数组，避免调用方之后的修改改变 `Notifier` 的行为（a11）。
:::

:::variant{kind=alt name=functional-notify}
```ts file=notify.ts
export type Contact = { email?: string; phone?: string };

export interface Channel {
  readonly name: string;
  send(contact: Contact, message: string): boolean;
}

export type Sent = { to: string; message: string };

abstract class RecordingChannel implements Channel {
  abstract readonly name: string;
  #outbox: Sent[] = [];

  protected abstract address(contact: Contact, message: string): string | null;

  send(contact: Contact, message: string): boolean {
    const to = this.address(contact, message);
    if (to === null) return false;
    this.#outbox.push({ to, message });
    return true;
  }

  sent(): Sent[] {
    return this.#outbox.map((s) => ({ ...s }));
  }
}

export class EmailChannel extends RecordingChannel {
  readonly name = 'email';
  protected address(contact: Contact): string | null {
    return contact.email?.includes('@') ? contact.email : null;
  }
}

export class SmsChannel extends RecordingChannel {
  readonly name = 'sms';
  protected address(contact: Contact, message: string): string | null {
    const phone = contact.phone ?? '';
    const valid = phone.length === 11 && [...phone].every((c) => '0123456789'.includes(c));
    return valid && message.length <= 70 ? phone : null;
  }
}

export class Notifier {
  readonly #channels: Channel[];

  constructor(channels: readonly Channel[]) {
    this.#channels = channels.slice();
  }

  notify(contact: Contact, message: string): string[] {
    return this.#channels
      .filter((channel) => {
        try {
          return channel.send(contact, message);
        } catch {
          return false;
        }
      })
      .map((channel) => channel.name);
  }
}
```
:::

:::variant{kind=wrong name=stop-at-first fails=tests reason="第一个渠道成功后就停止了"}
```ts file=notify.ts
export type Contact = { email?: string; phone?: string };

export interface Channel {
  readonly name: string;
  send(contact: Contact, message: string): boolean;
}

export type Sent = { to: string; message: string };

export class EmailChannel implements Channel {
  readonly name = 'email';
  #outbox: Sent[] = [];
  send(contact: Contact, message: string): boolean {
    if (contact.email === undefined || !contact.email.includes('@')) return false;
    this.#outbox.push({ to: contact.email, message });
    return true;
  }
  sent(): Sent[] {
    return [...this.#outbox];
  }
}

export class SmsChannel implements Channel {
  readonly name = 'sms';
  #outbox: Sent[] = [];
  send(contact: Contact, message: string): boolean {
    const phone = contact.phone;
    if (phone === undefined || phone.length !== 11 || ![...phone].every((c) => c >= '0' && c <= '9') || message.length > 70) return false;
    this.#outbox.push({ to: phone, message });
    return true;
  }
  sent(): Sent[] {
    return [...this.#outbox];
  }
}

export class Notifier {
  readonly #channels: readonly Channel[];
  constructor(channels: readonly Channel[]) {
    this.#channels = [...channels];
  }
  notify(contact: Contact, message: string): string[] {
    for (const channel of this.#channels) {
      try {
        if (channel.send(contact, message)) return [channel.name];
      } catch {
        // 忽略
      }
    }
    return [];
  }
}
```
:::

:::variant{kind=wrong name=no-try fails=tests reason="没有捕获渠道抛出的异常"}
```ts file=notify.ts
export type Contact = { email?: string; phone?: string };

export interface Channel {
  readonly name: string;
  send(contact: Contact, message: string): boolean;
}

export type Sent = { to: string; message: string };

export class EmailChannel implements Channel {
  readonly name = 'email';
  #outbox: Sent[] = [];
  send(contact: Contact, message: string): boolean {
    if (contact.email === undefined || !contact.email.includes('@')) return false;
    this.#outbox.push({ to: contact.email, message });
    return true;
  }
  sent(): Sent[] {
    return [...this.#outbox];
  }
}

export class SmsChannel implements Channel {
  readonly name = 'sms';
  #outbox: Sent[] = [];
  send(contact: Contact, message: string): boolean {
    const phone = contact.phone;
    if (phone === undefined || phone.length !== 11 || ![...phone].every((c) => c >= '0' && c <= '9') || message.length > 70) return false;
    this.#outbox.push({ to: phone, message });
    return true;
  }
  sent(): Sent[] {
    return [...this.#outbox];
  }
}

export class Notifier {
  readonly #channels: readonly Channel[];
  constructor(channels: readonly Channel[]) {
    this.#channels = [...channels];
  }
  notify(contact: Contact, message: string): string[] {
    return this.#channels.filter((c) => c.send(contact, message)).map((c) => c.name);
  }
}
```
:::

:::variant{kind=wrong name=untyped-params fails=types reason="以为 implements 会提供参数类型，send 的参数没有写类型"}
```ts file=notify.ts
export type Contact = { email?: string; phone?: string };

export interface Channel {
  readonly name: string;
  send(contact: Contact, message: string): boolean;
}

export type Sent = { to: string; message: string };

export class EmailChannel implements Channel {
  readonly name = 'email';
  #outbox: Sent[] = [];
  send(contact, message) {
    if (contact.email === undefined || !contact.email.includes('@')) return false;
    this.#outbox.push({ to: contact.email, message });
    return true;
  }
  sent(): Sent[] {
    return [...this.#outbox];
  }
}

export class SmsChannel implements Channel {
  readonly name = 'sms';
  #outbox: Sent[] = [];
  send(contact, message) {
    const phone = contact.phone;
    if (phone === undefined || phone.length !== 11 || message.length > 70) return false;
    this.#outbox.push({ to: phone, message });
    return true;
  }
  sent(): Sent[] {
    return [...this.#outbox];
  }
}

export class Notifier {
  readonly #channels: readonly Channel[];
  constructor(channels: readonly Channel[]) {
    this.#channels = [...channels];
  }
  notify(contact: Contact, message: string): string[] {
    const ok: string[] = [];
    for (const c of this.#channels) {
      try {
        if (c.send(contact, message)) ok.push(c.name);
      } catch {
        // 忽略
      }
    }
    return ok;
  }
}
```
:::

:::variant{kind=wrong name=leak-outbox fails=tests reason="sent() 直接返回了内部数组"}
```ts file=notify.ts
export type Contact = { email?: string; phone?: string };

export interface Channel {
  readonly name: string;
  send(contact: Contact, message: string): boolean;
}

export type Sent = { to: string; message: string };

export class EmailChannel implements Channel {
  readonly name = 'email';
  #outbox: Sent[] = [];
  send(contact: Contact, message: string): boolean {
    if (contact.email === undefined || !contact.email.includes('@')) return false;
    this.#outbox.push({ to: contact.email, message });
    return true;
  }
  sent(): Sent[] {
    return this.#outbox;
  }
}

export class SmsChannel implements Channel {
  readonly name = 'sms';
  #outbox: Sent[] = [];
  send(contact: Contact, message: string): boolean {
    const phone = contact.phone;
    if (phone === undefined || phone.length !== 11 || ![...phone].every((c) => c >= '0' && c <= '9') || message.length > 70) return false;
    this.#outbox.push({ to: phone, message });
    return true;
  }
  sent(): Sent[] {
    return this.#outbox;
  }
}

export class Notifier {
  readonly #channels: readonly Channel[];
  constructor(channels: readonly Channel[]) {
    this.#channels = [...channels];
  }
  notify(contact: Contact, message: string): string[] {
    const ok: string[] = [];
    for (const c of this.#channels) {
      try {
        if (c.send(contact, message)) ok.push(c.name);
      } catch {
        // 忽略
      }
    }
    return ok;
  }
}
```
:::
