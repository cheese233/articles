/** @typedef {import("vfile").VFile} VFile */
/** @typedef {import("../shared/types.ts").AdapterContext} AdapterContext */
/** @typedef {import("../shared/types.ts").ManifestEntry} ManifestEntry */

/** @type {import("../shared/types.ts").AdapterStatics} */
const meta = Object.freeze({
  ext: "[...]",
  lang: "js",
  priority: 0,
  directory: true,
});

/**
 * @param {string} value
 */
const escape = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/**
 * @param {string} route
 */
const label = (route) => {
  if (route == "/") return "Home";
  try {
    return decodeURIComponent(route.replace(/^\/|\/$/g, ""));
  } catch {
    return route;
  }
};

/**
 * @param {ManifestEntry} entry
 */
const card = (entry) => `
  <li class="post-card">
    <a class="post-title" href="${escape(entry.route)}">${escape(entry.title)}</a>
    <div class="post-meta">
      <time datetime="${escape(entry.date)}">${entry.date.slice(0, 10)}</time>
      ${entry.tags.map((tag) => `<span class="tag">${escape(tag)}</span>`).join("")}
    </div>
    <a class="post-source" data-raw href="${escape(entry.file)}">source</a>
  </li>`;

export default class DirectoryAdapter {
  static meta = meta;

  /** @type {VFile} */
  file;

  /** @param {VFile} file */
  constructor(file) {
    this.file = file;
  }

  /** @param {AdapterContext} ctx */
  async render(ctx) {
    const route = ctx.route;
    const entries = route == "/"
      ? ctx.entries
      : ctx.entries.filter((entry) => entry.route.startsWith(route));

    const title = route == "/" ? ctx.site.title : label(route);
    const description = route == "/"
      ? ctx.site.description
      : `${entries.length} 篇内容`;

    const breadcrumb = route == "/"
      ? ""
      : `<a class="crumb" href="/">${escape(ctx.site.title)}</a>
        <span class="crumb-sep">/</span>
        <span>${escape(title)}</span>`;

    const article = document.createElement("article");
    article.className = "listing";
    article.innerHTML = `
      <header class="listing-header">
        ${breadcrumb}
        <h1>${escape(title)}</h1>
        <p>${escape(description)}</p>
      </header>
      <ul class="post-list">
        ${entries.map(card).join("")}
      </ul>
      ${entries.length ? "" : '<p class="empty">这里还没有内容。</p>'}`;

    ctx.target.append(article);
  }
}

