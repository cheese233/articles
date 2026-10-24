---
title: 浏览器里的渲染流程
date: 2026-10-24
tags:
  - architecture
  - spa
---

# 浏览器里的渲染流程

打开一个地址时，客户端只做四件事：

1. 取 `meta/index.json`，得到站点信息、adapter 表和可路由条目；
2. 把 URL 解析成 `{ route, ext, file }`；
3. 取 `meta/<stem>.json`，拿到变体、标题、时间线邻居；
4. 取源文件，选 adapter，挂载到 Shadow DOM。

## 404 不是“fetch 失败”

Cloudflare Pages 的 `_redirects` 通常会把不存在的路径重写到 `index.html`，并且返回 `200 OK`。所以：

```text
GET /nope.md  →  200 OK, text/html （其实是 SPA 外壳）
```

客户端的判断因此不能只看 `response.ok`，还要看 `content-type`。真实源文件分别是：

- `.md` → `text/markdown`
- `.js` → `text/javascript`
- `.json` → `application/json`

`text/html` 是歧义的（外壳和真实 `.html` 文章同类型），所以带扩展名的 HTML 请求还要先向 `meta/<stem>.json` 核对变体是否存在。

## 时间线不靠第二个索引

每篇内容的 sidecar 里直接带着 `prev` 和 `next`：

```json
{
  "route": "/posts/adapter-chain",
  "prev": { "route": "/hello", "title": "你好，世界", "date": "..." },
  "next": { "route": "/posts/client-side-rendering", "title": "...", "date": "..." }
}
```

因此从任意一篇出发，只需顺着 sidecar 就能走完整条时间线，不需要再维护一个“全部文章”索引。目录页仍然用 `meta/index.json`，那是给目录 adapter 的。

## 构建期只生成元数据

CI 的产物是：

```text
meta/index.json
meta/**/*.json
sitemap.xml
atom.xml
feed.json
robots.txt
```

没有一页 HTML 是在 CI 里渲染的。页面永远在读者自己的浏览器里生成。
