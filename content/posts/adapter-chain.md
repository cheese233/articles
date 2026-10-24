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

| 文件 | 负责的扩展名 | 由谁加载 |
|---|---|---|
| `md.ext.js` | `md` | `js.ext.js` |
| `pages.js.ext.js` | `pages.js` | `js.ext.js` |
| `[...].ext.js` | 目录 | `js.ext.js` |
| `js.ext.js` | `js` | 直接 `import()` |

## 为什么需要父 adapter

一个 adapter 自己也是源文件。`pages.js.ext.js` 是用 JavaScript 写的，所以它要被“处理 `.js` 的 adapter”执行——也就是 `js.ext.js`。

`js.ext.js` 是唯一被直接 `import()` 的 adapter。它负责：

1. 作为 `.js` 内容的渲染器；
2. 作为所有 `*.ext.js` adapter 的加载器；
3. 通过动态 `import()` 把 adapter 的 default class 交给运行时。

如果它也要通过父 adapter 加载自己，就会形成自环。所以它被特殊对待，直接执行。

## 构造器收到的是 VFile

每个 adapter 的 `constructor` 都接收一个 [vfile](https://github.com/vfile/vfile)。元信息放在类上的 `const meta`（实现为 `static meta`）：

```js
const meta = Object.freeze({
  ext: "pages.js",
  lang: "js",
  priority: 10,
});

export default class PagesAdapter extends JavaScriptAdapter {
  static meta = meta;

  /** @param {import("vfile").VFile} file */
  constructor(file) {
    this.file = file;
  }
}
```

`[...]` 表示 adapter 接受目录。客户端对 `/`、`/posts/` 这类没有文件扩展名的路径，会去找目录 adapter，把 `meta/index.json` 里的条目交给它。

> 根目录 `/` 也是一个目录；它没有单独的 `index.html` 页面。
