/**
 * 最小的 ZIP 写入器：只用“存储”方式（不压缩），文件名用 UTF-8（通用标志位 11）。
 * 用来把几十个文本文件打包下载，不需要压缩库。
 */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = (CRC_TABLE[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** MS-DOS 格式的时间与日期（ZIP 头中使用；秒精确到 2 秒） */
function dosDateTime(date: Date): { time: number; date: number } {
  const year = Math.max(1980, date.getFullYear());
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

const UTF8_FLAG = 0x0800;

export function createZip(files: Readonly<Record<string, string | Uint8Array>>, modified = new Date()): Uint8Array<ArrayBuffer> {
  const encoder = new TextEncoder();
  const { time, date } = dosDateTime(modified);
  const entries = Object.entries(files).map(([path, content]) => {
    const name = encoder.encode(path);
    const data = typeof content === 'string' ? encoder.encode(content) : content;
    return { name, data, crc: crc32(data) };
  });

  const localSize = entries.reduce((sum, e) => sum + 30 + e.name.length + e.data.length, 0);
  const centralSize = entries.reduce((sum, e) => sum + 46 + e.name.length, 0);
  const out = new Uint8Array(localSize + centralSize + 22);
  const view = new DataView(out.buffer);
  let offset = 0;
  const u16 = (value: number) => {
    view.setUint16(offset, value, true);
    offset += 2;
  };
  const u32 = (value: number) => {
    view.setUint32(offset, value >>> 0, true);
    offset += 4;
  };
  const bytes = (value: Uint8Array) => {
    out.set(value, offset);
    offset += value.length;
  };

  const localOffsets: number[] = [];
  for (const e of entries) {
    localOffsets.push(offset);
    u32(0x04034b50); // 本地文件头
    u16(20); // 解压所需的版本 2.0
    u16(UTF8_FLAG);
    u16(0); // 存储，不压缩
    u16(time);
    u16(date);
    u32(e.crc);
    u32(e.data.length); // 压缩后的大小
    u32(e.data.length); // 原始大小
    u16(e.name.length);
    u16(0); // 扩展字段的长度
    bytes(e.name);
    bytes(e.data);
  }

  const centralStart = offset;
  entries.forEach((e, i) => {
    u32(0x02014b50); // 中央目录项
    u16(20); // 创建者的版本
    u16(20);
    u16(UTF8_FLAG);
    u16(0);
    u16(time);
    u16(date);
    u32(e.crc);
    u32(e.data.length);
    u32(e.data.length);
    u16(e.name.length);
    u16(0); // 扩展字段
    u16(0); // 注释
    u16(0); // 起始磁盘
    u16(0); // 内部属性
    u32(0); // 外部属性
    u32(localOffsets[i] ?? 0);
    bytes(e.name);
  });

  const centralLength = offset - centralStart;
  u32(0x06054b50); // 中央目录结束
  u16(0);
  u16(0);
  u16(entries.length);
  u16(entries.length);
  u32(centralLength);
  u32(centralStart);
  u16(0); // 注释长度
  return out;
}
