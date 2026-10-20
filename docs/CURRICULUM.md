# 课程图谱

> 本文件由 `npm run content:build` 根据 `content/curriculum.yaml` 自动生成，请勿手工编辑。
> 状态：✅ 已发布（通过发布验收）· 📝 草稿（有内容但未通过全部验收，不计入已发布）· ⬜ 规划中（只有标题）。

**已发布 89 / 规划总数 126**（草稿 13，规划中 24）

## A. 起步与 JavaScript 共同语法（已发布 20 / 20）

从第一天写 TypeScript，补齐 JS 特有的语法与运行语义。

| 课时 | 状态 | 先修 |
|---|---|---|
| `a01-where-ts-runs` TS、JS、浏览器与 Node.js 的关系 | ✅ 已发布 | — |
| `a02-compile-vs-runtime` 编译期与运行期：类型擦除的边界 | ✅ 已发布 | `a01-where-ts-runs` |
| `a03-let-const-inference` let/const、类型注解与类型推断 | ✅ 已发布 | `a02-compile-vs-runtime` |
| `a04-primitives-strings` number、string、boolean 与模板字符串 | ✅ 已发布 | `a03-let-const-inference` |
| `a05-null-undefined` null 与 undefined | ✅ 已发布 | `a04-primitives-strings` |
| `a06-operators-equality` 运算符、=== 与类型转换 | ✅ 已发布 | `a05-null-undefined` |
| `a07-truthy-falsy` truthy 与 falsy | ✅ 已发布 | `a06-operators-equality` |
| `a08-optional-chaining-nullish` ?.、?? 与 || 的区别 | ✅ 已发布 | `a07-truthy-falsy` |
| `a09-control-flow` 条件与循环的快速迁移 | ✅ 已发布 | `a08-optional-chaining-nullish` |
| `a10-arrays` 数组基础与越界访问 | ✅ 已发布 | `a09-control-flow` |
| `a11-objects-references` 对象、引用与浅拷贝 | ✅ 已发布 | `a10-arrays` |
| `a12-destructuring-spread` 解构与展开 | ✅ 已发布 | `a11-objects-references` |
| `a13-functions` 普通函数、箭头函数与参数 | ✅ 已发布 | `a12-destructuring-spread` |
| `a14-scope-closures` 作用域与闭包 | ✅ 已发布 | `a13-functions` |
| `a15-this` this 的关键差异 | ✅ 已发布 | `a14-scope-closures` |
| `a16-array-methods` map、filter、reduce、find 的实际用法 | ✅ 已发布 | `a13-functions` |
| `a17-sort-and-mutation` sort 与变异行为的常见误区 | ✅ 已发布 | `a16-array-methods` |
| `a18-map-set` Map 与 Set | ✅ 已发布 | `a17-sort-and-mutation` |
| `a19-modules` ESM 导入与导出 | ✅ 已发布 | `a13-functions` |
| `a20-errors` 错误处理：throw、try/catch 与 unknown | ✅ 已发布 | `a13-functions` |

## B. 日常 TypeScript（已发布 17 / 17）

用类型描述数据、函数与模块，理解结构化类型与类型收窄。

| 课时 | 状态 | 先修 |
|---|---|---|
| `b01-type-alias-interface` type 与 interface：描述对象形状 | ✅ 已发布 | `a11-objects-references` |
| `b02-structural-typing` 结构化类型与多余属性检查 | ✅ 已发布 | `b01-type-alias-interface` |
| `b03-optional-readonly` 可选属性与 readonly | ✅ 已发布 | `b02-structural-typing` |
| `b04-union-literal` 联合类型与字面量类型 | ✅ 已发布 | `b03-optional-readonly` |
| `b05-intersection-tuple` 交叉类型与元组 | ✅ 已发布 | `b04-union-literal` |
| `b06-any-unknown-never-void` any、unknown、never 与 void | ✅ 已发布 | `b04-union-literal` |
| `b07-narrowing` 类型收窄 | ✅ 已发布 | `b06-any-unknown-never-void` |
| `b08-type-guards` 自定义类型守卫与断言函数 | ✅ 已发布 | `b07-narrowing` |
| `b09-discriminated-unions` 可辨识联合与穷尽检查 | ✅ 已发布 | `b08-type-guards` |
| `b10-function-types` 函数类型与回调 | ✅ 已发布 | `b07-narrowing`、`a16-array-methods` |
| `b11-overloads` 函数重载：何时用，何时不用 | ✅ 已发布 | `b10-function-types` |
| `b12-classes` 类、字段与访问控制 | ✅ 已发布 | `b10-function-types`、`a15-this` |
| `b13-inheritance-implements` 继承、实现接口与抽象类 | ✅ 已发布 | `b12-classes` |
| `b14-generics` 泛型函数与泛型类型 | ✅ 已发布 | `b10-function-types` |
| `b15-generic-constraints` 泛型约束 | ✅ 已发布 | `b14-generics` |
| `b16-assertions-as-const-satisfies` 类型断言、as const 与 satisfies | ✅ 已发布 | `b15-generic-constraints` |
| `b17-enums-and-alternatives` 枚举与可擦除语法 | ✅ 已发布 | `b16-assertions-as-const-satisfies` |

