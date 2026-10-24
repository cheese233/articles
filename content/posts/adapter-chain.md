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
| `md.ext.pages.js` | `md` | class；继承 `WebElements` |
| `html.ext.pages.js` | `html` | class；继承 `WebElements` |
| `[...].ext.pages.js` | 目录 | class；继承 `WebElements` |
| `pages.js.ext.js` | `pages.js` | 页面基类 `WebElements` |
| `js.ext.js` | `js` | `function(file)`，直接 define adapter class |

## loader 元素

`js.ext.js` 接收一个 adapter `.js` 文件，读取 `meta.ext`，直接把这个 class 定义成自定义元素：

```js
const adapter = await import(file);
const Adapter = adapter.default;
const ext = adapter.meta?.ext ?? Adapter.meta.ext;
const tag = `${ext.replaceAll(".", "-")}-loader`;

customElements.define(tag, Adapter);
```

没有包装 class，也没有 `PagesAdapter`。例如：

- `md.ext.pages.js` → `<md-loader>`
- `html.ext.pages.js` → `<html-loader>`
- `[...].ext.pages.js` → `<directory-loader>`
- `pages.js.ext.js` → `<pages-js-loader>`

## 页面 class

`pages.js.ext.js` 是共享基类：

```js
export class WebElements extends HTMLElement {
  static meta = meta;

  constructor(file) {
    super();
    this.file = file;
  }

  async parse() {
    return { ...parseJsDoc(String(this.file)), routable: true };
  }

  async connectedCallback() {
    // 渲染，然后 dispatchEvent(new Event("rendered"))
    // 失败时 dispatchEvent(new Event("error"))
  }
}
```

`md` / `html` / 目录 adapter 都继承它，并各自实现 `parse()` 和 `connectedCallback()`。

运行时通过 `js.ext.js` 定义 `<ext>-loader`，创建它、设置 `site` / `entries` / `route` / `entry`，然后 append 到页面 ShadowRoot，等待 `rendered` / `error`。

`.js` 和 `.pages.js` 内容文件可以默认导出 `function(shadowDom)`；`pages.js` 的 `connectedCallback` 会 import 内容模块并调用它。因此 `.js` 内容复用 `pages.js`（旧的 js adapter 现在是 pages），loader 标签是 `pages-js-loader`。

## 目录 adapter

目录 adapter 没有源文件内容，它从实例字段读取：

```js
async connectedCallback() {
  const route = this.route ?? "/";
  const entries = this.entries;
  const site = this.site;
  // 渲染列表
}
```

`[...]` 表示 adapter 接受目录；`posts.[...]` 只接受 `/posts/` 及其子目录。

## 构造器收到的是 VFile

页面 class 的 constructor 接收 `(file)`；CI 把 [vfile](https://github.com/vfile/vfile) 传给实例的 `parse()`。没有 `module()` / `render()` 两个阶段。
