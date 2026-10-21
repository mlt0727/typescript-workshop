---
version: 1
mode: ts
estimatedMinutes: 50
review: self-reviewed
problem: 项目 2 的面板到现在还是在和一个假的服务器说话（p2-04 的 fake-server.ts）。项目 3 用 Next.js 写出真正的服务器：同样的接口，再加上项目的列表和修改，数据保存在数据库中，最后部署出去（i03）。服务器和浏览器中的代码最大的不同是信任：浏览器中的表单检查是为了用户方便，服务器收到的请求却可能来自任何地方、带着任何内容。第一个里程碑先不写服务器的代码，而是把边界划清楚：哪些数据从客户端进来、怎样检查；哪些数据发出去、只发哪些字段。
objectives:
  - 把服务器要做的事写成验收条件，知道为什么项目 3 用 Route Handler 而不是 Server Function
  - 区分请求体、服务器保存的数据和发给客户端的数据三种形状，知道哪些字段只能由服务器决定
  - 用白名单检查 PATCH 请求体：不认识的字段报错，区分“没有这个字段”和“值是 null”，避免批量赋值和 __proto__ 的陷阱
  - 用白名单把保存的数据变成发给客户端的数据，知道 JSON.stringify 会丢掉 undefined、把 Date 变成字符串
references:
  - title: Route Handlers — Next.js（16.4，随 next 包附带的文档）
    url: https://nextjs.org/docs/app/getting-started/route-handlers
    checked: 2026-10-21
  - title: Mass Assignment Cheat Sheet — OWASP
    url: https://cheatsheetseries.owasp.org/cheatsheets/Mass_Assignment_Cheat_Sheet.html
    checked: 2026-10-21
  - title: Object.prototype.__proto__ — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/proto
    checked: 2026-10-21
  - title: JSON.stringify() — MDN
    url: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify
    checked: 2026-10-21
---

## 要做什么

项目 3 把 p2-04 的 `fake-server.ts` 换成真正的服务器，分三个里程碑：

1. **p3-01**（这一课）：需求和数据的边界，写成纯函数；
2. **p3-02**：用 Next.js 的 Route Handler 实现接口，处理校验、业务规则和并发的修改；
3. **p3-03**：把数据保存到 SQLite 中，并为服务器写测试。

最后 i03 把它部署出去。服务器的验收条件：

1. p2-04 中的三个接口（读取一个项目、添加任务、勾选任务）的状态码和 `fake-server.ts` 一样，响应体包含项目 2 需要的全部字段（可以多，不能少）。项目 2 的客户端只要去掉 `main.tsx` 中用假的服务器替换 `fetch` 的那一行。它请求的是相对地址 `/api/...`，所以要和 Next.js 的服务器在同一个域名下（或者通过改写转发过去），i03 再讨论部署；
2. 新增 `GET /api/projects`（所有的项目）和 `PATCH /api/projects/:projectId`（修改名称、负责人、截止日期和状态）。状态的变化按 p2-01 的转换表检查；两个人同时修改同一个项目时，后保存的人会被告知“项目已经被修改过”（p3-02）；
3. **服务器不相信客户端**：每个字段都在服务器上重新检查，即使 p2-03 的表单已经检查过；业务规则也在服务器上检查。p2-03 的表单中还有两条规则（截止日期不能早于今天、名称不能和别的项目重复），它们要读取今天的日期和其他的项目，检查的位置和状态的规则一样（p3-02）；这个项目中只实现状态的规则，另外两条，以及新建项目（`POST /api/projects`）和删除项目，做法相同，留作练习；
4. 响应中只有客户端需要的字段，负责人的邮箱永远不发出去；
5. 服务器重启之后数据还在（p3-03）。

## Route Handler 还是 Server Function

h05 的 Server Function 适合 Next.js 自己的页面中的表单：页面和处理函数在同一个应用中，Next.js 替你生成接口。项目 2 的客户端是一个独立的 React Router 应用，它通过 HTTP 发送 JSON 请求到 `/api/...`，所以服务器用 Route Handler：在 `app/api/projects/[projectId]/route.ts` 中导出 `GET`、`PATCH` 这样的函数，每个函数收到一个标准的 `Request`，返回一个 `Response`（h01、h06）。

