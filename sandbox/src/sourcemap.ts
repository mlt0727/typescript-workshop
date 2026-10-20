/** 极简 source map v3 解码：把运行时调用栈中的 blob URL 位置映射回学生源文件。 */

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64_INDEX = new Map([...B64].map((c, i) => [c, i]));

type Segment = [genCol: number, srcLine: number, srcCol: number];

function decodeVlq(str: string): number[] {
  const out: number[] = [];
  let value = 0;
  let shift = 0;
  for (const ch of str) {
    const digit = B64_INDEX.get(ch);
    if (digit === undefined) continue;
    value += (digit & 31) << shift;
    if (digit & 32) {
      shift += 5;
    } else {
      out.push(value & 1 ? -(value >>> 1) : value >>> 1);
      value = 0;
      shift = 0;
    }
  }
  return out;
}

export class SourceMapLookup {
  private readonly lines: Segment[][] = [];

  constructor(mapJson: string) {
    const map = JSON.parse(mapJson) as { mappings?: string };
    let srcLine = 0;
    let srcCol = 0;
    for (const line of (map.mappings ?? '').split(';')) {
      const segments: Segment[] = [];
      let genCol = 0;
      for (const seg of line.split(',')) {
        if (!seg) continue;
        const v = decodeVlq(seg);
        genCol += v[0] ?? 0;
        if (v.length >= 4) {
          srcLine += v[2] ?? 0;
          srcCol += v[3] ?? 0;
          segments.push([genCol, srcLine, srcCol]);
        }
      }
      this.lines.push(segments);
    }
  }

  /** line/column 均为 1 起始；返回 1 起始的源位置。 */
  original(line: number, column: number): { line: number; column: number } | undefined {
    const segs = this.lines[line - 1];
    if (!segs || segs.length === 0) return undefined;
    let best: Segment | undefined;
    for (const s of segs) {
      if (s[0] <= column - 1) best = s;
      else break;
    }
    best ??= segs[0];
    if (!best) return undefined;
    return { line: best[1] + 1, column: best[2] + 1 };
  }
}

export interface ModuleLocationInfo {
  path: string;
  map?: SourceMapLookup;
}

const FRAME_RE = /(blob:[^\s)]+?):(\d+):(\d+)/g;

/** 把调用栈里的 blob URL 换成 “main.ts:行:列”，并返回第一个落在学生/测试文件中的位置。 */
export function mapStack(
  stack: string,
  urlToModule: ReadonlyMap<string, ModuleLocationInfo>,
): { stack: string; first?: { file: string; line: number; column: number } } {
  let first: { file: string; line: number; column: number } | undefined;
  const mapped = stack.replace(FRAME_RE, (whole, url: string, l: string, c: string) => {
    const info = urlToModule.get(url);
    if (!info) return whole;
    const pos = info.map?.original(Number(l), Number(c)) ?? { line: Number(l), column: Number(c) };
    first ??= { file: info.path, line: pos.line, column: pos.column };
    return `${info.path}:${pos.line}:${pos.column}`;
  });
  // 去掉沙箱运行时自身的栈帧，避免干扰学习者
  const lines = mapped
    .split('\n')
    .filter((line) => !/\/sandbox\/[\w-]+\.js|blob:null\/[\w-]+:\d+/.test(line) || /\.(ts|tsx):\d+/.test(line));
  return { stack: lines.join('\n'), first };
}
