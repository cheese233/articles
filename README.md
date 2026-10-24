# articles

一个**在浏览器里从源代码渲染**的博客。没有 SSG 的预渲染页面，也没有 SSR 的请求时渲染：构建期只生成元数据，页面在读者打开 URL 时由 SPA 取回 `.md` / `.js` / `.html` 源文件并现场生成。

技术栈：**Node.js + TypeScript + Cloudflare Pages**，CI 由 Codeberg 的 act 风格 workflow 执行。

```text
浏览器
  ├─ GET /hello
  ├─ GET /meta/index.json        # 路由、adapter 表、条目清单
  ├─ GET /meta/hello.json        # 变体、标题、prev/next
  ├─ GET /content/hello.md       # 源文件
  └─ md.ext.pages.js → 挂载 Web Component 到 Shadow DOM

CI（不渲染任何页面）
  ├─ 扫描 content/
  ├─ 用 adapter.parse() 提取元数据
  └─ 写 meta/、sitemap.xml、atom.xml、feed.json、robots.txt
```

## 和 SSG / SSR 的区别

| | SSG | SSR | 本项目 |
|---|---|---|---|
| 页面 HTML | 构建期生成 | 请求时生成 | **浏览器生成** |
| 构建产物 | 所有页面 | 服务端程序 | **元数据 + 源文件** |
| 404 | 服务器 | 服务器 | **客户端看 content-type** |
| 读者可审计源码 | 视配置 | 视配置 | **源文件就是发布物** |

## 快速开始

```bash
npm install
npm run dev        # 构建到 dist/，然后在 http://127.0.0.1:8788 提供服务
```

其他命令：

```bash
npm run build      # vendor + shell + client + metadata + stage
npm run metadata   # 只生成元数据（CI 的核心职责）
npm run bundle     # 只生成 vendor/、render/index.html、render/app.js
npm run stage      # 把站点树复制到 dist/
npm run typecheck  # tsc --noEmit
npm test           # node:test
npm run deploy     # build + wrangler pages deploy dist
```

`npm run dev` 会先完整构建一次；修改源文件后重新运行即可。`dist/` 通过 `_redirects` 模拟 Cloudflare Pages 的 SPA 回退行为。

## 目录结构

```text
articles/
├─ adapters/                 # 每个 adapter 都是可被浏览器执行/加载的源文件
│  ├─ js.ext.js              # 根 WebElements + .js；直接 import，不属于任何父 adapter
│  ├─ pages.js.ext.js        # 处理 .pages.js；class 继承 WebElements
│  ├─ md.ext.pages.js        # 处理 .md；class 继承 PagesAdapter
│  ├─ html.ext.pages.js      # 处理 .html；class 继承 PagesAdapter
│  └─ [...].ext.pages.js     # 处理目录；class 继承 PagesAdapter
├─ content/                  # 发布的内容；URL 严格对应这里的路径
├─ meta/                     # 构建产物：每篇 sidecar + index.json
├─ render/
│  ├─ app.ts                 # SPA：路由、取数、adapter 分发
│  ├─ index.template.html    # 外壳模板（构建时注入 import map）
│  ├─ style.css              # 外壳样式（4 空格缩进）
│  ├─ shadow.css             # Shadow DOM 基础样式
│  ├─ markdown.css           # Markdown 排版
│  └─ markdown_deps.ts       # 浏览器 markdown 管线（vendor 入口）
├─ scripts/                  # Node + TypeScript 构建期
│  ├─ build.ts               # 全量构建
│  ├─ metadata.ts            # 只生成元数据
│  ├─ bundle.ts              # 只生成客户端 bundle
│  ├─ dev.ts                 # 本地静态服务器（模拟 Pages 回退）
│  └─ gen/                   # metadata / sitemap / atom / feed / stage ...
├─ shared/                   # Node 与浏览器共享的纯逻辑
├─ site.json                 # 站点标题、URL、作者、语言
├─ _redirects                # /* → /index.html 200
├─ _headers                  # Cloudflare Pages 缓存头
└─ .forgejo/workflows/       # Codeberg CI（act 兼容）
```

## adapter 契约

文件名：

