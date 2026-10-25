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
| `md.ext.pages.js` | `md` | `function(file)` → `function(shadow)` |
| `html.ext.pages.js` | `html` | 同上 |
| `json.ext.html` | `json` | 真实 HTML；由 html factory 执行 |
| `[...].ext.pages.js` | 目录 | 同上 |
| `pages.js.ext.js` | `pages.js` | `compile(child)` → `JSLoader` class |
| `js.ext.js` | `js` | 只解析 JSDoc，不执行 |

## 编译链

runtime 不判断具体扩展名，只执行 adapter 提供的 `compile`：

```text
md.ext.pages.js
  --pages.js.ext.js compile--> JSLoader class
  --render define--> md-loader
```

- `md.ext.pages.js(file)` 返回 `function(shadow)`。
- `pages.js.ext.js` 的 `compile(child)` 返回 `JSLoader` class。
- `js.ext.js` 只解析 JSDoc，不负责 define。
- 最终 loader 由 render 按 `meta.ext` 定义。

HTML adapter 则由 html 的 `compile` 直接产出 JS class：

```text
json.ext.html
  --html.ext.pages.js compile--> HtmlAdapter class
  --render define--> json-loader
```

内容路径通过属性传给实例：

```html
<md-loader path="/content/hello.md"></md-loader>
```

loader class 每个扩展名只生成一次；`path` 在挂载时决定内容文件。

## JSLoader

```js
export default function (factory) {
  return class JSLoader extends HTMLElement {
    static meta = factory.meta;

    constructor() {
      super();
      this.attachShadow({ mode: "open" });
    }

    async connectedCallback() {
      const path = this.getAttribute("path");
      const file = new VFile({ path: path ?? "" });
      const mount = factory(file);
      this.onMount = await mount(this.shadowRoot);
    }
  };
}
```

## Adapter 工厂

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
- `js.ext.js` → `<js-loader>`
- `pages.js.ext.js` → `<pages-js-loader>`

## `.js` / `.pages.js` 内容

内容文件保持简单：默认导出 `function(shadowDom)`，由对应 JS loader 的通用工厂 import 并调用。

```js
export default function (shadow) {
  const article = document.createElement("article");
  article.textContent = "内容";
  shadow.append(article);
}
```

## 构造器收到的是 VFile

`JSLoader` 从 `path` 属性构造 vfile，再把它传给 adapter 工厂；adapter 工厂返回的 `function(shadow)` 就是 `onMount`。没有 `module()` / `render()` 两个阶段。
