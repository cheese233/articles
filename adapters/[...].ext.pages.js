/** @typedef {import("vfile").VFile} VFile */
/** @typedef {import("../shared/types.ts").ManifestEntry} ManifestEntry */
/** @typedef {import("../shared/types.ts").AdapterContext} AdapterContext */

/** @type {import("../shared/types.ts").AdapterStatics} */
export const meta = Object.freeze({
  ext: "[...]",
  lang: "pages.js",
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

/** @returns {Promise<import("../shared/types.ts").ParsedMeta>} */
export const parse = async () => ({ routable: true });

/**
 * @param {VFile} _file
 * @param {ShadowRoot} shadow
 * @param {AdapterContext} context
 */
export default async function (_file, shadow, context) {
  const route = context.route;
  const entries = route == "/"
    ? context.entries
    : context.entries.filter((entry) => entry.route.startsWith(route));

  const site = context.site;
  const title = route == "/" ? site.title : label(route);
  const description = route == "/"
    ? site.description
    : `${entries.length} 篇内容`;

  const breadcrumb = route == "/"
    ? ""
    : `<a class="crumb" href="/">${escape(site.title)}</a>
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

  shadow.append(article);
}
