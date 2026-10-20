// dom-accessibility-api 的 package.json "exports" 未暴露类型声明，这里只声明用到的函数。
declare module 'dom-accessibility-api' {
  export function computeAccessibleName(root: Element, options?: Record<string, unknown>): string;
}
