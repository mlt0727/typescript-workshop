/** 单次运行/测试的数据上限，防止异常数据拖垮页面（主页面与沙箱共用）。 */
export const LIMITS = {
  maxModules: 64,
  maxModuleBytes: 512 * 1024,
  maxLogEntries: 500,
  maxLogBytes: 200 * 1024,
  maxLogEntryChars: 10_000,
  maxTests: 200,
} as const;
