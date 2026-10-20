// TypeScript 工坊内置：Vitest 浏览器模式 `vitest/browser` 的兼容子集（只声明平台真正实现了的部分）。
// 只能在 DOM / React 模式的测试中使用。

export interface BrowserPage {
  /**
   * 调整测试页面（iframe）的视口尺寸，等新的尺寸生效（媒体查询已更新）后兑现。
   * 宽和高必须是 200–2000 之间的整数。每个测试开始前，视口会恢复为默认的 1024×768。
   */
  viewport(width: number, height: number): Promise<void>;
  /**
   * 平台扩展（Vitest 浏览器模式中没有这个方法）：模拟刷新页面。页面恢复成 index.html 的初始内容，
   * 学生的入口文件重新执行；地址保持不变，模拟的 localStorage、sessionStorage 中的数据保留。
   * 每个测试开始前，这两个存储都会被清空。只能在 DOM 模式的测试中使用。
   */
  reload(): Promise<void>;
}

export declare const page: BrowserPage;
