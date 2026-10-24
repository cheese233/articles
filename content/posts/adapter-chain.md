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
| `pages.js.ext.js` | `pages.js` | 函数 adapter |
| `js.ext.js` | `js` | 函数 adapter + `WebElements` 宿主 |

## 函数 adapter

adapter 不继承 class。每个模块导出三样东西：

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

`parse(file)` 只给 CI 提取元数据，不碰 DOM；default 函数在浏览器里收到源文件、宿主的 `ShadowRoot` 和站点 context。函数返回时，页面就渲染完成。

## WebElements 宿主

`js.ext.js` 额外定义唯一的 Web Component：

```js
export class WebElements extends HTMLElement {
  constructor(file) {
    super();
    this.file = file;
    this.attachShadow({ mode: "open" });
  }
}
```

运行时创建这个宿主，把样式和页面内容都放进它的 ShadowRoot，然后调用当前 adapter 的 default 函数。没有每个 adapter 各自的自定义元素，也没有 class 继承链。

`.js` 和 `.pages.js` 内容文件默认导出 `function(shadowDom)`：

```js
export default function (shadow) {
  const article = document.createElement("article");
  article.textContent = "内容";
  shadow.append(article);
}
```

`js.ext.js` / `pages.js.ext.js` 的 default 函数负责 `import` 这个内容模块并调用它的 `default(shadow)`。`md` / `html` / 目录 adapter 则各自实现 `default(file, shadow, context)`，不 import `pages.js.ext.js`。

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

没有 adapter class，也没有 constructor。CI 把 [vfile](https://github.com/vfile/vfile) 传给 `parse(file)`；浏览器把同一个 vfile 和 ShadowRoot 传给 default 函数。