另外，Server Function 的请求格式是 Next.js 内部的，动作 ID 随每次构建变化（h05），一个独立的客户端没有办法稳定地调用它。

不管用哪一种，它们都是**公开的接口**。h05 中实测过：Server Function 也只是一个可以直接发 POST 的地址。任何人都可以用 `curl` 发来任何内容：缺字段、多字段、类型不对、一个巨大的字符串。浏览器中的检查挡不住这些请求，它只是让正常的用户少犯错。

## 三种形状的数据

同一个项目在服务器上有三种形状：

```text
请求体（unknown） ──检查──▶ ProjectPatch ──合并──▶ StoredProject（服务器保存的） ──只取需要的字段──▶ ProjectDto（发给客户端的）
```

两个练习中都用到的类型（`model.ts`）：

```ts
/** 发给客户端的数据：和项目 2 的 Project 一样，多了 version 和 updatedAt */
export type ProjectDto = Readonly<{
  id: string; name: string; owner: string; status: ProjectStatus; dueDate: string | null;
  tasks: readonly TaskDto[]; version: number; updatedAt: string;
}>;

/** 服务器保存的数据：有一些字段从不发给客户端 */
export type StoredProject = Readonly<{
  id: string; name: string; owner: string;
  ownerEmail: string; // 只用来发通知，不公开
  status: ProjectStatus; dueDate: string | null;
  version: number; createdAt: string; updatedAt: string;
  deletedAt: string | null; // 删除的时间；没有删除时是 null（软删除）
  tasks: readonly StoredTask[]; // 任务还多了 position、createdAt、deletedAt
}>;
```

几个决定：

- **只能由服务器决定的字段**：`id`、`version`、`createdAt`、`updatedAt` 由服务器生成，客户端发来的这些字段不会被写进数据。每次修改（包括添加、勾选任务）`version` 都加 1（p3-02）；`ownerEmail` 由服务器根据负责人查出来，客户端不能提供；
- **软删除**：删除一个项目时只记下 `deletedAt`，数据还在，误删之后可以恢复；对客户端来说，它就是不存在了（404）；
- **多出来的 `version` 和 `updatedAt` 不影响项目 2 的客户端**：它的 `parseProject`（p2-04 的 `schema.ts`）只取自己认识的字段。反过来，少一个字段就不行了，见下文。

## 批量赋值

处理 PATCH 最省事的写法是把请求体整个合并进去：`{ ...stored, ...body }`。试一试一个“顺便”带上了其他字段的请求体：

