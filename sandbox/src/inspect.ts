/**
 * 与 Node.js `console.log` / `util.inspect`（默认选项，无颜色）尽量一致的值格式化。
 *
 * 课文中的“预期输出”以 Node.js 为准，所以沙箱输出也采用 Node 的格式：
 *   [ 1, 2, 3 ]、{ a: 1, b: 'x' }、Map(1) { 'k' => 1 }、[Function: f]、<ref *1> …
 *
 * 数组分组（超过 6 项时按列排版）与单行合并规则移植自 Node.js lib/internal/util/inspect.js
 * （MIT License，Copyright Node.js contributors），并在单元测试中与真实 util.inspect 对照。
 * 已知差异：无法同步读取 Promise 的状态，显示为 Promise { <unknown> }；%o 不显示隐藏属性（等同 %O）。
 */

interface Ctx {
  seen: object[];
  circular: Map<object, number>;
  indentationLvl: number;
  currentDepth: number;
  depth: number;
  breakLength: number;
  compact: number;
  maxArrayLength: number;
  maxStringLength: number;
}

const kObjectType = 0;
const kArrayExtrasType = 1;

function newCtx(): Ctx {
  return {
    seen: [],
    circular: new Map(),
    indentationLvl: 0,
    currentDepth: 0,
    depth: 2,
    breakLength: 80,
    compact: 3,
    maxArrayLength: 100,
    maxStringLength: 10000,
  };
}

const IDENT_RE = /^[a-zA-Z_][a-zA-Z_0-9]*$/;

// eslint-disable-next-line no-control-regex
const ESCAPE_RE = /[\x00-\x1f\x27\x5c\x7f-\x9f]/g;
const META: Record<string, string> = {
  '\b': '\\b',
  '\t': '\\t',
  '\n': '\\n',
  '\f': '\\f',
  '\r': '\\r',
  "'": "\\'",
  '\\': '\\\\',
};

export function quoteString(str: string): string {
  let quote = "'";
  let escapeRe = ESCAPE_RE;
  if (str.includes("'")) {
    if (!str.includes('"')) quote = '"';
    else if (!str.includes('`') && !str.includes('${')) quote = '`';
    if (quote !== "'") {
      // eslint-disable-next-line no-control-regex
      escapeRe = /[\x00-\x1f\x5c\x7f-\x9f]/g;
    }
  }
  const escaped = str.replace(escapeRe, (ch) => {
    const m = META[ch];
    if (m !== undefined) return m;
    return `\\x${ch.charCodeAt(0).toString(16).padStart(2, '0')}`;
  });
  return `${quote}${escaped}${quote}`;
}

function formatNumber(n: number): string {
  if (Object.is(n, -0)) return '-0';
  return String(n);
}

function formatPrimitive(value: unknown, ctx: Ctx): string {
  switch (typeof value) {
    case 'string': {
      let s = value;
      let trailer = '';
      if (s.length > ctx.maxStringLength) {
        const remaining = s.length - ctx.maxStringLength;
        s = s.slice(0, ctx.maxStringLength);
        trailer = `... ${remaining} more character${remaining > 1 ? 's' : ''}`;
      }
      return quoteString(s) + trailer;
    }
    case 'number':
      return formatNumber(value);
    case 'bigint':
      return `${value}n`;
    case 'boolean':
      return String(value);
    case 'undefined':
      return 'undefined';
    case 'symbol':
      return value.toString();
    default:
      return String(value);
  }
}

function getPrefix(constructor: string | null, tag: string, fallback: string, size = ''): string {
  if (constructor === null) {
    if (tag !== '' && fallback !== tag) return `[${fallback}${size}: null prototype] [${tag}] `;
    return `[${fallback}${size}: null prototype] `;
  }
  if (tag !== '' && constructor !== tag) return `${constructor}${size} [${tag}] `;
  return `${constructor}${size} `;
}

function getConstructorName(obj: object): string | null {
  let o: object | null = obj;
  while (o !== null) {
    const desc = Object.getOwnPropertyDescriptor(o, 'constructor');
    if (desc !== undefined && typeof desc.value === 'function' && desc.value.name !== '') {
      return desc.value.name as string;
    }
    o = Object.getPrototypeOf(o) as object | null;
  }
  return null;
}