## E. 浏览器机制、异步与数据（已发布 12 / 13）

事件循环、Promise、fetch、运行时校验、取消与竞态、存储、URL 与安全边界。

| 课时 | 状态 | 先修 |
|---|---|---|
| `e01-event-loop` 事件循环的必要知识 | ✅ 已发布 | `a14-scope-closures`、`b12-classes` |
| `e02-promises` Promise 基础 | ✅ 已发布 | `e01-event-loop`、`b14-generics`、`a20-errors` |
| `e03-async-await` async/await 与错误传播 | ✅ 已发布 | `e02-promises`、`a20-errors` |
| `e04-promise-combinators` Promise.all、allSettled、race 与 any | ✅ 已发布 | `e03-async-await`、`b09-discriminated-unions`、`b13-inheritance-implements` |
| `e05-fetch-json` fetch、HTTP 状态与 JSON | ✅ 已发布 | `e04-promise-combinators` |
| `e06-runtime-validation` 运行时数据校验 | ✅ 已发布 | `e05-fetch-json`、`b08-type-guards` |
| `e07-loading-states` 加载、空与失败状态 | ✅ 已发布 | `e06-runtime-validation`、`d06-dom-create-update` |
| `e08-abort-races` AbortController、取消请求与竞态 | ✅ 已发布 | `e07-loading-states` |
| `e09-storage-serialization` 浏览器存储与序列化 | ✅ 已发布 | `e06-runtime-validation` |
| `e10-url-routing` URL、History 与基础路由 | ✅ 已发布 | `d10-state-and-render`、`e06-runtime-validation` |
| `e11-cors` CORS 的真实边界 | ✅ 已发布 | `e05-fetch-json` |
| `e12-xss` 基础 XSS 防范 | ✅ 已发布 | `d06-dom-create-update` |
| `e13-env-secrets` 客户端环境变量与密钥边界 | ⬜ 规划中 | `f02-vite-project` |

## C. 进阶类型与类型设计（已发布 11 / 12）

类型运算的工程用途；区分“类型体操”和日常收益。部分内容可选学。

| 课时 | 状态 | 先修 |
|---|---|---|
| `c01-keyof-typeof-indexed` keyof、typeof 与索引访问类型 | ✅ 已发布 | `b16-assertions-as-const-satisfies` |
| `c02-mapped-types` 映射类型与修饰符 | ✅ 已发布 | `c01-keyof-typeof-indexed` |
| `c03-conditional-infer` 条件类型与 infer | ✅ 已发布 | `c02-mapped-types` |
| `c04-distributive-conditional` 分布式条件类型 | ✅ 已发布 | `c03-conditional-infer` |
| `c05-template-literal-types` 模板字面量类型的实际用途 | ✅ 已发布 | `c03-conditional-infer` |
| `c06-utility-types` Partial、Required、Pick、Omit、Record、Readonly | ✅ 已发布 | `c02-mapped-types`、`c04-distributive-conditional` |
| `c07-function-utility-types` ReturnType、Parameters 与 Awaited | ✅ 已发布 | `c06-utility-types`、`e03-async-await` |
| `c08-generic-api-design` 泛型 API 设计 | ✅ 已发布 | `c07-function-utility-types` |
| `c09-boundary-modeling` 边界数据建模 | ✅ 已发布 | `c08-generic-api-design`、`e06-runtime-validation` |
| `c10-avoid-any` 避免 any 与不必要的双重断言 | ✅ 已发布 | `c09-boundary-modeling` |
| `c11-strict-options` strict、strictNullChecks 与 noUncheckedIndexedAccess | ✅ 已发布 | `c10-avoid-any` |
| `c12-modules-dts` 模块与 .d.ts 基础 | 📝 草稿 | `c11-strict-options`、`f03-tsconfig` |

## D. HTML、CSS 与 DOM（已发布 10 / 10）

足以完成项目的 HTML/CSS，以及类型安全的 DOM 操作、事件与表单。

