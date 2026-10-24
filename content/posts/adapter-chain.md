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
| `md.ext.pages.js` | `md` | 工厂 function |
| `html.ext.pages.js` | `html` | 工厂 function |
| `[...].ext.pages.js` | 目录 | 工厂 function |
| `pages.js.ext.js` | `pages.js` | 页面基类 `WebElements` |
| `js.ext.js` | `js` | `function(file)`，生成并 define class |

## 链式调用

```text
js.ext.js
  → WebElements.create(adapterFile)
      → import(adapterFile).default(WebElements)
          → class
  → customElements.define(tag, class)
```

`pages.js.ext.js` 既是基类，也是调度器：

```js
export default class WebElements extends HTMLElement {
  static async create(file) {
    const mod = await import(file);
    const factory = mod.default;

    if (factory === WebElements || factory.prototype instanceof WebElements)
      return factory;

    return factory(WebElements);
  }
}
```

`js.ext.js` 拿到 class 后直接定义：

```js
const Adapter = await WebElements.create(file);
const ext = Adapter.meta.ext;
const tag = `${ext.replaceAll(".", "-")}-loader`;

customElements.define(tag, Adapter);
```

例如：

- `md.ext.pages.js` 的工厂生成 `MarkdownAdapter` → `<md-loader>`
- `html.ext.pages.js` → `<html-loader>`
- `[...].ext.pages.js` → `<directory-loader>`
- `pages.js.ext.js` 自身 → `<pages-js-loader>`

## 工厂 function

`md` / `html` / 目录 adapter 默认导出一个工厂函数，不 import `pages.js`；基类由 `pages.js` 传进来：

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

export default function (WebElements) {
  return class MarkdownAdapter extends WebElements {
    static meta = meta;

    async parse() {
      return parse(this.file);
    }

    async connectedCallback() {
      // 渲染，然后 dispatchEvent(new Event("rendered"))
      // 失败时 dispatchEvent(new Event("error"))
    }
  };
}
```

`meta.ext` 是最终扩展名，用来生成 loader 标签；`parse(file)` 只给 CI 提取元数据，不碰 DOM。

运行时创建 loader、设置 `site` / `entries` / `route` / `entry`，append 到页面的 ShadowRoot，然后等待 `rendered` / `error`。

## `.js` / `.pages.js` 内容

内容文件保持简单：默认导出 `function(shadowDom)`，由 `pages.js` 的 `connectedCallback` import 并调用。

```js
export default function (shadow) {
  const article = document.createElement("article");
  article.textContent = "内容";
  shadow.append(article);
}
```

因此 `.js` 内容复用 `pages.js`，loader 是 `pages-js-loader`。

## 构造器收到的是 VFile

页面 class 的 constructor 接收 `(file)`；CI 把 [vfile](https://github.com/vfile/vfile) 传给实例的 `parse()`。没有 `module()` / `render()` 两个阶段。