```text
<负责的扩展名>.ext.<编写 adapter 使用的语言扩展名>
```

例如：

| 文件 | 负责 | 父 adapter |
|---|---|---|
| `md.ext.pages.js` | `.md` | `pages.js.ext.js` |
| `html.ext.pages.js` | `.html` | `pages.js.ext.js` |
| `[...].ext.pages.js` | 目录 | `pages.js.ext.js` |
| `pages.js.ext.js` | `.pages.js` | `js.ext.js` |
| `js.ext.js` | `.js` | **无，直接 `import()`** |

### Web Components 与父 adapter 链

所有页面 adapter 都是 Web Component，基类叫 `WebElements`：

```text
js.ext.js  (WebElements, .js)
  └─ pages.js.ext.js  (PagesAdapter, .pages.js)
       ├─ md.ext.pages.js    (.md)
       ├─ html.ext.pages.js  (.html)
       └─ [...].ext.pages.js (directory)
```

父 adapter 不是通过 `module()` 调用的，而是通过 **ESM import + class extends**：

```js
// pages.js.ext.js
import { WebElements } from "./js.ext.js";
export default class PagesAdapter extends WebElements {}

// md.ext.pages.js
import PagesAdapter from "./pages.js.ext.js";
export default class MarkdownAdapter extends PagesAdapter {}
```

- 运行时直接 `import()` adapter 文件，父 adapter 的模块/类会随 import 链执行；运行时会先加载父 adapter，并检查 `Adapter.prototype instanceof Parent`，不满足就直接报错。
- `js.ext.js` 是唯一没有父 adapter 的模块，直接执行，避免自环；它的 default export 就是 `WebElements`。
- 运行时把 adapter class 注册成自定义元素（`customElements.define`），然后 `new Adapter(vfile)` + 挂载。挂载就是渲染，没有 `module()` / `render()` 两个阶段。
- 一个 `.pages.js` 或 `.js` 模块如果 default export 的是自定义元素 class，`js.ext.js` 会直接 define + 挂载它；如果是函数，则把页面的 `ShadowRoot` 作为参数调用。

### 类接口

```js
const meta = Object.freeze({
  ext: "pages.js",
  lang: "js",
  priority: 10,
});

export default class PagesAdapter extends WebElements {
  static meta = meta;

  /** @type {import("vfile").VFile} */
  file;

  /** @param {import("vfile").VFile} file */
  constructor(file) {
    super();
    this.file = file;
  }

  /** 只给构建期用：解析元数据，不碰 DOM。 */
  async parse() {}

  /** 浏览器生命周期：挂载即渲染。 */
  async connectedCallback() {
    // 渲染，然后 dispatchEvent(new Event("rendered"))
    // 失败时 dispatchEvent(new Event("error"))
  }
}
```

