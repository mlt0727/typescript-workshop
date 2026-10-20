import {
  hostToSandboxSchema,
  PROTOCOL_VERSION,
  sandboxToHostSchema,
  VIEWPORT_LIMITS,
  type HostToSandbox,
  type SandboxToHost,
} from '../shared/sandbox-protocol.ts';

export function randomId(len = 16): string {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return [...bytes].map((b) => (b % 36).toString(36)).join('');
}

export const SANDBOX_ATTRS = 'allow-scripts allow-forms';

export interface FrameOptions {
  /** 放置 iframe 的容器；缺省时作为隐藏 iframe 放在 body 上 */
  container?: HTMLElement;
  runtimes: 'react'[];
  title: string;
}

/**
 * 一个沙箱 iframe 会话。
 * - iframe：sandbox="allow-scripts allow-forms"（无 allow-same-origin）→ 不透明来源；
 * - 通信只经由本会话专属的 MessageChannel；不监听 window 上的 message 事件；
 * - 收到的每条消息都用 schema 校验；iframe 一旦被导航离开（第二次 load）立即作废。
 */
export class SandboxFrame {
  readonly iframe: HTMLIFrameElement;
  readonly ready: Promise<void>;
  private port: MessagePort | undefined;
  private readonly listeners = new Set<(m: SandboxToHost) => void>();
  private readonly deathListeners = new Set<(reason: string) => void>();
  private dead = false;

  constructor(options: FrameOptions) {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('sandbox', SANDBOX_ATTRS);
    iframe.setAttribute('referrerpolicy', 'no-referrer');
    iframe.title = options.title;
    iframe.className = 'sandbox-frame';
    if (!options.container) {
      iframe.setAttribute('aria-hidden', 'true');
      iframe.tabIndex = -1;
      // 隐藏的 iframe 保持正常尺寸：布局、媒体查询与 page.viewport() 都依赖它。
      // 它留在视口内、位于页面内容之下并且完全透明：WebKit 会把视口之外的跨源 iframe 的计时器节流到每秒一次，
      // 测试中的 user-event 每输入一个字符都要等一秒多。
      Object.assign(iframe.style, {
        position: 'fixed',
        width: `${VIEWPORT_LIMITS.defaultWidth}px`,
        height: `${VIEWPORT_LIMITS.defaultHeight}px`,
        left: '0',
        top: '0',
        zIndex: '-1',
        border: '0',
        opacity: '0',
        pointerEvents: 'none',
      });
    }
    this.iframe = iframe;
    const sessionId = randomId(20);

    this.ready = new Promise<void>((resolve, reject) => {
      let loads = 0;
      const timer = window.setTimeout(() => reject(new Error('沙箱启动超时（15 秒）')), 15_000);
      iframe.addEventListener('load', () => {
        loads++;
        if (loads > 1) {
          this.kill('沙箱页面被导航离开（例如表单提交或修改了 location），本次运行已停止。');
          return;
        }
        const channel = new MessageChannel();
        this.port = channel.port1;
        channel.port1.onmessage = (ev: MessageEvent) => {
          if (this.dead) return;
          const parsed = sandboxToHostSchema.safeParse(ev.data);
          if (!parsed.success) return; // 不合法的消息直接丢弃
          const msg = parsed.data;
          if (msg.type === 'ready') {
            if (msg.sessionId === sessionId && msg.protocol === PROTOCOL_VERSION) {
              window.clearTimeout(timer);
              resolve();
            }
            return;
          }
          for (const l of this.listeners) l(msg);
        };
        // 不透明来源无法指定 targetOrigin，只能用 '*'；消息里只有会话 id 与端口。
        iframe.contentWindow?.postMessage(
          { type: 'tsw:init', sessionId, protocol: PROTOCOL_VERSION, runtimes: options.runtimes },
          '*',
          [channel.port2],
        );
      });
    });
    this.ready.catch(() => {});

    iframe.src = `${import.meta.env.BASE_URL}sandbox/index.html`;
    (options.container ?? document.body).append(iframe);
  }

  get isDead() {
    return this.dead;
  }

  /** 调整隐藏 iframe 的尺寸（测试中的 page.viewport()） */
  resize(width: number, height: number) {
    this.iframe.style.width = `${width}px`;
    this.iframe.style.height = `${height}px`;
  }

  send(cmd: HostToSandbox) {
    if (this.dead || !this.port) throw new Error('沙箱已关闭');
    const checked = hostToSandboxSchema.parse(cmd);
    this.port.postMessage(checked);
  }

  onMessage(fn: (m: SandboxToHost) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  onDeath(fn: (reason: string) => void): () => void {
    this.deathListeners.add(fn);
    return () => this.deathListeners.delete(fn);
  }

  /** 关闭沙箱：移除 iframe 会销毁其中的全部脚本、计时器与 Worker。 */
  kill(reason = '沙箱已关闭') {
    if (this.dead) return;
    this.dead = true;
    this.port?.close();
    this.iframe.remove();
    for (const l of this.deathListeners) l(reason);
    this.listeners.clear();
    this.deathListeners.clear();
  }
}
