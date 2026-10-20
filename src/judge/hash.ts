/** 文件快照的稳定哈希（SHA-256，按路径排序）。判题结果与快照哈希绑定，代码一改结果即失效。 */
export async function hashFiles(files: Record<string, string>): Promise<string> {
  const canonical = JSON.stringify(Object.keys(files).sort().map((k) => [k, files[k]]));
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