- `static meta` 保存 adapter 的元信息（`meta` 常量在模块级声明）。
- `constructor` 接收一个 [vfile](https://github.com/vfile/vfile)。
- `parse()` 只读取 `this.file`，不碰 DOM；CI 用它生成元数据。
- `connectedCallback()` 是唯一的渲染钩子；挂载组件即可，不再有 `module()` / `render()` 拆分。
- `routable` 由 adapter 决定：**不返回 `routable` 就是中间件**（不进路由表、不进 feed）。
- `[...]` 表示 adapter 接受目录；`posts.[...]` 只接受 `/posts/` 及其子目录。
- 在 Node 构建期，`WebElements` 继承的是一个空的 fallback class（浏览器里是 `HTMLElement`），所以 `parse()` 可以在没有 DOM 的环境执行。

### 已实现的 adapter

| 文件 | 元数据来源 | 渲染方式 |
|---|---|---|
| `js.ext.js` | JSDoc：`# 标题`、`@routable`、`@date`、`@tags [...]` | 挂载 default export 的 class，或调用函数 |
| `pages.js.ext.js` | 同上，但默认 routable | 继承 `WebElements` |
| `md.ext.pages.js` | YAML frontmatter / 第一个 `#` 标题 | `connectedCallback` 里跑 unified + remark + rehype |
| `html.ext.pages.js` | `<meta name="title/date/tags/description">` | `connectedCallback` 里 `innerHTML` + 执行 module script |
| `[...].ext.pages.js` | — | `connectedCallback` 里用 `meta/index.json` 渲染列表 |


## 路由与 404

URL 严格对应 `content/` 下的路径：

| URL | 源文件 |
|---|---|
| `/hello` | `content/hello.md` |
| `/about` | `content/about.pages.js` |
| `/hello.md` | `content/hello.md`（带后缀的直链） |
| `/posts/` | 目录，由 `[...].ext.pages.js` 渲染 |

客户端解析顺序：

1. 路径是已知目录 → 目录 adapter；
2. 路径带已知扩展名 → 查 `meta/<stem>.json`，确认变体存在；
3. 否则视为干净 URL → 查 `meta/<stem>.json`；
4. 都失败 → 取 `content/404.md` 渲染 404。

**Cloudflare Pages 对不存在的路径返回 200 + `text/html`（SPA 外壳）**，所以不能只看 `response.ok`。客户端检查 `content-type`：

- `.md` → `text/markdown`
- `.js` / `.pages.js` → `text/javascript`
- `.json` → `application/json`
- `.html` 是歧义的（外壳与真实 HTML 同为 `text/html`），所以带 `.html` 后缀的请求先核对 sidecar 变体。

## 构建产物

### `meta/index.json`

```json
{
  "v": 1,
  "site": { "url": "...", "title": "...", "author": "...", "description": "...", "language": "zh-CN" },
  "adapters": [
    { "ext": "md", "lang": "pages.js", "file": "/adapters/md.ext.pages.js", "directory": false, "prefix": "" }
  ],
  "entries": [
    { "stem": "hello", "route": "/hello", "ext": "md", "file": "/content/hello.md", "title": "...", "date": "...", "updated": "...", "author": "...", "tags": [] }
  ],
  "dirs": ["/", "/posts/"]
}
```

### `meta/<stem>.json`

```json
{
  "v": 1,
  "stem": "posts/hello",
  "route": "/posts/hello",
  "ext": "md",
  "file": "/content/posts/hello.md",
  "title": "...",
  "date": "2026-10-20T00:00:00.000Z",
  "updated": "2026-10-20T00:00:00.000Z",
  "author": "...",
  "tags": ["..."],
  "summary": "...",
  "variants": [
    { "ext": "md", "file": "/content/posts/hello.md", "routable": true }
  ],
  "prev": { "route": "/older", "title": "...", "date": "..." },
  "next": null
}
```

- 键是**去掉扩展名的 stem**，避免“要先知道 suffix 才能取 metadata”的循环。
- 同一个 stem 可以有多个变体，但**最多一个 routable**；否则构建失败。
- `prev` 是更旧的一篇，`next` 是更新的一篇；有了它们，整条时间线只靠 sidecar 就能走完。
- 非 routable 的内容不写入 sidecar，也不进 `index.json`、sitemap、feed。

另外生成 `sitemap.xml`（只做 SEO，不当客户端路由表）、`atom.xml`、`feed.json`、`robots.txt`。

### 确定性

- 排序：日期倒序 + **route 升序 tie-break**，不依赖 `readdir` 顺序。
- 时间来源：frontmatter 的 `date` / `updated` > git 最后一次提交 > `SOURCE_DATE_EPOCH` > 文件 mtime（并打印警告）。
- 不写入构建时刻；Atom 的 `<updated>` 取最新条目的 `updated`。
- 同一份源码树 + 同一份 lockfile，重复构建应逐字节一致。

## 依赖：Node 与浏览器共享同一份版本

- Node 侧直接从 `node_modules` 解析。
- 浏览器侧只加载两类依赖：`yaml`、`@site/markdown`，由 `vendor/` 里的 esbuild bundle 提供。
- `render/index.html` 的 import map 由构建生成，URL 带内容哈希；`package-lock.json` 是唯一的依赖真相。
- adapter 的源码是浏览器直接执行的 `.js`，不是编译产物；读者可以查看、复制、审计。

## CI 与 Cloudflare Pages

`.forgejo/workflows/deploy.yml`：

1. `actions/checkout@v4`，`fetch-depth: 0`（git 时间是元数据来源之一）；
2. `actions/setup-node@v4` + `npm ci`；
3. `npm run typecheck`、`npm test`；
4. `npm run bundle`（客户端 shell）、`npm run metadata`（只生成元数据）、`npm run stage`；**不渲染任何页面**；
5. `node scripts/deploy.ts`：`wrangler pages deploy dist`。

需要配置：

| 类型 | 名称 | 用途 |
|---|---|---|
| Secret | `CLOUDFLARE_API_TOKEN` | Pages 部署令牌（Pages:Edit） |
| Secret | `CLOUDFLARE_ACCOUNT_ID` | 账号 ID |
| Variable | `CLOUDFLARE_PROJECT_NAME` | Pages 项目名（默认 `articles`） |
| Variable | `SITE_URL` | 可选，覆盖 `site.json` 的公开 URL |

创建 Cloudflare Pages 项目时选择 **Direct Upload**。`_redirects` 提供 SPA 回退：

```text
/*    /index.html    200
```

`_headers` 给 `meta/`、`content/` 设置 60 秒缓存 + `stale-while-revalidate`，`vendor/` 使用长缓存。

本地用 [act](https://github.com/nektos/act) 跑同一份 workflow：

```bash
act push -W .forgejo/workflows/deploy.yml \
  -s CLOUDFLARE_API_TOKEN=... \
  -s CLOUDFLARE_ACCOUNT_ID=...
```

`.actrc` 把 `codeberg-small` 映射到 act 的 Ubuntu 镜像。

## 添加内容

1. 在 `content/` 下新建文件；
2. 用对应扩展名（`.md` / `.html` / `.js` / `.pages.js`）；
3. 写上标题与日期（Markdown frontmatter、HTML meta、JS JSDoc）；
4. `npm run build`。

```md
---
title: 标题
date: 2026-10-24
tags: [meta, blog]
---

# 标题

正文。
```

```js
import WebElements from "../adapters/js.ext.js";

/**
 * # 标题
 * @routable
 * @date 2026-10-24
 * @tags ["demo"]
 */
export default class DemoPage extends WebElements {
  async connectedCallback() {
    this.classList.add("markdown");
    this.innerHTML = "<h1>标题</h1>";
  }
}
```

## 添加 adapter

在 `adapters/` 新建 `<负责的扩展名>.ext.<语言扩展名>`：

1. 声明 `const meta = Object.freeze({...})` 与 `static meta`；
2. class 继承 `WebElements`（根）或 `PagesAdapter`（页面 adapter）；
3. `constructor(file)` 保存 vfile；
4. `parse()` 只给构建期提取元数据；
5. `connectedCallback()` 负责渲染，完成后 dispatch `rendered`（失败 dispatch `error`）。

运行时通过 `meta/index.json` 里的 adapter 表发现它，直接 `import()` 并注册成自定义元素；父 adapter 通过 class 继承链参与，不再需要 `module()` 加载器。

## 代码风格

本项目刻意沿用旧 `articles` 仓库的风格：

- `.ts` / `.js` / `.json` 2 空格；`.css` / `.html` 4 空格；全仓库无 tab。
- 双引号、分号、多行尾逗号；行宽约 80，import 语句不折行。
- 文件名小写；多词用 `snake_case`（`json_feed.ts`、`markdown_deps.ts`）。
- 模块入口用匿名 `export default`；构建脚本是顶层 `await` 直线程序。
- `.js` 用 JSDoc 作为类型来源；`.ts` 主要用 `interface`，不用 `satisfies` / `as any` / `#private`。
- 浏览器侧使用 Shadow DOM（`mode: "open"`）、`innerHTML`、`<link>` 注入样式。
- CSS 设计令牌定义在 `body`，深色模式用 `prefers-color-scheme` 覆盖同名变量。
- 不使用前端框架；页面是原生 DOM。

与旧仓库的必要差异：新栈要求 `package.json` / `tsconfig.json` / esbuild / import map；adapter 按本项目的契约使用 **default export class**（旧 loader 是具名 `Loader`）。

## 许可

- 代码（`scripts/`、`render/`、`adapters/`、`shared/`）：MIT，见 [LICENSE](LICENSE)。
- 文章（`content/`）：CC BY-SA 4.0。
