/**
 * 沙箱页面的历史记录：只在本页面自己产生的条目（pushState 与片段导航）之间后退、前进。
 *
 * 不透明来源的沙箱 iframe 中，浏览器自身的后退、前进并不可靠：
 * - 预览 iframe 与课程页面共享同一个“联合会话历史”。沙箱 iframe 自己没有更早的记录时调用 history.back()，
 *   WebKit 后退的是**课程页面本身**（用户会离开课程）；Chromium 中也可能退回上一个测试留下的记录；
 * - 实测（Chromium 与 WebKit）：后退到页面加载时的那条记录、以及在 WebKit 中任意两条 pushState 记录之间后退，
 *   浏览器都会重新加载 iframe，而不是在同一个文档中切换（真实的页面中这是同一文档内的切换）。
 *
 * 所以这里自己记录条目（地址与 state），history.back/forward/go 在下一个任务中切换到目标条目：
 * 用 replaceState 恢复地址与 state，然后触发 popstate（片段不同时再触发 hashchange），
 * 与浏览器在同一文档的条目之间切换时的行为一致。越界的调用被忽略并提示。
 *
 * 另外，WebKit 不允许沙箱文档用 pushState/replaceState 修改路径（只能改查询参数和片段），
 * 这里把它抛出的 SecurityError 换成更容易理解的说明。
 */

const nativeAdd = EventTarget.prototype.addEventListener;

let urls: string[] = [];
let states: unknown[] = [];
let index = 0;
/** 所有已请求的后退、前进都完成之后所在的条目（越界检查在调用时进行） */
let pending = 0;
let installed = false;
/** 条目被 pushState/replaceState/片段导航修改、或者测试重新开始时加一：之前请求、还没完成的后退、前进不再生效 */
let version = 0;

function sameEntry(at: number): boolean {
  return urls[at] === location.href;
}

/** 根据当前地址，在已知的条目中找到离 index 最近的位置（用户使用浏览器自身的后退按钮时）。 */
function resync() {
  if (sameEntry(index)) return;
  for (let d = 1; d < urls.length; d++) {
    if (index - d >= 0 && sameEntry(index - d)) {
      index -= d;
      return;
    }
    if (index + d < urls.length && sameEntry(index + d)) {
      index += d;
      return;
    }
  }
}

function explainSecurityError(err: unknown): unknown {
  if (err instanceof DOMException && err.name === 'SecurityError') {
    return new DOMException(
      `${err.message}（这个浏览器不允许沙箱中的页面用 pushState/replaceState 修改路径，只能修改 ? 之后的查询参数和 # 之后的片段。）`,
      'SecurityError',
    );
  }
  return err;
}

const withoutHash = (url: string) => url.replace(/#.*$/, '');

export function installHistoryGuard(log: (text: string) => void) {
  if (installed) return;
  installed = true;
  urls = [location.href];
  states = [history.state];
  index = 0;
  pending = 0;

  const proto = History.prototype;
  const push = proto.pushState;
  const replace = proto.replaceState;

  // 后退、前进在下一个任务中完成（和浏览器一样是异步的）；不使用 setTimeout，假计时器不影响它
  const channel = new MessageChannel();
  const queue: (() => void)[] = [];
  channel.port1.onmessage = () => queue.shift()?.();
  const later = (fn: () => void) => {
    queue.push(fn);
    channel.port2.postMessage(null);
  };

  proto.pushState = function (this: History, data: unknown, unused: string, url?: string | URL | null) {
    try {
      push.call(this, data, unused, url);
    } catch (err) {
      throw explainSecurityError(err);
    }
    urls = [...urls.slice(0, index + 1), location.href];
    states = [...states.slice(0, index + 1), this.state];
    index++;
    pending = index;
    version++;
  };

  proto.replaceState = function (this: History, data: unknown, unused: string, url?: string | URL | null) {
    try {
      replace.call(this, data, unused, url);
    } catch (err) {
      throw explainSecurityError(err);
    }
    urls[index] = location.href;
    states[index] = this.state;
    pending = index;
    version++;
  };

  const traverse = (delta: number, name: string) => {
    if (delta === 0) {
      log(`[历史记录] 沙箱中忽略了 ${name}：它会重新加载预览页面。`);
      return;
    }
    // 连续两次 back() 后退两条：目标从所有已请求的切换完成之后的位置算起
    const target = pending + delta;
    const url = urls[target];
    if (url === undefined) {
      log(`[历史记录] 沙箱中忽略了 ${name}：这个页面没有${delta < 0 ? '更早' : '更晚'}的历史记录（真实的浏览器会离开这个页面或者什么都不做）。`);
      return;
    }
    pending = target;
    const requestedIn = version;
    later(() => {
      if (requestedIn !== version) return;
      const oldURL = location.href;
      index = target;
      replace.call(history, states[target], '', url);
      window.dispatchEvent(new PopStateEvent('popstate', { state: history.state }));
      if (oldURL !== url && withoutHash(oldURL) === withoutHash(url)) {
        window.dispatchEvent(new HashChangeEvent('hashchange', { oldURL, newURL: url }));
      }
    });
  };

  proto.back = function () {
    traverse(-1, 'history.back()');
  };
  proto.forward = function () {
    traverse(1, 'history.forward()');
  };
  proto.go = function (delta?: number) {
    traverse(Math.trunc(Number(delta ?? 0)) || 0, `history.go(${delta ?? ''})`);
  };

  // 片段导航（location.hash = …、点击 <a href="#…">）也会新增一条记录
  nativeAdd.call(window, 'hashchange', () => {
    if (sameEntry(index)) return;
    urls = [...urls.slice(0, index + 1), location.href];
    states = [...states.slice(0, index + 1), history.state];
    index++;
    pending = index;
    version++;
  });
  // 用户使用浏览器自身的后退、前进按钮时（真实的 popstate）：按地址找回当前条目
  nativeAdd.call(window, 'popstate', (event: Event) => {
    if (!event.isTrusted) return;
    resync();
    pending = index;
  });
}

/** 每个测试开始前：页面地址已经恢复，之前产生的记录都不再属于当前测试。 */
export function resetHistoryGuard() {
  urls = [location.href];
  states = [history.state];
  index = 0;
  pending = 0;
  version++;
}
