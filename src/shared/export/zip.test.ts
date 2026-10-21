import { describe, expect, it } from 'vitest';
import { crc32, createZip } from './zip.ts';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** 按中央目录读出所有条目（只支持“存储”方式），用来检查 createZip 的输出 */
function readZip(zip: Uint8Array) {
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  const eocd = zip.length - 22;
  expect(view.getUint32(eocd, true)).toBe(0x06054b50);
  const count = view.getUint16(eocd + 10, true);
  const centralSize = view.getUint32(eocd + 12, true);
  let p = view.getUint32(eocd + 16, true);
  // 中央目录紧挨着结束记录：起点 + 大小 = 结束记录的位置（解压软件据此定位中央目录）
  expect(p + centralSize).toBe(eocd);
  const entries: { name: string; text: string; crc: number; flags: number; method: number }[] = [];
  for (let i = 0; i < count; i++) {
    expect(view.getUint32(p, true)).toBe(0x02014b50);
    const flags = view.getUint16(p + 8, true);
    const method = view.getUint16(p + 10, true);
    const crc = view.getUint32(p + 16, true);
    const size = view.getUint32(p + 20, true);
    const nameLength = view.getUint16(p + 28, true);
    const local = view.getUint32(p + 42, true);
    const name = decoder.decode(zip.subarray(p + 46, p + 46 + nameLength));
    expect(view.getUint32(local, true)).toBe(0x04034b50);
    const localNameLength = view.getUint16(local + 26, true);
    const dataStart = local + 30 + localNameLength + view.getUint16(local + 28, true);
    entries.push({ name, text: decoder.decode(zip.subarray(dataStart, dataStart + size)), crc, flags, method });
    p += 46 + nameLength;
  }
  return entries;
}

describe('crc32', () => {
  it('与标准的检验值一致', () => {
    expect(crc32(encoder.encode('123456789'))).toBe(0xcbf43926);
    expect(crc32(new Uint8Array())).toBe(0);
    expect(crc32(encoder.encode('The quick brown fox jumps over the lazy dog'))).toBe(0x414fa339);
  });
});

describe('createZip', () => {
  it('写出可以读回的条目：UTF-8 文件名、存储方式、正确的 CRC', () => {
    const files = { 'package.json': '{}\n', 'src/main.ts': "console.log('你好');\n", '说明.md': '# 标题\n' };
    const entries = readZip(createZip(files, new Date(2026, 9, 20, 12, 30, 10)));
    expect(entries.map((e) => e.name)).toEqual(Object.keys(files));
    for (const e of entries) {
      expect(e.text).toBe(files[e.name as keyof typeof files]);
      expect(e.crc).toBe(crc32(encoder.encode(e.text)));
      expect(e.method).toBe(0);
      expect(e.flags & 0x0800).toBe(0x0800);
    }
  });

  it('写入 DOS 格式的修改时间', () => {
    const zip = createZip({ 'a.txt': 'a' }, new Date(2026, 9, 20, 12, 30, 10));
    const view = new DataView(zip.buffer);
    expect(view.getUint16(10, true)).toBe((12 << 11) | (30 << 5) | 5);
    expect(view.getUint16(12, true)).toBe(((2026 - 1980) << 9) | (10 << 5) | 20);
  });

  it('没有文件时只有中央目录结束记录', () => {
    const zip = createZip({});
    expect(zip.length).toBe(22);
    expect(readZip(zip)).toEqual([]);
  });
});
