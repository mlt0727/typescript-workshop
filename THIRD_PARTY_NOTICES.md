# 第三方组件声明

构建产物中包含以下第三方组件（完整依赖与版本见 `package-lock.json`，各自许可证文本见 `node_modules/<包名>/LICENSE`）。

| 组件 | 用途 | 许可证 |
|---|---|---|
| TypeScript 6.0.3（含 `lib.*.d.ts`） | 浏览器内编译器与类型库 | Apache-2.0 |
| @typescript/vfs | 虚拟文件系统工具 | MIT |
| CodeMirror 6（@codemirror/*、@lezer/*） | 代码编辑器 | MIT |
| React 19.3、React DOM、React Router 8.5 | 平台界面；沙箱中的 React 运行时 | MIT |
| @types/react、@types/react-dom、csstype | 课程练习中的 React 类型 | MIT |
| @testing-library/dom、@testing-library/react、@testing-library/user-event、dom-accessibility-api | 沙箱中的 DOM/组件测试 | MIT |
| expect-type | `expectTypeOf` 类型测试（类型声明打包进类型库） | Apache-2.0 |
| zod | 数据校验 | MIT |
| idb | IndexedDB 封装 | ISC |
| @anthropic-ai/sdk | 可选“问 AI”服务端调用 | MIT |
| @neondatabase/serverless | 可选同步服务的数据库驱动 | MIT |
| Shiki、unified/remark/rehype、yaml（仅构建时） | 课程 Markdown 处理与代码高亮 | MIT / ISC |

`sandbox/src/inspect.ts` 中的数组分组与单行合并算法移植自 Node.js `lib/internal/util/inspect.js`（MIT License，Copyright Node.js contributors）。
