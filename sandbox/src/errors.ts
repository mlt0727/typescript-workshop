import type { SerializedError } from '../../src/shared/sandbox-protocol.ts';
import { inspect } from './inspect.ts';
import { mapStack, type ModuleLocationInfo } from './sourcemap.ts';

/** 所有已链接模块的 blob URL → 源文件信息（多次链接累积，用于映射调用栈）。 */
export const moduleRegistry = new Map<string, ModuleLocationInfo>();

export function registerModules(map: ReadonlyMap<string, ModuleLocationInfo>) {
  for (const [k, v] of map) moduleRegistry.set(k, v);
}

export function locate(error: unknown): { file: string; line: number; column: number } | undefined {
  if (!(error instanceof Error) || !error.stack) return undefined;
  return mapStack(error.stack, moduleRegistry).first;
}

/** 错误消息里可能出现模块的 blob URL（例如“模块没有导出 X”），换成学习者认识的文件名。 */
function mapModuleUrls(text: string): string {
  return text.replace(/blob:[^\s'"`)]+/g, (url) => {
    const info = moduleRegistry.get(url);
    return info ? `./${info.path}` : url;
  });
}

export function serializeError(error: unknown): SerializedError {
  if (error instanceof Error) {
    const mapped = error.stack ? mapStack(error.stack, moduleRegistry) : undefined;
    return {
      name: error.name || 'Error',
      message: mapModuleUrls(String(error.message)).slice(0, 10_000),
      stack: mapped ? mapModuleUrls(mapped.stack).slice(0, 20_000) : undefined,
      location: mapped?.first,
    };
  }
  return { name: 'Thrown', message: `抛出了非 Error 值：${inspect(error)}` };
}

const CHROME_FRAME = /at (?:(.+?) \()?([^\s()]+?\.tsx?:\d+:\d+)\)?\s*$/;
const OTHER_FRAME = /^\s*(.*?)@([^\s@]+?\.tsx?:\d+:\d+)\s*$/;

function normalizeFrame(line: string): string | undefined {
  const m = CHROME_FRAME.exec(line) ?? OTHER_FRAME.exec(line);
  if (!m) return undefined;
  const fn = m[1]?.trim();
  return `    at ${fn ? `${fn} (${m[2]})` : m[2]}`;
}

/** Node.js 风格的未捕获错误输出（只保留映射回源文件的栈帧）。 */
export function formatUncaught(prefix: string, error: unknown): string {
  if (!(error instanceof Error)) return `${prefix}${inspect(error)}`;
  const s = serializeError(error);
  const frames = (s.stack ?? '')
    .split('\n')
    .map(normalizeFrame)
    .filter((l): l is string => l !== undefined);
  const tail = frames.length ? `\n${frames.slice(0, 6).join('\n')}` : '';
  return `${prefix}${s.name}: ${s.message}${tail}`;
}
