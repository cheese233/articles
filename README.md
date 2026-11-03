---
title: 关于这个博客
description: 一个在浏览器里从源代码渲染的博客。
---

# articles

一个**在浏览器里从源代码渲染**的博客。没有 SSG 的预渲染页面，也没有 SSR 的请求时渲染：构建期只生成元数据，页面在读者打开 URL 时由 SPA 取回 `.md` / `.js` / `.html` 源文件并现场生成。

技术栈：**Node.js + TypeScript + Cloudflare Pages**，CI 由 GitHub Actions 执行。

```text
浏览器
  ├─ GET /                       # 根目录页
  ├─ GET /meta/index.json        # 路由、adapter 表、条目清单
  └─ GET /404.md                 # 404 中间件

CI（不渲染任何页面）
  ├─ 扫描根目录内容
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
npm run dev        # 构建到仓库根目录，然后在 http://127.0.0.1:8788 提供服务
```

其他命令：

```bash
npm run build      # vendor + shell + metadata，直接写回仓库根目录
npm run metadata   # 只生成元数据（CI 的核心职责）
npm run bundle     # 只生成 vendor/、sw.js、index.html
npm run typecheck  # tsc --noEmit
npm test           # web-test-runner (Chrome)
npm run deploy     # build + wrangler pages deploy .
```

`npm run dev` 会先完整构建一次；修改源文件后重新运行即可。仓库根目录通过 `_redirects` 模拟 Cloudflare Pages 的 SPA 回退行为。

页面第一次加载时会注册 Service Worker；随后 `render/app.ts` 及 `shared/*.ts` 通过 `sw.js` + `ts-blank-space` 在浏览器里现场去类型后执行。需要 localhost 或 HTTPS。

## 目录结构

```text
articles/
├─ adapters/                 # 每个 adapter 都是可被浏览器执行/加载的源文件
│  ├─ js.ext.js              # JS 语言 class：只解析 JSDoc
│  ├─ pages.js.ext.js        # .pages.js：模块 handler + compile
│  ├─ md.ext.pages.js        # .md 工厂：file -> function(shadow)
│  ├─ html.ext.pages.js      # .html 工厂
│  ├─ jsx.ext.pages.js       # .jsx 工厂：页面内编译后 import
│  └─ [...path].ext.pages.js # 目录工厂
├─ main.jsx                  # 首页
├─ components/               # 被嵌入的组件与样式（home.css、kipfel.jsx、kipfel/model/）
├─ 404.md                    # 404 中间件
├─ README.md                 # 仓库说明（带 frontmatter，路由 /README）
├─ posts/                    # 文章目录；当前为空
├─ meta/                     # 构建产物：每篇 sidecar + index.json
├─ render/
│  ├─ boot.js                # 注册 Service Worker，再 import app.ts
│  ├─ app.ts                 # SPA：路由、取数、adapter 分发（TS 源文件）
│  ├─ fluent.ts              # Fluent UI 组件注册
│  ├─ lib/*.ts               # 客户端运行时（TS 源文件）
│  ├─ markdown_deps.ts       # 浏览器 markdown 管线（TS，动态 import）
│  ├─ index.hbs              # 外壳 Handlebars 模板
│  ├─ style.css              # 外壳样式（4 空格缩进）
│  ├─ shadow.css             # Shadow DOM 基础样式
│  └─ markdown.css           # Markdown 排版
├─ scripts/                  # Node + TypeScript 构建期
│  ├─ build.ts               # 全量构建
│  ├─ metadata.ts            # 只生成元数据
│  ├─ bundle.ts              # 只生成 node_modules vendor + shell + sw
│  ├─ dev.ts                 # 本地静态服务器（模拟 Pages 回退）
│  └─ gen/                   # metadata / sitemap / atom / feed ...
├─ shared/                   # Node 与浏览器共享的纯逻辑（浏览器直接加载 TS）
├─ sw.js.hbs                 # Service Worker Handlebars 模板
├─ vendor/                   # 构建产物：node_modules 依赖的 ESM bundle
├─ site.json                 # 站点标题、URL、作者、语言
├─ _redirects                # /* → /index.html 200
├─ _headers                  # Cloudflare Pages 缓存头
└─ .github/workflows/        # GitHub Actions 部署
```

