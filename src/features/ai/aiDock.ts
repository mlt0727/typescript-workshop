/**
 * 课页右侧的 AI 问答栏：展开/收起、宽度、选择的模型（保存在 localStorage），
 * 以及示例或练习用“问 AI”附加到对话中的代码块。
 * 代码块在附加时只登记位置；每次发送时再向这个代码块读取当时的代码、错误与输出。
 */
import { useSyncExternalStore } from 'react';

export const DOCK_MIN_WIDTH = 300;
export const DOCK_DEFAULT_WIDTH = 400;

export interface Attachment {
  lessonId: string;
  blockId: string;
  /** 例如“示例 · main.ts”“编程挑战“城市搜索”” */
  label: string;
}

/** 发送时从代码块读取的上下文 */
export interface BlockContext {
  title: string;
  mode: 'ts' | 'dom' | 'react';
  /** 附近的讲解或题目（纯文本） */
  context: string;
  files: Record<string, string>;
  diagnostics: string[];
  output: string[];
}

interface DockState {
  /** 宽屏：问答栏是否展开（默认展开，记住选择） */
  open: boolean;
  /** 窄屏：抽屉在哪个页面上打开着（换页之后自动收起，不保存） */
  drawerPath: string | null;
  width: number;
  model: string | null;
  attachment: Attachment | null;
  /** 每次附加代码块时加一：问答栏据此把焦点移到输入框 */
  focusRequest: number;
}

const KEY = 'tsw:ai-dock';

function read(): DockState {
  const state: DockState = { open: true, drawerPath: null, width: DOCK_DEFAULT_WIDTH, model: null, attachment: null, focusRequest: 0 };
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, unknown>;
    if (typeof v.open === 'boolean') state.open = v.open;
    if (typeof v.width === 'number' && Number.isFinite(v.width)) state.width = Math.max(DOCK_MIN_WIDTH, Math.round(v.width));
    if (typeof v.model === 'string' && v.model.length <= 100) state.model = v.model;
  } catch {
    // 偏好读不出来时用默认值
  }
  return state;
}

let current = read();
const listeners = new Set<() => void>();

function update(patch: Partial<DockState>) {
  current = { ...current, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify({ open: current.open, width: current.width, model: current.model }));
  } catch {
    // 保存失败只影响下次打开时的布局
  }
  for (const l of listeners) l();
}

export function useAiDock(): DockState {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => current,
  );
}

/** 问答栏现在是否显示：宽屏看 open，窄屏看抽屉是否在当前页面上打开 */
export function isDockOpen(state: DockState, overlay: boolean, pathname: string): boolean {
  return overlay ? state.drawerPath === pathname : state.open;
}

export const aiDock = {
  setOpen: (open: boolean) => update({ open }),
  setDrawer: (open: boolean) => update({ drawerPath: open ? window.location.pathname : null }),
  setWidth: (width: number) => update({ width: Math.max(DOCK_MIN_WIDTH, Math.round(width)) }),
  setModel: (model: string) => update({ model }),
  attach: (attachment: Attachment) => update({ attachment, open: true, drawerPath: window.location.pathname, focusRequest: current.focusRequest + 1 }),
  detach: () => update({ attachment: null }),
};

const providers = new Map<string, () => BlockContext>();
const providerKey = (lessonId: string, blockId: string) => `${lessonId}::${blockId}`;

/** 代码块挂载时登记读取上下文的函数，返回注销函数 */
export function registerBlockContext(lessonId: string, blockId: string, read: () => BlockContext): () => void {
  const key = providerKey(lessonId, blockId);
  providers.set(key, read);
  return () => {
    if (providers.get(key) === read) providers.delete(key);
  };
}

export function readBlockContext(lessonId: string, blockId: string): BlockContext | undefined {
  return providers.get(providerKey(lessonId, blockId))?.();
}
