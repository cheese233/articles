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

| 文件 | 负责的扩展名 | 由谁处理 |
|---|---|---|
| `md.ext.pages.js` | `md` | `pages.js.ext.js` |
| `html.ext.pages.js` | `html` | `pages.js.ext.js` |
| `[...].ext.pages.js` | 目录 | `pages.js.ext.js` |
| `pages.js.ext.js` | `pages.js` | 自身是页面根；由 `js.ext.js` loader 创建 |
| `js.ext.js` | `js` | 语言 loader；不是 HTMLElement |

## loader 与页面组件

`js.ext.js` 是 `.js` 的语言 loader。它不继承 `HTMLElement`，只做两件事：

1. 解析 `.js` 文件头部的 JSDoc；
2. `create()` 出 `pages.js.ext.js` 提供的 `PagesAdapter`，交给运行时挂载。

真正的页面 Web Component 在 `pages.js.ext.js`：

```text
js.ext.js  (JavaScriptAdapter, .js；语言 loader)
  └─ pages.js.ext.js  (WebElements + PagesAdapter, .pages.js)
       ├─ md.ext.pages.js    (.md)
       ├─ html.ext.pages.js  (.html)
       └─ [...].ext.pages.js (directory)
```

`pages.js.ext.js` 里 `WebElements` 原生继承 `HTMLElement`，并注册 `web-elements` 与 `pages-element`。`PagesAdapter` 继承 `WebElements`；`md` / `html` / 目录 adapter 再继承 `PagesAdapter`。

运行时把 `js` 和 `pages.js` 当作根；加载其他 adapter 时检查 `Adapter.prototype instanceof Parent`。`pages.js` 不再要求 `instanceof js.ext.js`，因为它是页面根，不是 loader 的子类。

## 挂载即渲染

`.js` / `.pages.js` 文件的 default export 如果是自定义元素 class，`PagesAdapter` 会先 define 再挂载；如果是函数，则把当前页面的 `ShadowRoot` 作为参数调用。

挂载完成就 dispatch `rendered`，失败就 dispatch `error`。没有 `module()` / `render()` 两个阶段。

## 构造器收到的是 VFile

`WebElements` 的 `constructor` 接收一个 [vfile](https://github.com/vfile/vfile)。元信息放在类上的 `const meta`（实现为 `static meta`）：

```js
const meta = Object.freeze({
  ext: "pages.js",
  lang: "js",
  priority: 10,
});

export default class PagesAdapter extends WebElements {
  static meta = meta;

  async parse() {
    return { ...(await super.parse()), routable: true };
  }
}
```

`[...]` 表示 adapter 接受目录。客户端对 `/`、`/posts/` 这类没有文件扩展名的路径，会去找目录 adapter，把 `meta/index.json` 里的条目交给它。

> 根目录 `/` 也是一个目录；它没有单独的 `index.html` 页面。
