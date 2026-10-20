import { useSyncExternalStore } from 'react';
import { syncManager, type SyncSnapshot } from './syncManager.ts';

const PHASE_LABEL: Record<SyncSnapshot['phase'], string> = {
  off: '未开启',
  idle: '等待同步',
  syncing: '正在同步…',
  ok: '已同步',
  error: '同步出错',
  offline: '离线',
  unauthorized: '密码无效',
};

export function useSyncStatus() {
  const s = useSyncExternalStore(syncManager.subscribe, syncManager.getSnapshot);
  const time = s.lastSyncedAt ? `（${new Date(s.lastSyncedAt).toLocaleString('zh-CN')}）` : '';
  return { ...s, label: `${PHASE_LABEL[s.phase]}${s.phase === 'ok' ? time : ''}` };
}
