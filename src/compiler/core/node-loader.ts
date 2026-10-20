import fs from 'node:fs';
import path from 'node:path';
import { TS_VERSION, type TypeGroup } from '../config.ts';

/** Node 环境（测试、课程脚本）从构建出的类型包读取，与浏览器 Worker 读取同一份文件。 */
export function nodeTypeGroupLoader(rootDir: string) {
  return async (group: TypeGroup): Promise<Record<string, string>> => {
    const file = path.join(rootDir, 'public', 'tsw-types', TS_VERSION, `${group}.json`);
    if (!fs.existsSync(file)) {
      throw new Error(`缺少类型包 ${file}，请先运行 npm run build:types`);
    }
    const json = JSON.parse(fs.readFileSync(file, 'utf8')) as { files: Record<string, string> };
    return json.files;
  };
}