function formatKey(key: string | symbol): string {
  if (typeof key === 'symbol') return key.toString();
  if (IDENT_RE.test(key)) return key;
  return quoteString(key);
}

function isBelowBreakLength(ctx: Ctx, output: string[], start: number, base: string): boolean {
  let totalLength = output.length + start;
  if (totalLength + output.length > ctx.breakLength) return false;
  for (const entry of output) {
    totalLength += entry.length;
    if (totalLength > ctx.breakLength) return false;
  }
  return base === '' || !base.includes('\n');
}

function groupArrayElements(ctx: Ctx, output: string[], value: unknown[] | undefined): string[] {
  let totalLength = 0;
  let maxLength = 0;
  let outputLength = output.length;
  if (ctx.maxArrayLength < output.length) outputLength--;
  const separatorSpace = 2;
  const dataLen = new Array<number>(outputLength);
  for (let i = 0; i < outputLength; i++) {
    const len = output[i]!.length;
    dataLen[i] = len;
    totalLength += len + separatorSpace;
    if (maxLength < len) maxLength = len;
  }
  const actualMax = maxLength + separatorSpace;
  if (
    actualMax * 3 + ctx.indentationLvl < ctx.breakLength &&
    (totalLength / actualMax > 5 || maxLength <= 6)
  ) {
    const approxCharHeights = 2.5;
    const averageBias = Math.sqrt(actualMax - totalLength / output.length);
    const biasedMax = Math.max(actualMax - 3 - averageBias, 1);
    const columns = Math.min(
      Math.round(Math.sqrt(approxCharHeights * biasedMax * outputLength) / biasedMax),
      Math.floor((ctx.breakLength - ctx.indentationLvl) / actualMax),
      ctx.compact * 4,
      15,
    );
    if (columns <= 1) return output;
    const tmp: string[] = [];
    const maxLineLength: number[] = [];
    for (let i = 0; i < columns; i++) {
      let lineLength = 0;
      for (let j = i; j < output.length; j += columns) {
        if (dataLen[j]! > lineLength) lineLength = dataLen[j]!;
      }
      maxLineLength.push(lineLength + separatorSpace);
    }
    let padStart = true;
    if (value !== undefined) {
      for (let i = 0; i < output.length; i++) {
        if (typeof value[i] !== 'number' && typeof value[i] !== 'bigint') {
          padStart = false;
          break;
        }
      }
    }
    for (let i = 0; i < outputLength; i += columns) {
      const max = Math.min(i + columns, outputLength);
      let str = '';
      let j = i;
      for (; j < max - 1; j++) {
        const padding = maxLineLength[j - i]!;
        str += padStart ? `${output[j]}, `.padStart(padding, ' ') : `${output[j]}, `.padEnd(padding, ' ');
      }
      if (padStart) {
        const padding = maxLineLength[j - i]! - separatorSpace;
        str += output[j]!.padStart(padding, ' ');
      } else {
        str += output[j];
      }
      tmp.push(str);
    }
    if (ctx.maxArrayLength < output.length) tmp.push(output[outputLength]!);
    return tmp;
  }
  return output;
}

function reduceToSingleString(
  ctx: Ctx,
  output: string[],
  base: string,
  braces: [string, string],
  extrasType: number,
  recurseTimes: number,
  value: unknown,
): string {
  let out = output;
  const entries = out.length;
  if (extrasType === kArrayExtrasType && entries > 6) {
    out = groupArrayElements(ctx, out, Array.isArray(value) ? value : undefined);
  }
  if (ctx.currentDepth - recurseTimes < ctx.compact && entries === out.length) {
    const start = out.length + ctx.indentationLvl + braces[0].length + base.length + 10;
    if (isBelowBreakLength(ctx, out, start, base)) {
      const joined = out.join(', ');
      if (!joined.includes('\n')) {
        return `${base ? `${base} ` : ''}${braces[0]} ${joined} ${braces[1]}`;
      }
    }
  }
  const indentation = `\n${' '.repeat(ctx.indentationLvl)}`;
  return `${base ? `${base} ` : ''}${braces[0]}${indentation}  ${out.join(`,${indentation}  `)}${indentation}${braces[1]}`;
}