:::playground{#mass-assignment}
```ts file=main.ts
type StoredProject = Readonly<{ id: string; name: string; ownerEmail: string; version: number }>;
const stored: StoredProject = { id: 'p1', name: '官网改版', ownerEmail: 'wang.fang@example.com', version: 7 };

// 客户端发来的请求体：除了名称，还带上了不该由它修改的字段
const body: Record<string, unknown> = JSON.parse('{"name":"官网改版（二期）","version":1,"ownerEmail":"evil@example.com","__proto__":{"isAdmin":true}}');
console.log('请求体的字段：', Object.keys(body));

const spread = { ...stored, ...body };
console.log('展开：', spread['version'], spread['ownerEmail']);

const assigned: Record<string, unknown> = Object.assign({}, stored, body);
console.log('Object.assign：', assigned['isAdmin'], Object.getPrototypeOf(assigned) === Object.prototype);

// 只取允许修改的字段，并检查它的类型
const raw = body['name'];
const name = typeof raw === 'string' ? raw.trim() : stored.name;
console.log('白名单：', { ...stored, name });
```
- 第 6 行：`JSON.parse` 把 `"__proto__"` 当作一个普通的字段名，它是请求体自己的一个字段；
- 第 9 行：`version` 变成了 `1`，邮箱换成了别人的：客户端改掉了只有服务器才能决定的字段；
- 第 12 行：`true false`：`Object.assign` 用赋值的方式复制，`assigned['__proto__'] = …` 改掉的是这个对象的**原型**，它凭空多了一个继承来的 `isAdmin`；
- 第 17 行：只取 `name`，其他的字段都不受请求体的影响。
:::

这类问题叫**批量赋值**（mass assignment）：框架或者代码把请求中的字段整个赋值给数据对象，攻击者只要猜出字段的名字（`role`、`isAdmin`、`version`），就能改掉它。防止的方法是**白名单**：只认识允许修改的几个字段，逐个检查类型和取值。不认识的字段可以忽略，也可以报错；这里选择报错，因为它多半是客户端的 bug（例如想修改 `version`），悄悄忽略的话，客户端会以为修改成功了。

PATCH 还有一个细节：**没有这个字段**和**字段的值是 `null`** 是两回事。`{"dueDate": null}` 表示“清除截止日期”，`{}` 中没有 `dueDate`，表示“不改截止日期”。检查的结果中，没有出现的字段就不要出现，连值为 `undefined` 的字段也不要有：之后用展开合并时，一个值为 `undefined` 的字段会把原来的值覆盖掉。

::exercise{#parse-patch}

## 发出去的数据：也用白名单

另一个方向同样要小心。直接 `Response.json(stored)` 会把 `ownerEmail` 发出去。用解构去掉几个字段（`const { ownerEmail, ...rest } = stored`）是黑名单：以后数据库中加了一列（例如重置密码用的令牌），它会自动出现在响应中，没有人会注意到。所以发出去的数据也列出每一个字段（h03 中密钥不能作为 props 传给客户端组件、h05 中 Server Function 只返回界面需要的字段，是同样的道理）。

还要注意 `Response.json` 用的是 `JSON.stringify`，有些值经过它就变了：

:::playground{#json-shapes}
```ts file=main.ts
const dto = {
  dueDate: undefined,
  updatedAt: new Date(Date.UTC(2026, 9, 20, 9, 30)),
  tags: new Map([['design', 1]]),
  progress: 0 / 0,
};
console.log(JSON.stringify(dto));

try {
  JSON.stringify({ id: BigInt(10) });
} catch (error) {
  console.log('BigInt：', error instanceof TypeError);
}
```
- 第 7 行：`dueDate` 不见了，`Date` 变成了 ISO 格式的字符串，`Map` 变成了 `{}`，`NaN` 变成了 `null`；
- 第 12 行：`BigInt` 不能转换成 JSON，抛出 `TypeError`。
:::

第一种最危险：服务器把没有截止日期写成了 `undefined`，JSON 中就没有这个字段，项目 2 的 `parseProject` 读到的 `dueDate` 是 `undefined`，它只接受 `null` 或者字符串，于是把整个项目当作“格式不对”（p2-04 的 `bad-response`）。所以“没有”要明确地写成 `null`。`Date` 虽然会被自动转换，但 DTO 的类型中写的是 `Date`，客户端收到的却是字符串，两边的类型对不上；无效的 `Date` 还会变成 `null`。所以时间在 DTO 中直接用 ISO 格式的字符串。

::exercise{#project-dto}

::quiz

## 常见错误

- **以为浏览器中检查过就够了**：请求可以不经过页面发来。服务器上的检查才是真正的检查。
- **把请求体整个合并进保存的数据**：客户端可以改掉 `version`、`ownerEmail` 这样的字段。只取白名单中的字段。
- **用普通的对象收集以客户端字段名为键的数据**：`errors['__proto__'] = …` 不会创建这个字段，`Object.assign` 还会改掉对象的原型（原型污染）。用 `Map`，最后用 `Object.fromEntries` 转换。
- **把 `null` 和没有这个字段混为一谈**：客户端就没有办法清除截止日期，或者一个没有发来的字段被改成了空。
- **直接返回保存的对象，或者用解构去掉几个字段**：内部的字段会被发出去。列出要发出去的每一个字段。
- **DTO 中出现 `undefined`、`Date`、`Map`**：经过 `JSON.stringify` 之后字段消失或者变了样。

## 下一步

边界划好了。p3-02 用 Route Handler 把接口真正实现出来：解析请求、返回正确的状态码，并用 `ETag` 和 `If-Match` 发现两个人同时修改同一个项目。
