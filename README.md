# articles

一个**在浏览器里从源代码渲染**的博客。没有 SSG 的预渲染页面，也没有 SSR 的请求时渲染：构建期只生成元数据，页面在读者打开 URL 时由 SPA 取回 `.md` / `.js` / `.html` 源文件并现场生成。

技术栈：**Node.js + TypeScript + Cloudflare Pages**，CI 由 Codeberg 的 act 风格 workflow 执行。

```text
浏览器
  ├─ GET /hello
  ├─ GET /meta/index.json        # 路由、adapter 表、条目清单
  ├─ GET /meta/hello.json        # 变体、标题、prev/next
  ├─ GET /content/hello.md       # 源文件
  └─ md.ext.pages.js → md-loader 渲染

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
npm run build      # vendor + shell + metadata + stage
npm run metadata   # 只生成元数据（CI 的核心职责）
npm run bundle     # 只生成 vendor/、sw.js、render/index.html
npm run stage      # 把站点树复制到 dist/
npm run typecheck  # tsc --noEmit
npm test           # node:test
npm run deploy     # build + wrangler pages deploy dist
```

`npm run dev` 会先完整构建一次；修改源文件后重新运行即可。`dist/` 通过 `_redirects` 模拟 Cloudflare Pages 的 SPA 回退行为。

页面第一次加载时会注册 Service Worker；随后 `render/app.ts` 及 `shared/*.ts` 通过 `sw.js` + `ts-blank-space` 在浏览器里现场去类型后执行。需要 localhost 或 HTTPS。

## 目录结构

```text
articles/
├─ adapters/                 # 每个 adapter 都是可被浏览器执行/加载的源文件
│  ├─ js.ext.js              # 定义 <ext>-loader；直接 define adapter class
│  ├─ pages.js.ext.js        # JSLoader 工厂
│  ├─ md.ext.pages.js        # .md 工厂：file -> function(shadow)
│  ├─ html.ext.pages.js      # .html 工厂
│  ├─ json.ext.html          # .json 的真实 HTML adapter
│  └─ [...].ext.pages.js     # 目录工厂
├─ content/                  # 发布的内容；URL 严格对应这里的路径
├─ meta/                     # 构建产物：每篇 sidecar + index.json
├─ render/
│  ├─ boot.js                # 注册 Service Worker，再 import app.ts
│  ├─ app.ts                 # SPA：路由、取数、adapter 分发（TS 源文件）
│  ├─ lib/*.ts               # 客户端运行时（TS 源文件）
│  ├─ markdown_deps.ts       # 浏览器 markdown 管线（TS，动态 import）
│  ├─ index.template.html    # 外壳模板（构建时注入 import map）
│  ├─ style.css              # 外壳样式（4 空格缩进）
│  ├─ shadow.css             # Shadow DOM 基础样式
│  └─ markdown.css           # Markdown 排版
├─ scripts/                  # Node + TypeScript 构建期
│  ├─ build.ts               # 全量构建
│  ├─ metadata.ts            # 只生成元数据
│  ├─ bundle.ts              # 只生成 node_modules vendor + shell + sw
│  ├─ dev.ts                 # 本地静态服务器（模拟 Pages 回退）
│  └─ gen/                   # metadata / sitemap / atom / feed / stage ...
├─ shared/                   # Node 与浏览器共享的纯逻辑（浏览器直接加载 TS）
├─ sw.template.js            # Service Worker 模板（构建生成 sw.js）
├─ vendor/                   # 构建产物：node_modules 依赖的 ESM bundle
├─ site.json                 # 站点标题、URL、作者、语言
├─ _redirects                # /* → /index.html 200
├─ _headers                  # Cloudflare Pages 缓存头
└─ .forgejo/workflows/       # Codeberg CI（act 兼容）
```

## 客户端 TypeScript 执行

项目**不打包自己的代码**；只有 `node_modules` 里的依赖会被 Rollup 打包到 `vendor/`。

```text
render/index.html
  └─ render/boot.js               # 注册 sw.js，等待它接管页面
       └─ import("/render/app.ts")
            └─ Service Worker 拦截 .ts 请求
                 ├─ fetch 源文件
                 ├─ ts-blank-space 去类型（保留行列位置）
                 └─ 返回 text/javascript 给浏览器原生 ESM
```

