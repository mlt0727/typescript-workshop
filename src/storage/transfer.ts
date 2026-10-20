/** 进度导出与导入（只接受结构化 JSON，校验后才合并，从不执行其中内容）。 */
import {
  exportFileSchema,
  MAX_IMPORT_BYTES,
  PROGRESS_FORMAT,
  PROGRESS_SCHEMA_VERSION,
  progressStateSchema,
  type ProgressState,
} from './schema.js';

export function serializeExport(state: ProgressState, now = new Date()): string {
  return JSON.stringify(
    { format: PROGRESS_FORMAT, schemaVersion: PROGRESS_SCHEMA_VERSION, exportedAt: now.toISOString(), state },
    null,
    1,
  );
}

export type ImportResult = { ok: true; state: ProgressState } | { ok: false; error: string };

/** 校验状态内部的一致性：记录的键必须与内容中的 id 一致 */
function consistent(state: ProgressState): string | undefined {
  for (const [k, v] of Object.entries(state.lessons)) {
    if (k !== v.lessonId) return `课时记录的键 ${k} 与 lessonId ${v.lessonId} 不一致`;
  }
  for (const [k, v] of Object.entries(state.drafts)) {
    if (k !== v.key || v.key !== `${v.lessonId}::${v.blockId}`) return `草稿记录的键 ${k} 不一致`;
  }
  return undefined;
}

export function validateState(raw: unknown): ImportResult {
  const parsed = progressStateSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      ok: false,
      error: `数据结构不符合要求：${issue ? `${issue.path.join('.')} ${issue.message}` : '未知错误'}`,
    };
  }
  const problem = consistent(parsed.data);
  if (problem) return { ok: false, error: problem };
  return { ok: true, state: parsed.data };
}

export function parseImport(text: string, byteSize: number): ImportResult {
  if (byteSize > MAX_IMPORT_BYTES) {
    return {
      ok: false,
      error: `文件太大（${Math.round(byteSize / 1024)} KB），上限为 ${MAX_IMPORT_BYTES / 1024 / 1024} MB。`,
    };
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: '不是有效的 JSON 文件。' };
  }
  const file = exportFileSchema.safeParse(json);
  if (!file.success || file.data.format !== PROGRESS_FORMAT) {
    return { ok: false, error: '这不是 TypeScript 工坊导出的进度文件。' };
  }
  if (file.data.schemaVersion > PROGRESS_SCHEMA_VERSION) {
    return {
      ok: false,
      error: `该文件来自更新版本的平台（格式版本 ${file.data.schemaVersion}），当前只支持到 ${PROGRESS_SCHEMA_VERSION}。请先更新平台。`,
    };
  }
  if (file.data.schemaVersion < 1) {
    return { ok: false, error: `不支持的格式版本 ${file.data.schemaVersion}。` };
  }
  return validateState(file.data.state);
}