## 忽略清单

`scripts/lib/ignore.ts` 是内容扫描和构建产物忽略的唯一来源。

`.gitignore` 只放平台垃圾：

```text
node_modules/
.wrangler/
.dev.vars
.DS_Store
Thumbs.db
```

构建产物不写进 `.gitignore`，而是动态处理：

- `npm install` / `npm i -D` 的 `prepare` 脚本生成 `.git/info/exclude`；
- `simple-git-hooks` 的 `postinstall` 会自动安装 Git hook；`package.json` 的 `allowScripts` 已放行它的安装脚本；
- `simple-git-hooks` 的 `pre-commit` 会再次生成，并把已经暂存的构建产物从索引中剔除；
- 它是纯 JS 实现，hook 直接执行 `node scripts/sync_git_exclude.ts --staged`，Windows 下不会在 Git 的 `sh` 里再嵌套 `bash`；
- 只有 hook 丢失时才需要手动执行 `npm run hooks` 修复。

这样 `contentFiles()` 和 Git 排除使用同一份名单，不需要维护两份 ignore。

## 客户端 TypeScript 执行

项目**不打包自己的代码**；只有 `node_modules` 里的依赖会被 Rolldown 打包到 `vendor/`，包括 `fluentui-webcomponents`。

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
- 只有 `request.mode != "navigate"` 的 `.ts` 请求会被编译；直接访问 `.ts` 文件仍然看到源码。`.jsx` 不经过 Service Worker，见下文 JSX 一节。
- 相对 import（如 `../shared/ext.ts`）保持原 URL，浏览器会继续触发 Service Worker。
- 裸 import（`vfile`、`yaml`、`unified` 等）由构建生成的 import map 指向 `vendor/*.js`。
- `sw.js.hbs` 构建时注入 `ts-blank-space` 的哈希 URL，生成 `sw.js`。
- `ts-blank-space` 只擦除类型，不做降级；本项目遵守 `erasableSyntaxOnly`。

## UI 与配色