| 课时 | 状态 | 先修 |
|---|---|---|
| `d01-html-semantics` HTML 语义结构 | ✅ 已发布 | `a01-where-ts-runs` |
| `d02-html-forms` 表单元素与标签 | ✅ 已发布 | `d01-html-semantics` |
| `d03-css-layout` CSS 布局：Flexbox 与 Grid | ✅ 已发布 | `d01-html-semantics` |
| `d04-responsive-a11y` 响应式与可访问性基础 | ✅ 已发布 | `d03-css-layout`、`d02-html-forms` |
| `d05-dom-query` DOM 查询、null 检查与元素类型收窄 | ✅ 已发布 | `d01-html-semantics`、`b07-narrowing` |
| `d06-dom-create-update` 创建与更新节点 | ✅ 已发布 | `d05-dom-query` |
| `d07-events` 事件监听、target 与 currentTarget | ✅ 已发布 | `d06-dom-create-update`、`b10-function-types` |
| `d08-bubbling-delegation` 冒泡、委托、preventDefault 与清理监听器 | ✅ 已发布 | `d07-events` |
| `d09-form-validation` 类型安全的表单输入与验证 | ✅ 已发布 | `d08-bubbling-delegation`、`d02-html-forms` |
| `d10-state-and-render` 状态与渲染：从数据到界面 | ✅ 已发布 | `d09-form-validation`、`b09-discriminated-unions` |

## F. 工程化、测试与调试（已发布 0 / 12）

在本机搭建真实项目：npm、Vite、tsconfig、调试、测试、Git、构建与 CI。

| 课时 | 状态 | 先修 |
|---|---|---|
| `f01-node-npm` Node.js、npm、package.json 与锁文件 | 📝 草稿 | `a19-modules` |
| `f02-vite-project` 用 Vite 创建 TypeScript 项目 | 📝 草稿 | `f01-node-npm`、`d06-dom-create-update` |
| `f03-tsconfig` tsconfig、ESM 与模块解析 | 📝 草稿 | `f02-vite-project` |
| `f04-devtools` DevTools、断点、source map 与网络面板 | 📝 草稿 | `f02-vite-project` |
| `f05-debugging-practice` 实际排错练习 | 📝 草稿 | `f04-devtools` |
| `f06-unit-tests` 用 Vitest 写单元测试 | 📝 草稿 | `f03-tsconfig` |
| `f07-type-tests` 类型测试 | 📝 草稿 | `f06-unit-tests`、`b14-generics` |
| `f08-dom-tests` DOM 与组件测试 | 📝 草稿 | `f06-unit-tests`、`d08-bubbling-delegation` |
| `f09-e2e` 用 Playwright 做端到端测试 | 📝 草稿 | `f08-dom-tests` |
| `f10-git` Git 基础工作流 | 📝 草稿 | `f01-node-npm` |
| `f11-lint-format` 格式化与静态检查 | 📝 草稿 | `f03-tsconfig` |
| `f12-build-ci` 生产构建与 CI | 📝 草稿 | `f11-lint-format`、`f10-git` |

## G. React + TypeScript（已发布 14 / 15）

组件、props、state、表单、Hook、Effect、路由与测试，全部在真实预览中练习。

| 课时 | 状态 | 先修 |
|---|---|---|
| `g01-jsx-components` JSX/TSX 与组件 | ✅ 已发布 | `d10-state-and-render`、`a19-modules` |
| `g02-props` Props 与类型 | ✅ 已发布 | `g01-jsx-components` |
| `g03-events-state` 事件与 state | ✅ 已发布 | `g02-props` |
| `g04-immutable-updates` 不可变更新 | ✅ 已发布 | `g03-events-state`、`a12-destructuring-spread` |
| `g05-lists-keys` 列表渲染与 key | ✅ 已发布 | `g04-immutable-updates` |
| `g06-controlled-forms` 受控表单 | ✅ 已发布 | `g05-lists-keys` |
| `g07-lifting-state` 状态提升与组合 | ✅ 已发布 | `g06-controlled-forms` |
| `g08-custom-hooks` 自定义 Hook | ✅ 已发布 | `g07-lifting-state` |
| `g09-refs` ref 的合理用途 | ✅ 已发布 | `g08-custom-hooks` |
| `g10-context` Context 的合理用途 | ✅ 已发布 | `g08-custom-hooks` |
| `g11-effects` Effect：适用场景、依赖与清理 | ✅ 已发布 | `g09-refs`、`e08-abort-races` |
| `g12-effect-pitfalls` 避免滥用 Effect 与性能 Hook | ✅ 已发布 | `g11-effects` |
| `g13-routing` 用 React Router 组织页面 | ✅ 已发布 | `g12-effect-pitfalls`、`e10-url-routing` |
| `g14-async-data` 异步数据与错误状态 | ✅ 已发布 | `g13-routing`、`e08-abort-races` |
| `g15-a11y-component-tests` 可访问性与组件测试 | ⬜ 规划中 | `g14-async-data`、`f08-dom-tests` |

