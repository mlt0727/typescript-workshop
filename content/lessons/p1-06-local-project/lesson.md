---
version: 1
mode: dom
estimatedMinutes: 60
review: ai-draft
problem: 任务板一直运行在这个网站的沙箱里。真实的项目在你自己的电脑上：用 Vite 运行，用 Vitest 测试，用 Git 管理（F 阶段）。这一个里程碑先把任务板下载成本地的 Vite 项目，在本机运行、测试和构建；然后加上用户真正需要的一个功能：把任务板导出成 JSON（备份，或者换一台电脑导入）和 Markdown（贴进文档），以及从文件导入。导入的文件和 localStorage 中的数据一样不可信，要用同一套规则验证，替换之前还要请用户确认。
objectives:
  - 把网站上的练习下载为本地的 Vite 项目，在本机运行开发服务器、测试、类型检查和生产构建，知道项目中每个文件的作用
  - 用 Blob、URL.createObjectURL 和带 download 属性的链接在浏览器中生成并下载文件，用完之后释放 object URL
  - 用 type="file" 的输入框和 file.text() 读取用户选择的文件，像对待 localStorage 中的数据一样验证它，替换数据之前请用户确认
  - 把任务板导出为结构固定、对特殊字符转义的 Markdown 文本
references:
  - title: Blob — MDN
    url: https://developer.mozilla.org/zh-CN/docs/Web/API/Blob
    checked: 2026-10-20
  - title: URL.createObjectURL() — MDN
    url: https://developer.mozilla.org/zh-CN/docs/Web/API/URL/createObjectURL_static
    checked: 2026-10-20
  - title: HTMLAnchorElement.download — MDN
    url: https://developer.mozilla.org/zh-CN/docs/Web/API/HTMLAnchorElement/download
    checked: 2026-10-20
  - title: input type="file" — MDN
    url: https://developer.mozilla.org/zh-CN/docs/Web/HTML/Reference/Elements/input/file
    checked: 2026-10-20
  - title: Blob.text() — MDN
    url: https://developer.mozilla.org/zh-CN/docs/Web/API/Blob/text
    checked: 2026-10-20
  - title: CommonMark Spec 0.31.2：Backslash escapes
    url: https://spec.commonmark.org/0.31.2/#backslash-escapes
    checked: 2026-10-20
---

## 把任务板搬到自己的电脑上

这个网站的每一道练习都有一个“下载本地项目”按钮。它把你当前的代码、练习的支持文件和验收测试，连同配置文件一起打包成一个 `.zip`：解压之后就是一个普通的 Vite 项目，和 f02 中用 `npm create vite` 创建的项目结构相同。

在 p1-05 的编程挑战中点击“下载本地项目”（下载的是你在那道题中当前的代码），解压，然后在这个文件夹中运行（需要 f01 中安装的 Node.js）：

1. `npm install`：安装依赖。如果 Node.js 的版本低于 jsdom 要求的 22.22.2、24.15，npm 会给出 `EBADENGINE` 警告（编写本课时用的 Node.js 24.13 就会出现这个警告，测试仍然能运行），升级 Node.js 就会消失；
2. `npm run dev`：启动开发服务器，打开终端显示的地址（默认是 `http://localhost:5173`），任务板就在你自己的浏览器中运行了：数据保存在这个地址的 localStorage 中，和这个网站上的互不相干；
3. `npm test`：运行验收测试。编写本课时用 p1-05 的参考解实际运行的结果是 `Tests  13 passed (13)`；
4. `npm run typecheck`：用和这个网站相同的编译选项做类型检查，没有错误时什么也不输出；
5. `npm run build`：先类型检查，再构建到 `dist`。实际的输出（节选）：

```text
dist/index.html                  1.14 kB │ gzip: 0.57 kB
dist/assets/index-D8J8pCed.css   0.76 kB │ gzip: 0.39 kB
dist/assets/index-BGoKqAQz.js   12.13 kB │ gzip: 4.98 kB
```

项目中除了你写的文件，还有这些：

| 文件 | 作用 |
| --- | --- |
| `package.json` | 依赖和脚本（f01）：`dev`、`build`、`preview`、`test`、`test:watch`、`typecheck` |
| `tsconfig.json` | 编译选项，与这个网站检查代码时使用的完全相同，另外加上了 `vite/client` 的类型（f02、f03） |
| `vite.config.ts` | Vite 和 Vitest 的配置：测试运行在 jsdom 中，运行前先执行 `setup-tests.ts`（f08） |
| `setup-tests.ts` | 注册 jest-dom 的匹配器；每个测试开始前恢复地址、清空存储、把页面恢复成 `index.html` 的初始状态并重新运行 `main.ts`，和这个网站的 DOM 模式一样 |
| `vitest-browser.ts` | p1-05 的测试用到了这个网站提供的 `page.reload()`：这个文件在本机提供同样的功能 |
| `README.md` | 运行的方法，以及本机与这个网站的区别 |
| `.gitignore` | 不提交 `node_modules`、`dist` |

接下来用 f10 的方法把它变成一个 Git 仓库：`git init`、`git add .`、`git commit -m "任务板：从 TypeScript 工坊导出"`。之后每完成一步就提交一次。

