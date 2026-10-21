---
version: 1
mode: ts
estimatedMinutes: 55
review: self-reviewed
problem: 任务板现在一刷新就回到示例数据。这一个里程碑把它保存到浏览器的 localStorage 中，下次打开时恢复。保存很简单，读取才是难点：存储中的数据可能是旧版本的格式，可能被手工改坏了，也可能根本不是 JSON。读取时要验证，遇到旧格式就转换，遇到坏数据不能让应用崩溃，更不能悄悄地把用户的数据删掉。保存也可能失败（存储空间满了）。最后还要分清哪些状态该保存、哪些不该。
objectives:
  - 给保存的数据加上版本号，读取时按版本验证，旧版本的数据转换成新的格式（e09）
  - 把“读取存储”写成纯函数：输入是字符串或 null，输出是成功（附带是否转换过）或失败的原因（e06）
  - 读取失败时保留原来的数据、告诉用户，从空的任务板开始；保存失败时提示，但应用照常工作
  - 只保存数据状态：界面状态（正在改名的任务）、地址中的状态（筛选条件）都不保存
references:
  - title: Window.localStorage — MDN
    url: https://developer.mozilla.org/zh-CN/docs/Web/API/Window/localStorage
    checked: 2026-10-20
  - title: Storage.setItem()（QuotaExceededError）— MDN
    url: https://developer.mozilla.org/zh-CN/docs/Web/API/Storage/setItem
    checked: 2026-10-20
  - title: JSON.parse() — MDN
    url: https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/JSON/parse
    checked: 2026-10-20
---

## 保存的数据会“变老”

e09 讲过：localStorage 只能保存字符串，读出来的东西在运行时可能是任何样子。对一个会不断升级的应用来说，还有一个更常见的问题：**数据的格式会变**。

假设任务板最早的版本只是一个待办清单，保存的是这样的数据：

```json
{ "version": 1, "todos": [{ "id": 1, "text": "写周报", "done": false }] }
```

现在的任务板有三列、有标签，格式变成了：

```json
{ "version": 2, "board": { "tasks": [{ "id": "t1", "title": "写周报", "tags": [], "status": "todo", "createdAt": 0 }], "nextId": 2 } }
```

老用户打开新版本时，存储中还是第 1 版的数据。所以保存的数据要带上**版本号**，读取时先看版本：是旧版本，就把它**转换**（迁移）成新的格式；是不认识的版本，就当作读取失败。

## 读取是一个纯函数

读取的过程和 p1-01 的 `parseTaskInput` 一样，可以写成一个纯函数：输入是 `localStorage.getItem` 的结果（字符串或 `null`），输出是一个可辨识联合：

```ts
type LoadResult = { ok: true; board: Board; migrated: boolean } | { ok: false; error: string };
```

它不直接读写 localStorage，所以可以用各种“坏数据”单独测试；页面只负责把结果用起来。

:::playground{#versioned-load}
```ts file=load.ts
type Settings = { theme: 'light' | 'dark'; fontSize: number };
type LoadResult = { ok: true; settings: Settings; migrated: boolean } | { ok: false; error: string };

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

export function loadSettings(raw: string | null): LoadResult {
  if (raw === null) return { ok: true, settings: { theme: 'light', fontSize: 16 }, migrated: false };
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'JSON 格式不正确' };
  }
  if (!isObject(data)) return { ok: false, error: '数据的格式不正确' };
  if (data['version'] === 1) {
    // 第 1 版：只有 dark: boolean
    const dark = data['dark'];
    if (typeof dark !== 'boolean') return { ok: false, error: '第 1 版的数据不正确' };
    return { ok: true, settings: { theme: dark ? 'dark' : 'light', fontSize: 16 }, migrated: true };
  }
  if (data['version'] === 2) {
    const theme = data['theme'];
    const fontSize = data['fontSize'];
    if ((theme !== 'light' && theme !== 'dark') || typeof fontSize !== 'number') return { ok: false, error: '第 2 版的数据不正确' };
    return { ok: true, settings: { theme, fontSize }, migrated: false };
  }
  return { ok: false, error: `不支持的版本：${String(data['version'])}` };
}
```
```ts file=main.ts
import { loadSettings } from './load';

const samples = [
  null,
  '{"version":2,"theme":"dark","fontSize":18}',
  '{"version":1,"dark":true}',
  '{"version":3}',
  '{"version":2,"theme":"blue","fontSize":18}',
  'not json',
];
for (const raw of samples) console.log(raw, '→', loadSettings(raw));
```
- 第 8–13 行：`JSON.parse` 遇到不合法的 JSON 会抛出异常，在这里把它变成一个普通的失败结果。
- 第 15–20 行：第 1 版的数据被**转换**成第 2 版，`migrated: true` 告诉调用方“应该用新的格式重新保存一次”。
- 第 27 行：不认识的版本（例如以后的第 3 版被旧版本的应用读到）不要猜，当作失败。
:::

## 读取失败时：不要丢掉用户的数据

读取失败时，应用要能继续工作，所以从一个空的任务板开始。但**原来的数据不能悄悄消失**：也许只是一个字段被改坏了，用户（或者开发者）还能把它找回来。所以先把原来的字符串保存到另一个键（例如 `taskboard:backup`），再用 `role="alert"` 告诉用户发生了什么、数据去了哪里。备份本身也可能失败，这时原来的数据只剩下一份，宁可这一次的修改不保存，也不要覆盖它。把旧版本的数据转换成新格式再保存，同样是一次覆盖，也要先备份。

保存也可能失败：`localStorage.setItem` 在存储空间用完时会抛出 `QuotaExceededError`。保存失败不应该让添加任务也失败：捕获异常，提示用户，下一次保存成功时再去掉提示。还有一种情况是存储根本用不了：用户在浏览器中阻止网站存储数据时，**访问 `localStorage` 本身**就会抛出 `SecurityError`，所以读取也要放在 `try` 中，否则应用一打开就崩溃了。

## 哪些东西该保存

| 状态 | 保存在哪里 | 原因 |
| --- | --- | --- |
| 任务板（`board`） | localStorage | 这是用户的数据，下次打开时要恢复 |
| 筛选条件 | 地址的查询参数（p1-04） | 它描述的是“现在在看什么”，可以通过链接分享 |
| 正在改名的任务（`view`） | 不保存 | 只属于这一次打开的页面，下次打开不应该还停在编辑状态 |

::exercise{#storage-format}

## 编程挑战

::exercise{#persist-board}

::quiz

## 常见错误

- **保存时不带版本号**：以后格式变了，就分不清读到的是哪一版。
- **读取时直接 `JSON.parse` 再当作 `Board` 使用**：数据不对时，错误会在很久之后、离原因很远的地方出现。在入口处验证（e06）。
- **读取失败时直接用空数据覆盖**：用户原来的数据就永远没了。先备份，再提示。
- **不处理 `setItem` 的异常**：存储满了，整个操作就失败了。捕获它，提示用户。
- **把界面状态也存进去**：下次打开时还停在编辑状态，或者带着一个早已过时的筛选条件。

## 下一步

任务板在浏览器中的部分完成了。最后一个里程碑（p1-06）要先学习 F 阶段的工程化与测试：把它下载成一个本地的 Vite 工程，在自己的电脑上运行、测试和构建，再加上导出与导入的功能。
