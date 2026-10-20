/**
 * 沙箱页面的历史记录保护。
 *
 * 预览 iframe 与课程页面共享同一个“联合会话历史”。在 WebKit 中，沙箱 iframe 自己没有更早的记录时调用
 * history.back()，后退的是**课程页面本身**（用户会离开课程）；Chromium 中也可能退回上一个测试留下的记录。
 * 这里记录本页面自己产生的条目（pushState 与片段导航），只允许在这些条目之间后退、前进，越界的调用被忽略并提示。
 *
 * 另外，WebKit 不允许沙箱文档用 pushState/replaceState 修改路径（只能改查询参数和片段），
 * 这里把它抛出的 SecurityError 换成更容易理解的说明。
 */

const nativeAdd = EventTarget.prototype.addEventListener;

let urls: string[] = [];
let index = 0;
let installed = false;

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

export function installHistoryGuard(log: (text: string) => void) {
  if (installed) return;
  installed = true;
  urls = [location.href];
  index = 0;

  const proto = History.prototype;
  const push = proto.pushState;
  const replace = proto.replaceState;
  const go = proto.go;

  proto.pushState = function (this: History, data: unknown, unused: string, url?: string | URL | null) {
    try {
      push.call(this, data, unused, url);
    } catch (err) {
      throw explainSecurityError(err);
    }
    urls = [...urls.slice(0, index + 1), location.href];
    index++;
  };

  proto.replaceState = function (this: History, data: unknown, unused: string, url?: string | URL | null) {
    try {
      replace.call(this, data, unused, url);
    } catch (err) {
      throw explainSecurityError(err);
    }
    urls[index] = location.href;
  };

  const traverse = (delta: number, name: string) => {
    if (delta === 0) {
      log(`[历史记录] 沙箱中忽略了 ${name}：它会重新加载预览页面。`);
      return;
    }
    const target = index + delta;
    if (target < 0 || target >= urls.length) {
      log(`[历史记录] 沙箱中忽略了 ${name}：这个页面没有${delta < 0 ? '更早' : '更晚'}的历史记录（真实的浏览器会离开这个页面或者什么都不做）。`);
      return;
    }
    index = target;
    go.call(history, delta);
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
    index++;
  });
  nativeAdd.call(window, 'popstate', resync);
}

/** 每个测试开始前：页面地址已经恢复，之前产生的记录都不再属于当前测试。 */
export function resetHistoryGuard() {
  urls = [location.href];
  index = 0;
}
