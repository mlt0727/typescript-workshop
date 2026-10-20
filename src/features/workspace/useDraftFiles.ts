import { useCallback, useMemo, useState } from 'react';
import type { SourceFile } from '../../content/types.ts';
import { progressStore } from '../../storage/store.ts';

export type DraftStatus = 'pristine' | 'draft' | 'outdated';

/**
 * 一个代码块（Playground 或练习）的可编辑文件，自动保存为草稿。
 * 课程更新后（起始代码哈希变化）不会静默覆盖草稿，而是返回 outdated 让学习者选择。
 */
export function useDraftFiles(lessonId: string, blockId: string, starter: SourceFile[], baseHash: string) {
  const starterMap = useMemo(() => Object.fromEntries(starter.map((f) => [f.path, f.content])), [starter]);
  const [files, setFiles] = useState<Record<string, string>>(() => {
    const d = progressStore.draft(lessonId, blockId);
    if (!d) return starterMap;
    // 草稿里只保留当前仍存在的文件，新增的文件用起始内容补齐
    const merged: Record<string, string> = { ...starterMap };
    for (const [p, c] of Object.entries(d.files)) if (p in merged) merged[p] = c;
    return merged;
  });
  const [status, setStatus] = useState<DraftStatus>(() => {
    const d = progressStore.draft(lessonId, blockId);
    if (!d) return 'pristine';
    return d.baseHash === baseHash ? 'draft' : 'outdated';
  });

  const setFile = useCallback(
    (path: string, content: string) => {
      setFiles((prev) => {
        if (prev[path] === content) return prev;
        const next = { ...prev, [path]: content };
        progressStore.saveDraft(lessonId, blockId, next, baseHash);
        return next;
      });
      setStatus((s) => (s === 'outdated' ? s : 'draft'));
    },
    [lessonId, blockId, baseHash],
  );

  /** 恢复起始代码（删除草稿） */
  const reset = useCallback(() => {
    progressStore.deleteDraft(lessonId, blockId);
    setFiles(starterMap);
    setStatus('pristine');
  }, [lessonId, blockId, starterMap]);

  /** 课程更新后：保留自己的代码，并把草稿标记为基于新版本 */
  const keepDraft = useCallback(() => {
    setFiles((prev) => {
      progressStore.saveDraft(lessonId, blockId, prev, baseHash);
      return prev;
    });
    setStatus('draft');
  }, [lessonId, blockId, baseHash]);

  const isModified = useMemo(() => Object.keys(starterMap).some((p) => files[p] !== starterMap[p]), [files, starterMap]);

  return { files, setFile, reset, keepDraft, status, isModified, starterMap };
}
