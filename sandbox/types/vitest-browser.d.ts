// TypeScript 工坊内置：Vitest 浏览器模式 `vitest/browser` 的兼容子集（只声明平台真正实现了的部分）。
// 只能在 DOM / React 模式的测试中使用。

export interface BrowserPage {
  /**
   * 调整测试页面（iframe）的视口尺寸，等新的尺寸生效（媒体查询已更新）后兑现。
   * 宽和高必须是 200–2000 之间的整数。每个测试开始前，视口会恢复为默认的 1024×768。
   */
  viewport(width: number, height: number): Promise<void>;
}

export declare const page: BrowserPage;