- UI 使用 [`fluentui-webcomponents`](https://github.com/cheese233/fluentui-webcomponents)，由 `render/fluent.ts` 注册 `fluent-button`、`fluent-link`、`fluent-card`、`fluent-badge`、`fluent-divider`。
- 组件和其他 `node_modules` 依赖一起由 Rolldown 打进 `vendor/`。组件直接 `import styles from "./x.css"`，Rolldown 用 `moduleTypes: { ".css": "text" }` 把它作为文本模块读取；tokens 由 `core/fluent-element.js` 导入。
- 页面骨架、目录列表、timeline、tag、交互按钮均使用 Fluent 组件；Markdown/HTML 正文仍由 adapter 渲染。
- 颜色板沿用重写前 `9436e39^`（`86eaed0`）的金棕色主题：
  - light：`#fff8f4` 背景/表面、`#211b13` 前景、`#705b40` muted、`#805611` accent、`#d3c4b4` line
  - dark：`#18120b` 背景、`#3f3830` 表面、`#ede0d4` 前景、`#dec2a1` muted、`#f5bc6f` accent、`#4f4539` line
  - seed 色 `#ffb33f` 保留在组件强调色里
- Fluent tokens 通过 `--accent-base-override` / `--neutral-base-override` 接收这套色板，组件内部自动派生品牌色和中性色。

## adapter 契约

文件名：

```text
<负责的扩展名>.ext.<编写 adapter 使用的语言扩展名>
```

例如：

| 文件 | 负责 | 形态 |
|---|---|---|
| `js.ext.js` | `.js` | 语言 class：`parse`，不生成 loader |
| `pages.js.ext.js` | `.pages.js` | class：`parse` + 模块 handler + `compile(child)` |
| `md.ext.pages.js` | `.md` | handler：`function(file)` → `function(shadow)` |
| `html.ext.pages.js` | `.html` | handler + `compile(child)`：HTML body → handler |
| `jsx.ext.pages.js` | `.jsx` | handler：import 模块，执行 `default(shadow)` |
| `[...path].ext.pages.js` | 目录 | handler |

### 编译链

adapter 只按文件名解析：

```text
<ext>.ext.<lang>
```

- `ext` 是内容扩展名
- `lang` 是父 adapter 的扩展名
- `js.ext.js` 的 `ext == lang == "js"`，作为语言根节点

`shared/adapter_graph.ts` 构建依赖树并校验：

- 重复 `ext`：冲突
- 缺失 `lang`：missing parent
- `a -> b -> a`：cycle
- `ext == lang`：合法根节点，不会递归

```ts
const graph = buildAdapterGraph(index.adapters);
const chain = adapterChain(ext, graph);
```

`render/lib/adapters.ts` 的 `compileAdapter` 沿 chain 依次 compile，产物是一个普通的 `mount(file, shadow)`，**不是元素类**：

```ts
let child = { meta, handler: chain[0].default, body };
for (const mod of chain) {
  // 具名 export，或 class 默认导出上的 static compile
  const compile = mod.compile ?? mod.default?.compile;
  if (compile) child = await compile(child);
}
return { meta: child.meta, mount: (file, shadow) => child.handler(file)(shadow) };
```

`compile` 和构建期的 `parse` 一样，两种写法任选其一：函数式 adapter 用具名 `export const compile`（如 `html.ext.pages.js`），class adapter 直接写 `static compile`（如 `pages.js.ext.js`），不需要再额外导出一份。

- `pages.js.compile`：子代（md / html / jsx / 目录）保留自己的 handler；`.pages.js` 内容本身用模块 handler（import 文件、执行 `default(shadow)`）
- `html.compile`：HTML body → handler
- `md` / 目录：没有 `compile`
- `js`：语言根节点，只有 `parse`

没有 adapter 定义自己的 `HTMLElement`。唯一的元素类是下文的 `LoaderShim`，每个 adapter 都是它的 Proxy。

`js.ext.js` 只负责 JSDoc：

```js
export default class JavaScript {
  static parse = (file) => parseJsDoc(String(file));
}
```

`pages.js.ext.js` 是 `.pages.js` 的 handler 和链上的 compile：

```js
export default class PagesJs {
  static parse = ...;
  static handler = (file) => (shadow) => import(file.path).then((m) => m.default(shadow));
  static compile = (child) => ({
    ...child,
    handler: child.handler ?? PagesJs.handler,
  });
}
```

`html.ext.pages.js` 的子代 `compile` 只返回 handler：

```js
export const compile = (child) => ({
  meta: child.meta,
  handler: () => mount(child.body),
});
```

### Adapter 工厂

`md` / `html` / 目录 adapter 默认导出 handler：

```js
export default function (file) {
  return function (shadow) {
    // 渲染 file 到 shadow
  };
}
```

内容路径仍通过 `path` 属性传入：

```html
<md-loader path="/hello.md"></md-loader>
```

loader 标签由 render 根据 `AdapterInfo.ext` 定义，adapter 自己不 define。

### 懒加载 shim（class Proxy）

`render/lib/loader_shim.ts` 里只有一个元素类 `LoaderShim`。**每个 adapter 都是这个 class 的 Proxy**，adapter 本身就是它的元素构造器：

```js
customElements.define("md-loader", adapters.md); // defineLoaders 做的事
new adapters.md();                               // 等同于 createElement("md-loader")
await adapters.md.mount(file, shadow);           // 不建元素也能渲染
```

`defineLoaders(manifest)` 返回一个只读的注册表 Proxy，按扩展名取 adapter：`adapters.md`、`adapters.jsx`、`adapters["[...path]"]`（`js.ext.js` 这种语言根节点不在里面）。adapter Proxy 的静态成员：

| 成员 | 行为 |
|---|---|
| `ext` / `info` / `tag` / `manifest` / `adapters` / `read(path)` | 本地字段，不加载任何东西；`tag` 由 `shared/ext.ts` 的 `loaderTag` 推导 |
| `loaded` | compile 链是否已加载 |
| class 自身的成员（`prototype`、`name`、`Symbol.hasInstance`…） | 原样透传，所以 `instanceof`、`customElements.define` 都正常 |
| 其他任意静态成员（`mount`、`meta`…） | 异步转发：第一次调用时 import `adapters.ts` 并 compile 整条链，之后直接转发给编译结果 |

- 不拦截构造：浏览器以 Proxy 作为 `new.target` 构造元素，`HTMLElement` 靠它找到定义，实例也靠它拿到自己的 adapter；
- `customElements.define` 会读 `observedAttributes`、`formAssociated` 等静态属性，这些名字和 `then` 被保留为真实值（`undefined`），不会变成转发函数；误 `await` 一个 adapter 也不会触发加载；
- 编译结果按扩展名缓存，并发调用共用同一次 import；失败不会被缓存；
- 注册表和 adapter Proxy 都拒绝写入、定义和删除属性。

**所有 adapter 都用这一个 shim**：

- 每个 `<ext>-loader` 的构造器就是对应的 adapter Proxy，背后都是同一个 `LoaderShim`。定义标签不 import 任何 adapter；
- 实例连接到文档时，用 `adapter.read(path)` 取源文件（`render/lib/fetch.ts`，检查 content-type），再 `adapter.mount(file, shadow)`；
- 路由（`render/app.ts`）用 `adapters[ext].tag` 创建元素；
- 目录 adapter 渲染 `main.*` 时，也通过宿主的 `adapters[main.ext].mount(...)`；
- 元素上的 `adapters` 字段就是这个注册表，内容里的脚本可以直接 `shadow.host.adapters.md.mount(file, shadow)`；
- shim 负责 shadow root、注入 `shadow.css` / `markdown.css`，渲染完成派发 `rendered`，失败派发 `error`；
- 宿主可以设置 `file` / `site` / `entries` / `route` / `entry`，默认值来自 manifest。

所以正文（md / html / jsx）可以直接嵌入其他 loader，按需加载：

```html
<jsx-loader path="/components/kipfel.jsx"></jsx-loader>
```

Markdown 管线保留原始 HTML（`allowDangerousHtml`），内容由仓库作者编写。
### 已实现的 adapter

| 文件 | 元数据来源 | 渲染方式 |
|---|---|---|
| `js.ext.js` | JSDoc：`# 标题`、`@routable`、`@date`、`@tags [...]` | 语言 class，只做 parse |
| `pages.js.ext.js` | 同上，但默认 routable | 模块 handler：import 文件，执行 `default(shadow)` |
| `md.ext.pages.js` | YAML frontmatter / 第一个 `#` 标题 | 工厂函数渲染 markdown |
| `html.ext.pages.js` | `<meta name="title/date/tags/description">` | 工厂函数渲染 HTML |
| `jsx.ext.pages.js` | JSDoc：同 `js.ext.js`，另有 `@hidden` | 模块默认导出 `function (shadow)`，返回的节点追加到 shadow |
| `[...path].ext.pages.js` | — | 工厂函数用 loader 实例字段渲染列表 |

### JSX

`.jsx` 在浏览器里编译，不进构建产物：

```text
<jsx-loader path="/x.jsx">
  └─ render/lib/jsx_loader.ts（页面内，不经过 Service Worker）
       ├─ 用 loader 已取回的源码文本（每个文件只请求一次）
       ├─ sucrase（固定版本，打进 vendor/）把 JSX 转成 __jsx.h(...) 调用
       ├─ 首行注入 import * as __jsx from "/render/lib/jsx.ts"
       ├─ es-module-lexer 找出 / ./ ../ 开头的 import，改写成绝对 URL；
       │  其中 .jsx 依赖递归走同一个 loader，换成它的 blob URL
       └─ import(blob URL)
```

- blob URL 没有可用的路径，所以相对 import 必须先改写；裸 import 不改，照样走 import map。每个源 URL 只编译一次，循环 import 会报出完整链路。
- 编译选项只在 `shared/jsx.js` 里定义一次，页面 loader、import 扫描（`scripts/lib/imports.ts`）和测试共用。sucrase 保留行号，模块末尾带 `//# sourceURL=`，报错位置指向原文件。
- `.jsx` 永远以 `text/jsx` 源码形式提供，`fetchSource` 和 “view source” 拿到的就是 JSX；Service Worker 只处理 `.ts`。
- 测试里 sucrase 无法直接在浏览器加载（CommonJS 依赖多），`web-test-runner.config.js` 把 `sucrase` 解析到一个 stub，由它通过 server command 在 Node 里执行真正的 `transform`，`jsx_loader.ts` 本身不变。
- `render/lib/jsx.ts` 是极小的 DOM 工厂：直接生成真实节点，没有虚拟 DOM。支持 `className`、`style` 对象（含 `--custom` 属性）、`on*` 事件、`ref`、children 数组、`Fragment`、函数组件和 `fluent-*` 等自定义元素；对象/数组值按 property 设置（例如给 loader 传 `entries`），其余按 attribute。
- 元数据：`# 标题`、`@routable`、`@date`、`@tags`、`@footer`。只有写了 `@routable` 才会路由；`@hidden` 会强制不路由（不进 `index.json`、sitemap、feed），适合只被嵌入的组件。

```jsx
/**
 * # 标题
 * @routable
 * @date 2026-10-31
 * @param {ShadowRoot} shadow
 */
export default function (shadow) {
  return <article className="markdown"><h1>标题</h1></article>;
}
```
### HTML 内的脚本

HTML 的 meta / title / body 提取使用 `parse5` 的 `parseFragment`，不再用正则匹配标签。

只执行带 `async` 或 `defer` 的 `<script>`。内联脚本会被注入一个局部的 `getShadow()`，直接取得当前 shadow root：

```html
<script async type="module">
    const shadow = getShadow();
</script>
```

`getShadow` 是每个脚本模块自己的局部函数，不是全局变量，所以两个 `<html-loader>` 并发渲染也不会串。外部 `src` 脚本无法注入局部函数，仍用：

```js
const key = new URL(import.meta.url).hash.slice(1);
const shadow = window[key];
```

## 路由与 404

URL 严格对应根目录下的内容路径。当前没有文章，首页 `main.jsx` 的最近更新里只有 README。

添加文章后，例如：

| URL | 源文件 |
|---|---|
| `/README` | `README.md` |
| `/hello` | `hello.md` |
| `/hello.md` | `hello.md`（带后缀的直链） |
| `/posts/` | `posts/` 目录，由 `[...path].ext.pages.js` 渲染 |

目录 adapter 使用 Astro 风格的 bracket glob：

```text
[...path]       匹配任意深度
[slug]          只匹配一层
[[...path]]     可选 catch-all
posts.[...path] 只匹配 /posts/ 及以下
posts.[slug]    只匹配 /posts/<one>/
```

文件名里的点会变成路径分隔符，再按 `*` / `**` 段匹配。

目录默认先找该目录下的 `main.<ext>`：存在就直接渲染它，不存在才列出目录。`main.*` 不会出现在目录列表里。

首页 `/` 就是 `main.jsx`：Fluent 风格的亚克力卡片（背景模糊 + 色调 + 噪点、8px 圆角、多层阴影）显示头像、简介、宿主 `entries` 里的最近更新和链接；后面叠着一张仿 GitHub 文件视图的代码卡片（文件名、Code/Blame 切换，正文就是嵌入的 Kipfel ASCII 渲染），鼠标悬停时随指针倾斜，`prefers-reduced-motion` 下不倾斜。样式在 `components/home.css`，颜色取自 `render/style.css` 的金棕色板，深浅色和窄屏都有适配。

代码卡片的正文是 `<jsx-loader path="/components/kipfel.jsx">`：

- `components/kipfel.jsx` 写了 `@hidden`，不进 `index.json`、sitemap、feed，只被首页嵌入；
- 模型是 `components/kipfel/model/kipfel.glb`（仅限个人使用，许可见同目录 `readme.txt`），用 `three/addons` 的 `GLTFLoader` + `meshopt_decoder` 加载；
- 它由 `scripts/optimize_model.ts` 从原始的 `Kipfel_Mobile_1.1.0_opti.glb`（2.4 MB，不入库）生成，约 310 KB：
  - 保留两张 skin 共享的 146 根骨骼；
  - 474 个 morph target 只留下表情用到的 10 个（眨眼、笑眼、圆眼、四个视线方向、惊讶眉、`ω` / `○` 嘴），同时绕开 WebGPU 默认的纹理层数限制；
  - `weld` + meshopt `simplify` 减面，贴图缩到 1024² WebP，最后 meshopt 重新编码；
  - 更新模型：`node scripts/optimize_model.ts <原始.glb>`（devDependencies：`@gltf-transform/*`、`meshoptimizer`、`sharp`）；
- 骨骼驱动在 `components/kipfel_rig.js`：模型没有自带动画，每一帧直接写骨骼和 morph：
  - 姿势写成“围绕静止姿势的模型轴旋转”，按 `P⁻¹·Δ·P·L` 换到每根骨骼的局部空间，不依赖导出时的骨骼朝向；
  - 骨骼名经过 `PropertyBinding.sanitizeNodeName`（GLTFLoader 会把 `UpperArm.L` 变成 `UpperArmL`）；
  - 另外提供髋部升降和头部包围球（含耳朵），供镜头取景；
  - 蒙皮网格的包围盒停在绑定姿势，所以关闭了视锥剔除；
- 行为在 `components/kipfel_motion.js`，按时间实时求值而不是播放固定 clip，所以能对指针作出反应：
  - `run`：从远处跑向镜头，双腿交替摆动、膝盖回收、手臂反向摆动、尾巴甩动、略微蛇行；镜头固定，她越跑越大；
  - `brake`：急停，身体后仰、手臂张开保持平衡，眼睛睁圆；
  - `peek`：凑近，镜头推进到头部（含耳朵）占满画布的短边；
  - `watch`：好奇地观察——头和眼睛跟着整页的指针转（`eye_left/right/up/down` morph），随机歪头、眨眼（偶尔连眨两下），时不时睁圆眼、张嘴吃惊；
  - 点击：跑步途中点击会重新跑一遍，之后点击会吓她一下；
  - `prefers-reduced-motion` 下跳过跑步，直接停在特写，只在指针移动时更新视线；
- 行为是纯函数式的状态机，`tests/kipfel_motion.test.ts` 用固定随机数验证跑步、特写、视线和吃惊；
- `three`（固定版本）的 `three/webgpu`、`three/tsl`、`three/addons/...` 子路径由 import 扫描发现，照常打进 `vendor/`；
- 用 `WebGPURenderer` 渲染（不支持 WebGPU 时自动回退 WebGL2），后处理用 TSL 写成 ASCII 着色器，思路来自 [ASCII characters are not pixels](https://alexharri.com/blog/ascii-rendering)：
  - 运行时在 canvas 上画出 95 个可打印 ASCII 字符作为字形图集，并计算每个字形在 6 个采样圆里的覆盖率（形状向量，按维度归一化）；
  - 第一个 pass 每个格子一个片元：在 6 个采样圆里采样场景亮度得到采样向量，做对比度增强（按最大分量归一化后取幂），再和所有字形的形状向量做最近邻匹配；
  - 第二个 pass 逐像素从图集取字形；颜色在 TSL 里转成 OKLCH，量化并提升 L / C，色相向金色偏移，再转回线性 sRGB，深浅色使用不同的亮度范围；
- `ResizeObserver` 跟随尺寸；canvas 离开文档后停止动画并释放资源；
- Kipfel 的版权声明写在 `main.jsx` 的 `@footer` 里，显示在站点 footer 右下角（见下文“页面 footer”）。

### 页面 footer

站点 footer 右侧的文字来自每个页面元数据的 `footer` 字段，构建时写进 sidecar（`meta/<stem>.json`）：

| 源文件 | 写法 |
|---|---|
| `.jsx` / `.js` / `.pages.js` | JSDoc `@footer 文字`，可重复，每个一行 |
| `.md` | frontmatter `footer:`（多行用 YAML 的 `\|`） |
| `.html` | `<meta name="footer" content="...">` |

- 行内的 `[文字](https://...)` 或 `[文字](/path)` 渲染成链接，外链在新标签页打开；
- 只生成文本节点和 `<a>`，元数据里的 HTML 不会被解析；
- 目录页（例如 `/` 渲染 `main.jsx`）使用其 `main.*` 的 footer；没有 footer 的页面、404 和错误页会清空。

没有 adapter 认领的内容文件（图片、样式、模型，如 `imgs/avatar.png`、`components/home.css`）只作为静态资源提供，不生成元数据、不路由。

客户端解析顺序：

1. 路径是已知目录 → 目录 adapter；
2. 路径带已知扩展名 → 查 `meta/<stem>.json`，确认变体存在；
3. 否则视为干净 URL → 查 `meta/<stem>.json`；
4. 都失败 → 取 `404.md` 渲染 404。

**Cloudflare Pages 对不存在的路径返回 200 + `text/html`（SPA 外壳）**，所以不能只看 `response.ok`。客户端检查 `content-type`：

- `.md` → `text/markdown`
- `.js` / `.pages.js` → `text/javascript`
- `.jsx` → `text/jsx`（`_headers` 显式设置，`scripts/dev.ts` 由 `mime` 包给出；页面 loader 同样拒绝 `text/html` 外壳）
- `.json` → `application/json`
- `.html` 是歧义的（外壳与真实 HTML 同为 `text/html`），所以带 `.html` 后缀的请求先核对 sidecar 变体。

## 构建产物

### `meta/index.json`

```json
{
  "v": 1,
  "site": { "url": "...", "title": "...", "author": "...", "description": "...", "language": "zh-CN" },
  "adapters": [
    { "ext": "md", "lang": "pages.js", "file": "/adapters/md.ext.pages.js", "directory": false, "prefix": "", "pattern": "" }
  ],
  "entries": [
    { "stem": "hello", "route": "/hello", "ext": "md", "file": "/hello.md", "title": "...", "date": "...", "updated": "...", "author": "...", "tags": [] }
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
  "file": "/posts/hello.md",
  "title": "...",
  "date": "2026-10-20T00:00:00.000Z",
  "updated": "2026-10-20T00:00:00.000Z",
  "author": "...",
  "tags": ["..."],
  "summary": "...",
  "footer": "",
  "variants": [
    { "ext": "md", "file": "/posts/hello.md", "routable": true }
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
- 采集用 `ts-blank-space` + `es-module-lexer`：`scripts/lib/imports.ts` 先沿用客户端的同一套类型擦除，再用一个纯 ESM lexer 只读 import；扫描 `render/`、`shared/`、`adapters/`、根目录内容文件和 `sw.js.hbs` 的 `@vendor` 指令，不需要额外的 build。
- `scripts/lib/vendor_bundle.ts` 只做一次 Rolldown 多入口 build：虚拟入口 `vendor:<specifier>` 由插件用 `this.resolve()` 调用 Rolldown 内置解析器定位到 node_modules；`load` 会拒绝任何 node_modules 之外的文件。因此项目源码不可能被误打进 vendor。
- Rolldown 自动做多入口 code splitting，共享依赖进入 `vendor/chunks/`。重复打包检查放在 `npm test`：浏览器测试通过 server command 用同一套配置执行 `bundle.generate({ write: false })`，断言每个非空 module 只属于一个 chunk；构建本身只负责产出。
- `fluentui-webcomponents` 使用 `git+https://github.com/cheese233/fluentui-webcomponents.git#c094ae7`。组件使用 `import styles from "./x.css"`，`core/fluent-element.js` 导入 `tokens.css`；Rolldown 的 `.css: text` 模块类型把它们变成字符串，再注入 shadow root 的 `<style>`。
- `index.html` 的 import map 由构建生成，entry 文件名带内容哈希；`package-lock.json` 是唯一的依赖真相。
- 应用代码（`render/*.ts`、`shared/*.ts`、`adapters/*.js`）**不打包**：`.ts` 由 Service Worker 用 `ts-blank-space` 现场去类型，`.js` 直接作为源文件执行。读者看到的执行代码就是源码。
- `sw.js` 由 `sw.js.hbs` 生成：模板用 Handlebars 变量注入带哈希的 `/vendor/...` URL；它自身使用 `Cache-Control: no-cache`。

## CI 与 Cloudflare Pages

`.github/workflows/test.yml` 在 `ubuntu-slim` 上独立运行：

1. `actions/checkout@v5`；
2. `actions/setup-node@v5` + `npm ci`；
3. `npm run typecheck`；
4. 安装 `chrome-headless-shell`，运行 `npm test`。

`.github/workflows/deploy.yml`：

1. `actions/checkout@v5`，`fetch-depth: 0`（git 时间是元数据来源之一）；
2. `actions/setup-node@v5` + `npm ci`；
3. `npm run bundle`（node_modules vendor + shell + sw）、`npm run metadata`（只生成元数据）；**不渲染任何页面**，产物直接写入仓库根目录；
4. 检查 Cloudflare 凭据；缺失时跳过部署并给出 warning，存在时 `node scripts/deploy.ts`：`wrangler pages deploy .`。

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

`_headers` 给 `meta/`、`posts/` 和根目录内容文件设置 60 秒缓存 + `stale-while-revalidate`，带哈希的 `vendor/` 使用长缓存，`sw.js` 不缓存。

## 添加内容

1. 在根目录或 `posts/` 下新建文件；
2. 用对应扩展名（`.md` / `.html` / `.jsx` / `.js` / `.pages.js`）；
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

1. `export const parse = async (file) => ({...})`，只给构建期提取元数据；
2. `export default function (file) { return function (shadow) {...}; }`；
3. 不写 `meta`：`ext` / `lang` 全部从文件名解析，依赖树由 `shared/adapter_graph.ts` 校验。

运行时通过 `meta/index.json` 里的 adapter 表发现它：`defineLoaders` 把它包成 `LoaderShim` 的 Proxy 并注册为 `<ext>-loader`，第一次使用时 `compileAdapter` 沿文件名依赖链执行 `compile`，得到 `mount(file, shadow)`；`js.ext.js` 只负责 JSDoc。内容路径通过 `path` 属性传给 loader，例如 `<md-loader path="/hello.md">`。

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

与旧仓库的必要差异：新栈要求 `package.json` / `tsconfig.json` / import map；Rolldown 只用于把 `node_modules` 依赖打成 `vendor/`，不打包项目代码；adapter 按本项目的契约使用 **default export class**（旧 loader 是具名 `Loader`）。

## 许可

- 代码（`scripts/`、`render/`、`adapters/`、`shared/`）：MIT，见 [LICENSE](LICENSE)。
- 文章（根目录与 `posts/`）：CC BY-SA 4.0。
