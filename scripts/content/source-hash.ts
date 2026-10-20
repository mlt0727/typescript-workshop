import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

/** 课时源文件（lesson.md、quiz.yaml、exercises、fixtures）的哈希：内容一改，旧的验证结果就不再算数。 */
export function lessonSourceHash(contentDir: string, lessonId: string): string {
  const dir = path.join(contentDir, 'lessons', lessonId);
  const files: string[] = [];
  const walk = (d: string) => {
    for (const name of fs.readdirSync(d).sort()) {
      const full = path.join(d, name);
      if (fs.statSync(full).isDirectory()) walk(full);
      else files.push(full);
    }
  };
  walk(dir);
  const h = crypto.createHash('sha256');
  for (const f of files) {
    h.update(path.relative(dir, f).split(path.sep).join('/'));
    h.update(fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n'));
  }
  return h.digest('hex').slice(0, 16);
}