- Service Worker 位于站点根目录，scope 是 `/`。
- 只有 `request.mode != "navigate"` 的 `.ts` 请求会被编译；直接访问 `.ts` 文件仍然看到源码。
- 相对 import（如 `../shared/ext.ts`）保持原 URL，浏览器会继续触发 Service Worker。
- 裸 import（`vfile`、`yaml`、`unified` 等）由构建生成的 import map 指向 `vendor/*.js`。
- `sw.template.js` 构建时注入 `ts-blank-space` 的哈希 URL，生成 `sw.js`。
- `ts-blank-space` 只擦除类型，不做降级；本项目遵守 `erasableSyntaxOnly`。


## adapter 契约

文件名：

```text
<负责的扩展名>.ext.<编写 adapter 使用的语言扩展名>
```

例如：

| 文件 | 负责 | 形态 |
|---|---|---|
| `js.ext.js` | `.js` | `function(Adapter)`：`customElements.define(tag, Adapter)` |
| `pages.js.ext.js` | `.pages.js` | `function(factory)`：返回 `JSLoader` class |
| `md.ext.pages.js` | `.md` | `function(file)`：返回 `function(shadow)` |
| `html.ext.pages.js` | `.html` | 同上 |
| `json.ext.html` | `.json` | 真实 HTML adapter；由 html factory 执行 |
| `[...].ext.pages.js` | 目录 | 同上 |

### 链式调用

```text
js.ext(
  pages.js.ext(
    md.ext.pages.js
  )
)
```

- `md.ext.pages.js(file)` 返回 `function(shadow)`。
- `pages.js.ext(onMount)` 返回 `JSLoader` class。
- `js.ext.js(JSLoader)` 负责 define。

`js.ext.js`：

```js
export default function (Adapter) {
  const tag = `${Adapter.meta.ext.replaceAll(".", "-")}-loader`;
  customElements.define(tag, Adapter);
  return Adapter;
}
```

`pages.js.ext.js`：

```js
export default function (factory) {
  return class JSLoader extends HTMLElement {
    static meta = factory.meta;

    constructor() {
      super();
      this.attachShadow({ mode: "open" });
    }

    async connectedCallback() {
      const file = this.file ??
        new VFile({ path: this.getAttribute("path") ?? "" });
      const mount = factory(file);
      this.onMount = await mount(this.shadowRoot);
    }
  };
}
```

内容路径通过属性传入：

```html
<md-loader path="/content/hello.md"></md-loader>
```

loader class 每个扩展名只生成一次；`path` 在实例挂载时决定内容文件。

### Adapter 工厂

`md` / `html` / 目录 adapter 默认导出：

```js
export default function (file) {
  return function (shadow) {
    // 渲染 file 到 shadow
  };
}
```

并透传最终扩展名：

```js
factory.meta = meta;
```

例如：

- `md.ext.pages.js` → `<md-loader>`
- `html.ext.pages.js` → `<html-loader>`
- `json.ext.html` → `<json-loader>`；真实 HTML，由 html factory 执行，形成 `json → html → pages → js`
- `[...].ext.pages.js` → `<directory-loader>`
- `pages.js.ext.js` → `<pages-js-loader>`

### 已实现的 adapter

| 文件 | 元数据来源 | 渲染方式 |
|---|---|---|
| `js.ext.js` | JSDoc：`# 标题`、`@routable`、`@date`、`@tags [...]` | `pages-js-loader` import 内容 `default(shadow)` |
| `pages.js.ext.js` | 同上，但默认 routable | `JSLoader` 调 factory |
| `md.ext.pages.js` | YAML frontmatter / 第一个 `#` 标题 | 工厂函数渲染 markdown |
| `html.ext.pages.js` | `<meta name="title/date/tags/description">` | 工厂函数渲染 HTML |
| `json.ext.html` | HTML 的 meta 标签 | 由 html 工厂渲染真实 HTML |
| `[...].ext.pages.js` | — | 工厂函数用 loader 实例字段渲染列表 |
## 路由与 404