## H. Next.js 与基础全栈实验（已发布 0 / 9）

本地运行的真实 Next.js 实验：路由、服务端/客户端边界、数据读写、校验、持久化与部署边界。

| 课时 | 状态 | 先修 |
|---|---|---|
| `h01-next-overview` 从 SPA 到服务端渲染：Next.js 解决什么问题 | ⬜ 规划中 | `g13-routing`、`f12-build-ci` |
| `h02-app-router-layouts` App Router：路由与布局 | ⬜ 规划中 | `h01-next-overview` |
| `h03-server-client-components` 服务端组件与客户端组件的边界 | ⬜ 规划中 | `h02-app-router-layouts` |
| `h04-data-reading` 在服务端读取数据 | ⬜ 规划中 | `h03-server-client-components` |
| `h05-mutations-validation` 数据写入与输入校验 | ⬜ 规划中 | `h04-data-reading`、`e06-runtime-validation` |
| `h06-server-errors` 服务端错误处理 | ⬜ 规划中 | `h05-mutations-validation` |
| `h07-persistence` 持久化：内存、本地文件与数据库 | ⬜ 规划中 | `h06-server-errors` |
| `h08-env-config` 环境变量与配置 | ⬜ 规划中 | `h07-persistence`、`e13-env-secrets` |
| `h09-auth-boundaries` 认证话题的安全边界 | ⬜ 规划中 | `h08-env-config` |

## I. 项目与部署（已发布 5 / 18）

三个层层递进的项目，每个拆成独立里程碑；以及静态与服务端部署。

| 课时 | 状态 | 先修 |
|---|---|---|
| `p1-01-plan-and-model` 项目 1·任务板：需求与数据模型 | ✅ 已发布 | `d10-state-and-render` |
| `p1-02-render-and-add` 项目 1·任务板：渲染与新增 | ✅ 已发布 | `p1-01-plan-and-model` |
| `p1-03-edit-delete` 项目 1·任务板：编辑与删除（事件委托） | ✅ 已发布 | `p1-02-render-and-add` |
| `p1-04-filters` 项目 1·任务板：过滤与 URL 状态 | ✅ 已发布 | `p1-03-edit-delete`、`e10-url-routing` |
| `p1-05-persistence` 项目 1·任务板：持久化与数据校验 | ✅ 已发布 | `p1-04-filters`、`e09-storage-serialization` |
| `p1-06-local-project` 项目 1·任务板：本地工程、测试与导出 | ⬜ 规划中 | `p1-05-persistence`、`f08-dom-tests` |
| `i01-static-vs-server` 静态站点与服务端应用的区别 | ⬜ 规划中 | `f12-build-ci` |
| `i02-deploy-static` 部署静态站点：构建、路由刷新与资源路径 | ⬜ 规划中 | `i01-static-vs-server` |
| `p2-01-plan-and-types` 项目 2·项目面板：需求与类型模型 | ⬜ 规划中 | `g08-custom-hooks` |
| `p2-02-routes-lists` 项目 2·项目面板：路由与列表 | ⬜ 规划中 | `p2-01-plan-and-types`、`g13-routing` |
| `p2-03-forms` 项目 2·项目面板：表单与校验 | ⬜ 规划中 | `p2-02-routes-lists` |
| `p2-04-data-state` 项目 2·项目面板：数据状态与错误处理 | ⬜ 规划中 | `p2-03-forms`、`g14-async-data` |
| `p2-05-tests` 项目 2·项目面板：组件测试与端到端测试 | ⬜ 规划中 | `p2-04-data-state`、`g15-a11y-component-tests` |
| `p2-06-deploy` 项目 2·项目面板：静态部署与验证 | ⬜ 规划中 | `p2-05-tests`、`i02-deploy-static` |
| `p3-01-plan` 项目 3·全栈扩展：需求与数据边界 | ⬜ 规划中 | `h07-persistence`、`p2-06-deploy` |
| `p3-02-api-validation` 项目 3·全栈扩展：服务端读写与校验 | ⬜ 规划中 | `p3-01-plan` |
| `p3-03-persistence` 项目 3·全栈扩展：持久化与测试 | ⬜ 规划中 | `p3-02-api-validation` |
| `i03-deploy-server` 部署服务端应用：环境变量、日志与回滚 | ⬜ 规划中 | `p3-03-persistence`、`h08-env-config` |
