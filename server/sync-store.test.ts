import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import { FileStore } from './sync-store.js';

const dirs: string[] = [];

async function tempFile() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'tsw-sync-'));
  dirs.push(dir);
  return path.join(dir, 'nested', 'sync.json');
}

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe('FileStore', () => {
  test('文件不存在：没有文档；写入之后能读回来，没有留下临时文件', async () => {
    const file = await tempFile();
    const store = new FileStore(file);
    expect(await store.get()).toBeNull();
    const result = await store.put(0, 'e1', { a: 1 });
    expect(result.ok).toBe(true);
    expect(await store.get()).toMatchObject({ revision: 1, epoch: 'e1', state: { a: 1 } });
    expect(await fs.readdir(path.dirname(file))).toStrictEqual(['sync.json']);
  });

  test('同时推送：只有基于当前 revision 的那一个成功', async () => {
    const store = new FileStore(await tempFile());
    const results = await Promise.all([store.put(0, 'e1', 1), store.put(0, 'e1', 2), store.put(0, 'e1', 3)]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect((await store.get())?.revision).toBe(1);
  });

  test('文件损坏：读取和推送都失败，而不是当作没有数据覆盖它', async () => {
    const file = await tempFile();
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, '{"revision":');
    const store = new FileStore(file);
    await expect(store.get()).rejects.toThrow(SyntaxError);
    await expect(store.put(0, 'e1', {})).rejects.toThrow(SyntaxError);
    expect(await fs.readFile(file, 'utf8')).toBe('{"revision":');
  });
});
