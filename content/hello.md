---
title: 你好，世界
date: 2026-10-20
tags:
  - meta
  - blog
---

# 你好，世界

这个站点没有预渲染的 HTML 页面。你看到的每一个字，都是浏览器先向服务器取回源文件，再由对应的 adapter 现场生成的。

<!-- more -->

## 它和 SSG / SSR 有什么不同

- **SSG** 在构建时把所有页面渲染成 HTML。这里构建时只生成 `meta/`、`sitemap.xml`、`atom.xml` 之类的元数据。
- **SSR** 在每次请求时由服务端渲染。这里的服务器只负责发送静态文件。
- 这里更接近 **SPA**：路由、取数、渲染都发生在浏览器里，但内容不是打包进 JS 的，而是按 URL 去取原始 `.md` / `.js` / `.html` 文件。

## 为什么这样做

因为源文件本身就是可以阅读、可以审计的格式。你可以在任意页面点开 `source`，或者直接把地址栏的 `/hello` 改成 `/hello.md`，拿到的就是这篇文字的原始 Markdown。

```text
meta/index.json  →  路由 + 条目清单（构建期生成）
meta/hello.json  →  这篇内容的变体、时间线邻居（构建期生成）
content/hello.md  →  真正被浏览器取走并渲染的源文件
```

下一站可以看看 [adapter 链](/posts/adapter-chain) 和 [浏览器渲染流程](/posts/client-side-rendering)。
