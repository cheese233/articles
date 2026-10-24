---
title: adapter 链
date: 2026-10-22
tags:
  - architecture
  - adapters
---

# adapter 链

每个 adapter 都住在 `adapters/` 下，文件名遵循：

```text
<负责的扩展名>.ext.<编写 adapter 用的语言扩展名>
```

例如：

| 文件 | 负责的扩展名 | 形态 |
|---|---|---|
| `md.ext.pages.js` | `md` | 函数 adapter |
| `html.ext.pages.js` | `html` | 函数 adapter |
| `[...].ext.pages.js` | 目录 | 函数 adapter |
| `pages.js.ext.js` | `pages.js` | 页面基类 `WebElements` |
| `js.ext.js` | `js` | `function(file)`，定义 `<ext>-loader` |

## loader 元素

`js.ext.js` 接收一个 adapter `.js` 文件，读取它的 `meta.ext`，定义：

```text
<meta.ext 里的点换成横线>-loader
```

例如 `md.ext.pages.js` → `md-loader`，`pages.js.ext.js` → `pages-js-loader`。

所有 loader 都继承 `pages.js.ext.js` 的 `WebElements`：

```js
export default class WebElements extends HTMLElement {
  constructor(file, context) {
    super();
    this.file = file;
    this.context = context;
    this.attachShadow({ mode: "open" });
  }

  async connectedCallback() {
    if (this.constructor.adapter) {
      await this.constructor.adapter.default(
        this.file,
        this.shadowRoot,
        this.context,
      );
    } else {
      const mod = await import(this.file.path);
      await mod.default(this.shadowRoot);
    }
  }
}
```

`md` / `html` / 目录 adapter 是函数，`js.ext.js` 把它们挂到 loader 的静态 `adapter` 上；`js` / `pages.js` 没有 adapter，loader 直接 import 内容模块并调用 `default(shadow)`。

## 函数 adapter

`md` / `html` / 目录 adapter 导出三样东西：

```js
export const meta = Object.freeze({
  ext: "md",
  lang: "pages.js",
  priority: 20,
});

export const parse = async (file) => ({
  title: "标题",
  routable: true,
});

export default async function (file, shadow, context) {
  // 把页面写进 shadow
}
```

`parse(file)` 只给 CI 提取元数据，不碰 DOM；default 函数在浏览器里收到源文件、loader 的 `ShadowRoot` 和站点 context。

`.js` 和 `.pages.js` 内容文件默认导出 `function(shadowDom)`：

```js
export default function (shadow) {
  const article = document.createElement("article");
  article.textContent = "内容";
  shadow.append(article);
}
```

`js-loader` / `pages-js-loader` 负责 import 这个内容模块并调用它的 `default(shadow)`。

## 目录 adapter

目录 adapter 没有源文件内容，它的 default 函数从 context 读取：

```js
export default async function (file, shadow, context) {
  const { route, entries, site } = context;
  // 渲染列表
}
```

`[...]` 表示 adapter 接受目录；`posts.[...]` 只接受 `/posts/` 及其子目录。

## 构造器收到的是 VFile

`WebElements` loader 的 constructor 接收 `(file, context)`；CI 仍然把 [vfile](https://github.com/vfile/vfile) 传给 `parse(file)`。没有 `module()` / `render()` 两个阶段。