function formatFunctionBase(fn: Function, constructor: string | null): string {
  const src = Function.prototype.toString.call(fn);
  if (src.startsWith('class') && /^class\s*[\s{]|^class\s+[\w$]/.test(src)) {
    const name = fn.name;
    let base = `[class ${name || '(anonymous)'}`;
    const superProto = Object.getPrototypeOf(fn) as { name?: string } | null;
    if (superProto && superProto !== Function.prototype && superProto.name) {
      base += ` extends ${superProto.name}`;
    }
    return `${base}]`;
  }
  let type = 'Function';
  if (constructor === 'AsyncFunction') type = 'AsyncFunction';
  else if (constructor === 'GeneratorFunction') type = 'GeneratorFunction';
  else if (constructor === 'AsyncGeneratorFunction') type = 'AsyncGeneratorFunction';
  let base = `[${type}`;
  base += fn.name ? `: ${fn.name}]` : ' (anonymous)]';
  if (constructor !== type && constructor !== null && constructor !== 'Function') base += ` ${constructor}`;
  return base;
}

function formatError(err: Error): string {
  const name = err.name || 'Error';
  const message = err.message;
  return message ? `${name}: ${message}` : name;
}

function formatProperty(ctx: Ctx, obj: object, recurseTimes: number, key: string | symbol, arrayKey: boolean): string {
  const desc = Object.getOwnPropertyDescriptor(obj, key) ?? { value: (obj as Record<string | symbol, unknown>)[key], enumerable: true };
  let str: string;
  if (desc.value !== undefined || !('get' in desc || 'set' in desc)) {
    // Node 中是 `ctx.compact !== true ? 2 : 3`；默认的 compact 是数字 3，所以缩进总是 2
    const diff = 2;
    ctx.indentationLvl += diff;
    str = formatValue(ctx, desc.value, recurseTimes);
    ctx.indentationLvl -= diff;
  } else if (desc.get !== undefined) {
    str = desc.set !== undefined ? '[Getter/Setter]' : '[Getter]';
  } else if (desc.set !== undefined) {
    str = '[Setter]';
  } else {
    str = 'undefined';
  }
  if (arrayKey) return str;
  return `${formatKey(key)}: ${str}`;
}

function ownEnumerableKeys(obj: object): (string | symbol)[] {
  const keys: (string | symbol)[] = Object.keys(obj);
  for (const s of Object.getOwnPropertySymbols(obj)) {
    if (Object.prototype.propertyIsEnumerable.call(obj, s)) keys.push(s);
  }
  return keys;
}

function formatArrayLike(ctx: Ctx, value: ArrayLike<unknown> & object, recurseTimes: number): string[] {
  const output: string[] = [];
  const len = value.length;
  const outputLength = Math.min(ctx.maxArrayLength, len);
  let holes = 0;
  for (let i = 0; i < outputLength; i++) {
    if (!Object.prototype.hasOwnProperty.call(value, i)) {
      holes++;
      continue;
    }
    if (holes > 0) {
      output.push(`<${holes} empty item${holes > 1 ? 's' : ''}>`);
      holes = 0;
    }
    output.push(formatProperty(ctx, value, recurseTimes, String(i), true));
  }
  if (holes > 0) output.push(`<${holes} empty item${holes > 1 ? 's' : ''}>`);
  const remaining = len - outputLength;
  if (remaining > 0) output.push(`... ${remaining} more item${remaining > 1 ? 's' : ''}`);
  return output;
}

function formatValue(ctx: Ctx, value: unknown, recurseTimes: number): string {
  if (typeof value !== 'object' && typeof value !== 'function') return formatPrimitive(value, ctx);
  if (value === null) return 'null';

  if (ctx.seen.includes(value)) {
    let index = ctx.circular.get(value);
    if (index === undefined) {
      index = ctx.circular.size + 1;
      ctx.circular.set(value, index);
    }
    return `[Circular *${index}]`;
  }
  return formatRaw(ctx, value, recurseTimes);
}

function formatRaw(ctx: Ctx, value: object, recurseTimes: number): string {
  const constructor = getConstructorName(value);
  const tagValue = (value as { [Symbol.toStringTag]?: unknown })[Symbol.toStringTag];
  let tag = typeof tagValue === 'string' ? tagValue : '';
  if (tag !== '' && constructor !== null && tag === constructor) tag = '';

  let keys: (string | symbol)[];
  let base = '';
  let braces: [string, string] = ['{', '}'];
  let extrasType = kObjectType;
  let formatter: (ctx: Ctx, v: object, r: number) => string[] = () => [];
  let noEntries = false;

  if (Array.isArray(value)) {
    keys = ownEnumerableKeys(value).filter((k) => typeof k === 'symbol' || !/^(0|[1-9]\d*)$/.test(k));
    const prefix = constructor !== 'Array' || tag !== '' ? getPrefix(constructor, tag, 'Array', `(${value.length})`) : '';
    braces = [`${prefix}[`, ']'];
    if (value.length === 0 && keys.length === 0) return `${braces[0]}]`;
    extrasType = kArrayExtrasType;
    formatter = (c, v, r) => formatArrayLike(c, v as unknown[], r);
  } else if (value instanceof Set) {
    keys = ownEnumerableKeys(value);
    const prefix = getPrefix(constructor, tag, 'Set', `(${value.size})`);
    if (value.size === 0 && keys.length === 0) return `${prefix}{}`;
    braces = [`${prefix}{`, '}'];
    formatter = (c, v, r) => {
      c.indentationLvl += 2;
      const out = [...(v as Set<unknown>)].map((x) => formatValue(c, x, r));
      c.indentationLvl -= 2;
      return out;
    };
  } else if (value instanceof Map) {
    keys = ownEnumerableKeys(value);
    const prefix = getPrefix(constructor, tag, 'Map', `(${value.size})`);
    if (value.size === 0 && keys.length === 0) return `${prefix}{}`;
    braces = [`${prefix}{`, '}'];
    formatter = (c, v, r) => {
      c.indentationLvl += 2;
      const out = [...(v as Map<unknown, unknown>)].map(([k, x]) => `${formatValue(c, k, r)} => ${formatValue(c, x, r)}`);
      c.indentationLvl -= 2;
      return out;
    };
  } else if (ArrayBuffer.isView(value) && !(value instanceof DataView)) {
    const ta = value as unknown as ArrayLike<number> & object;
    keys = [];
    const prefix = getPrefix(constructor, tag, 'TypedArray', `(${ta.length})`);
    braces = [`${prefix}[`, ']'];
    if (ta.length === 0) return `${braces[0]}]`;
    extrasType = kArrayExtrasType;
    formatter = (c, v, r) => formatArrayLike(c, v as unknown as ArrayLike<unknown> & object, r);
  } else {
    noEntries = true;
    keys = ownEnumerableKeys(value);
    if (typeof value === 'function') {
      base = formatFunctionBase(value, constructor);
      if (keys.length === 0) return base;
    } else if (value instanceof Date) {
      base = Number.isNaN(value.getTime()) ? 'Invalid Date' : value.toISOString();
      if (keys.length === 0) return base;
    } else if (value instanceof RegExp) {
      base = RegExp.prototype.toString.call(value);
      if (keys.length === 0) return base;
    } else if (value instanceof Error) {
      base = formatError(value);
      keys = keys.filter((k) => k !== 'stack' && k !== 'message');
      if (keys.length === 0) return base;
    } else if (value instanceof Promise) {
      return `${getPrefix(constructor, tag, 'Promise')}{ <unknown> }`;
    } else if (value instanceof WeakMap || value instanceof WeakSet) {
      return `${getPrefix(constructor, tag, value instanceof WeakMap ? 'WeakMap' : 'WeakSet')}{ <items unknown> }`;
    } else if (typeof Node !== 'undefined' && value instanceof Node) {
      return formatDomNode(value);
    } else {
      if (keys.length === 0) {
        if (constructor === 'Object' && tag === '') return '{}';
        return `${getPrefix(constructor, tag, 'Object')}{}`;
      }
      braces[0] = constructor === 'Object' && tag === '' ? '{' : `${getPrefix(constructor, tag, 'Object')}{`;
    }
  }

  if (recurseTimes > ctx.depth) {
    const name = (getPrefix(constructor, tag, 'Object').slice(0, -1) || 'Object');
    return Array.isArray(value) ? '[Array]' : `[${name}]`;
  }

  recurseTimes += 1;
  ctx.seen.push(value);
  ctx.currentDepth = recurseTimes;
  let output: string[];
  try {
    output = formatter(ctx, value, recurseTimes);
    for (const key of keys) {
      output.push(formatProperty(ctx, value, recurseTimes, key, false));
    }
  } finally {
    ctx.seen.pop();
  }

  if (noEntries && base !== '' && output.length > 0) {
    braces = ['{', '}'];
  }

  const ref = ctx.circular.get(value);
  if (ref !== undefined) {
    const reference = `<ref *${ref}>`;
    if (base === '') braces[0] = `${reference} ${braces[0]}`;
    else base = `${reference} ${base}`;
  }

  return reduceToSingleString(ctx, output, base, braces, extrasType, recurseTimes, value);
}

function formatDomNode(node: Node): string {
  if (node.nodeType === 1) {
    const el = node as Element;
    const id = el.id ? `#${el.id}` : '';
    const cls = el.classList.length ? `.${[...el.classList].join('.')}` : '';
    return `<${el.tagName.toLowerCase()}${id}${cls}>`;
  }
  if (node.nodeType === 3) return `#text ${quoteString(node.textContent ?? '')}`;
  if (node.nodeType === 9) return '#document';
  return `[${node.nodeName}]`;
}

export function inspect(value: unknown): string {
  return formatValue(newCtx(), value, 0);
}

/** 与 Node.js util.format 相同：支持 %s %d %i %f %j %o %O %c %%。 */
export function format(...args: unknown[]): string {
  const first = args[0];
  let a = 0;
  let str = '';
  let join = '';
  if (typeof first === 'string') {
    if (args.length === 1) return first;
    let tempStr: string;
    let lastPos = 0;
    for (let i = 0; i < first.length - 1; i++) {
      if (first.charCodeAt(i) !== 37) continue; // '%'
      const nextChar = first.charCodeAt(++i);
      if (a + 1 !== args.length) {
        switch (nextChar) {
          case 115: {
            // 's'
            const arg = args[++a];
            if (typeof arg === 'number') tempStr = formatNumber(arg);
            else if (typeof arg === 'bigint') tempStr = `${arg}n`;
            else if (typeof arg !== 'object' || arg === null || hasCustomToString(arg)) tempStr = String(arg);
            else {
              const ctx = newCtx();
              ctx.depth = 0;
              tempStr = formatValue(ctx, arg, 0);
            }
            break;
          }
          case 106: // 'j'
            try {
              tempStr = JSON.stringify(args[++a]) ?? 'undefined';
            } catch {
              tempStr = '[Circular]';
            }
            break;
          case 100: {
            // 'd'
            const n = args[++a];
            tempStr = typeof n === 'bigint' ? `${n}n` : typeof n === 'symbol' ? 'NaN' : formatNumber(Number(n));
            break;
          }
          case 79: // 'O'
          case 111: // 'o'
            tempStr = inspect(args[++a]);
            break;
          case 105: {
            // 'i'
            const n = args[++a];
            tempStr = typeof n === 'bigint' ? `${n}n` : typeof n === 'symbol' ? 'NaN' : formatNumber(Number.parseInt(String(n)));
            break;
          }
          case 102: {
            // 'f'
            const n = args[++a];
            tempStr = typeof n === 'symbol' ? 'NaN' : formatNumber(Number.parseFloat(String(n)));
            break;
          }
          case 99: // 'c'
            a++;
            tempStr = '';
            break;
          case 37: // '%'
            str += first.slice(lastPos, i);
            lastPos = i + 1;
            continue;
          default:
            continue;
        }
        if (lastPos !== i - 1) str += first.slice(lastPos, i - 1);
        str += tempStr;
        lastPos = i + 1;
      } else if (nextChar === 37) {
        str += first.slice(lastPos, i);
        lastPos = i + 1;
      }
    }
    if (lastPos !== 0) {
      a++;
      join = ' ';
      if (lastPos < first.length) str += first.slice(lastPos);
    }
  }
  while (a < args.length) {
    const value = args[a];
    str += join;
    str += typeof value !== 'string' ? inspect(value) : value;
    join = ' ';
    a++;
  }
  return str;
}

function hasCustomToString(value: object): boolean {
  if (value instanceof Error) return false;
  let o: object | null = value;
  while (o !== null && o !== Object.prototype) {
    const d = Object.getOwnPropertyDescriptor(o, 'toString');
    if (d && typeof d.value === 'function') {
      return !(o === Array.prototype || o === Date.prototype || o === RegExp.prototype || o === Function.prototype);
    }
    o = Object.getPrototypeOf(o) as object | null;
  }
  return false;
}