本机的测试运行在 jsdom 中，它没有布局，也不加载 CSS。检查布局的测试（d03、d04 的练习）在本机会失败，README 中写明了这一点；任务板的测试只检查结构和行为，所以都能通过。

## 在浏览器中生成文件

导出功能要在**浏览器中**生成一个文件，交给用户保存，不经过服务器。需要三样东西：

- **`Blob`**：内存中的一段数据，带有类型（`type`，例如 `application/json`）。`new Blob([文本], { type })` 创建它，`await blob.text()` 读回其中的文本；
- **object URL**：`URL.createObjectURL(blob)` 返回一个 `blob:` 开头的地址，在这个页面中指向这个 Blob；
- **带 `download` 属性的链接**：`<a href="blob:…" download="taskboard.json">` 被点击时，浏览器不是打开这个地址，而是把它保存为文件，`download` 的值就是建议的文件名。代码中创建一个这样的链接，调用 `click()`，就开始下载了。

:::playground{#blob}
```ts file=main.ts
const board = { tasks: [{ id: 't1', title: '写周报', tags: ['工作'], status: 'todo', createdAt: 1 }], nextId: 2 };
const text = JSON.stringify({ version: 2, board }, null, 2);

const blob = new Blob([text], { type: 'application/json' });
console.log(blob.size, blob.type, text.length);
console.log((await blob.text()) === text);

const url = URL.createObjectURL(blob);
console.log(url.startsWith('blob:'));

const link = document.createElement('a');
link.href = url;
link.download = 'taskboard.json';
link.textContent = '下载 taskboard.json';
document.body.append(link);
```
```html file=index.html
<!doctype html>
<html lang="zh-CN">
  <body>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```
- 第 5 行输出 `237 application/json 227`：`blob.size` 是**字节数**，比 `text.length`（UTF-16 的长度，a04）大 10，因为其中的 5 个汉字在 UTF-8 中各占 3 个字节；
- 第 6 行：读回的文本与原来的相同；
- 这个网站的预览运行在沙箱中，沙箱没有开启下载的权限（iframe 的 `sandbox` 属性中没有 `allow-downloads`），所以这里不要指望点击链接能下载文件。在本机运行（`npm run dev`）时，同样的代码可以真的下载。下面的编程挑战用测试检查生成的文件。
:::

object URL 会让 Blob 一直留在内存中，直到页面关闭。用完之后调用 `URL.revokeObjectURL(url)` 释放它。常见的写法是点击之后，用 `setTimeout` 在下一个任务中释放：

```ts
function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url));
}
```

## 读取用户选择的文件

导入的第一步是让用户选择文件：`<input type="file" accept=".json,application/json">`。`accept` 只是让文件选择框优先显示这些类型，用户仍然可以选择任何文件，所以它不能代替检查。

选择之后，输入框触发 `change` 事件，`input.files` 中是选择的文件（`File`，它是一种 `Blob`，还有 `name`、`size`）。读取它的内容用 `await file.text()`。

**文件的内容和 localStorage 中的数据一样不可信**（p1-05）：可能是别的程序生成的 JSON，可能是旧版本的格式，也可能根本不是 JSON。所以：

- 先看 `file.size`：太大的文件不读取，以免读取和解析时页面卡住；
- 用 p1-05 的 `loadBoard` 验证内容：它能识别旧的格式并转换，遇到坏数据返回失败的原因，而不是抛出异常；
- 验证通过之后，**先请用户确认**，再替换当前的任务板：导入会覆盖现在所有的任务，这是一个难以撤销的操作；
- 最后把输入框的 `value` 清空。否则用户再次选择**同一个**文件时，输入框的值没有变化，不会触发 `change` 事件。

## 导出成 Markdown

JSON 是给程序读的；想把任务板贴进文档或者发给别人，Markdown 更合适。导出的格式要**固定**：同样的任务板总是得到同样的文本，别的工具才能处理它，测试也才能写。

标题是用户输入的，里面可能有在 Markdown 中有特殊含义的字符：`**重要**` 会变成粗体，`[链接](地址)` 会变成链接，`<b>` 可能被当成 HTML。CommonMark 规定，任何 ASCII 标点符号前面加上反斜杠，就只表示这个字符本身（`\*` 显示为 `*`）。下面的小任务对这几种字符转义：`\`、`` ` ``、`*`、`_`、`[`、`]`、`<`、`>`、`#`。转义 `#` 是为了和标签区分：导出的一行中，`#` 开头的词都是标签。

::exercise{#export-markdown}

## 编程挑战

::exercise{#import-export}

::quiz

## 常见错误

- **不释放 object URL**：每导出一次，Blob 就在内存中多留一份，直到页面关闭。点击之后调用 `URL.revokeObjectURL`。
- **直接使用 `JSON.parse` 的结果**：导入的文件可能是任何内容。用和读取 localStorage 相同的验证（`loadBoard`），失败时说明原因，不要让应用崩溃。
- **不确认就覆盖**：导入会替换所有的任务。替换之前用 `confirm` 或者对话框（g15）请用户确认。
- **没有清空文件输入框**：再次选择同一个文件时不会触发 `change` 事件，看起来像是“导入没有反应”。
- **以为 `accept` 能限制文件的类型**：它只影响文件选择框的显示。代码中仍然要检查文件的大小和内容。
- **Markdown 不转义**：标题中的 `*`、`[`、`<` 会改变导出的文档的样子。