URL 严格对应 `content/` 下的路径：

| URL | 源文件 |
|---|---|
| `/hello` | `content/hello.md` |
| `/about` | `content/about.pages.js` |
| `/sample` | `content/sample.json` |
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
- 浏览器侧**只加载从源码 import 自动发现的 `node_modules` 依赖**，不存在手写包列表。
- 采集用 `ts-blank-space` + `es-module-lexer`：`scripts/lib/imports.ts` 先沿用客户端的同一套类型擦除，再用一个纯 ESM lexer 只读 import；扫描 `render/`、`shared/`、`adapters/`、`content/` 和 `sw.template.js`，不需要额外的 build。
- `scripts/lib/vendor_bundle.ts` 只做一次 Rollup 多入口 build：虚拟入口 `vendor:<specifier>` 由插件用 `this.resolve()`（`@rollup/plugin-node-resolve`）解析到 node_modules；`load` 会拒绝任何 node_modules 之外的文件。因此项目源码不可能被误打进 vendor。
- Rollup 自动做多入口 code splitting，共享依赖进入 `vendor/chunks/`。重复打包检查放在 `npm test`：测试用同一套配置执行 `bundle.generate({ write: false })`，断言每个非空 module 只属于一个 chunk；构建本身只负责产出。
- `render/index.html` 的 import map 由构建生成，entry 文件名带内容哈希；`package-lock.json` 是唯一的依赖真相。
- 应用代码（`render/*.ts`、`shared/*.ts`、`adapters/*.js`）**不打包**：`.ts` 由 Service Worker 用 `ts-blank-space` 现场去类型，`.js` 直接作为源文件执行。读者看到的执行代码就是源码。
- `sw.js` 由 `sw.template.js` 生成：模板里写普通的 `from "ts-blank-space"`，构建时按同一份依赖表改写成带哈希的 `/vendor/...` URL；它自身使用 `Cache-Control: no-cache`。

## CI 与 Cloudflare Pages

`.forgejo/workflows/deploy.yml`：

1. `actions/checkout@v4`，`fetch-depth: 0`（git 时间是元数据来源之一）；
2. `actions/setup-node@v4` + `npm ci`；
3. `npm run typecheck`、`npm test`；
4. `npm run bundle`（node_modules vendor + shell + sw）、`npm run metadata`（只生成元数据）、`npm run stage`；**不渲染任何页面**；
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

`_headers` 给 `meta/`、`content/` 设置 60 秒缓存 + `stale-while-revalidate`，带哈希的 `vendor/` 使用长缓存，`sw.js` 不缓存。

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
/**
 * # 标题
 * @routable
 * @date 2026-10-24
 * @tags ["demo"]
 * @param {ShadowRoot} shadow
 */
export default function (shadow) {
  const article = document.createElement("article");
  article.className = "markdown";
  article.innerHTML = "<h1>标题</h1>";
  shadow.append(article);
}
```

## 添加 adapter

在 `adapters/` 新建 `<负责的扩展名>.ext.<语言扩展名>`：

1. `export const meta = Object.freeze({...})`；
2. `export const parse = async (file) => ({...})`，只给构建期提取元数据；
3. `export default function (file) { return function (shadow) {...}; }`；
4. 给工厂挂上 `factory.meta = meta`，让 loader class 拿到最终扩展名。

运行时通过 `meta/index.json` 里的 adapter 表发现它；`js.ext.js(pages.js.ext(adapterFactory))` 生成并 define `<final-ext>-loader`。内容路径通过 `path` 属性传给 loader，例如 `<md-loader path="/content/hello.md">`。

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

与旧仓库的必要差异：新栈要求 `package.json` / `tsconfig.json` / import map；Rollup 只用于把 `node_modules` 依赖打成 `vendor/`，不打包项目代码；adapter 按本项目的契约使用 **default export class**（旧 loader 是具名 `Loader`）。

## 许可

- 代码（`scripts/`、`render/`、`adapters/`、`shared/`）：MIT，见 [LICENSE](LICENSE)。
- 文章（`content/`）：CC BY-SA 4.0。
