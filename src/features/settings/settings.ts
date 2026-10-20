/** 少量界面偏好保存在 localStorage（读写都可能失败，例如隐私模式；失败时使用默认值）。 */
import { useSyncExternalStore } from 'react';

export type Theme = 'system' | 'light' | 'dark';
export type FontSize = 'small' | 'medium' | 'large' | 'xlarge';

export interface Settings {
  theme: Theme;
  fontSize: FontSize;
  sidebarCollapsed: boolean;
}

const KEY = 'tsw:settings';
const DEFAULTS: Settings = { theme: 'system', fontSize: 'medium', sidebarCollapsed: false };

function read(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const v = JSON.parse(raw) as Partial<Settings>;
    return {
      theme: v.theme === 'light' || v.theme === 'dark' || v.theme === 'system' ? v.theme : DEFAULTS.theme,
      fontSize: ['small', 'medium', 'large', 'xlarge'].includes(v.fontSize ?? '') ? (v.fontSize as FontSize) : DEFAULTS.fontSize,
      sidebarCollapsed: typeof v.sidebarCollapsed === 'boolean' ? v.sidebarCollapsed : false,
    };
  } catch {
    return DEFAULTS;
  }
}

let current = read();
const listeners = new Set<() => void>();

export function applySettingsToDocument(s: Settings = current) {
  const root = document.documentElement;
  root.dataset.theme = s.theme;
  root.dataset.fontSize = s.fontSize;
}

export function updateSettings(patch: Partial<Settings>) {
  current = { ...current, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    // 偏好设置保存失败不影响学习，只在本次会话生效
  }
  applySettingsToDocument();
  for (const l of listeners) l();
}

export function useSettings(): Settings {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => current,
  );
}
