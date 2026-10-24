/** @typedef {import("vfile").VFile} VFile */
/** @typedef {import("../shared/types.ts").AdapterStatics} AdapterStatics */
/** @typedef {import("../shared/types.ts").ManifestEntry} ManifestEntry */

/** @type {AdapterStatics} */
export const meta = Object.freeze({
  ext: "[...]",
  lang: "pages.js",
  priority: 0,
  directory: true,
});

const escape = (/** @type {string} */ value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const label = (/** @type {string} */ route) => {
  if (route == "/") return "Home";
  try {
    return decodeURIComponent(route.replace(/^\/|\/$/g, ""));
  } catch {
    return route;
  }
};

const card = (/** @type {ManifestEntry} */ entry) => `
  <li class="post-card">
    <a class="post-title" href="${escape(entry.route)}">${escape(entry.title)}</a>
    <div class="post-meta">
      <time datetime="${escape(entry.date)}">${entry.date.slice(0, 10)}</time>
      ${entry.tags.map((tag) => `<span class="tag">${escape(tag)}</span>`).join("")}
    </div>
    <a class="post-source" data-raw href="${escape(entry.file)}">source</a>
  </li>`;

/**
 * @param {VFile} _file
 */
const factory = (_file) => (/** @type {ShadowRoot} */ shadow) => {
  const host = /** @type {HTMLElement & {
   *   route?: string;
   *   entries: ManifestEntry[];
   *   site?: import("../shared/types.ts").SiteConfig;
   * }} */ (shadow.host);

  const route = host.route ?? "/";
  const entries = route == "/"
    ? host.entries
    : host.entries.filter((entry) => entry.route.startsWith(route));

  const site = host.site;
  const title = route == "/" ? site?.title ?? "Blog" : label(route);
  const description = route == "/"
    ? site?.description ?? ""
    : `${entries.length} 篇内容`;

  const breadcrumb = route == "/"
    ? ""
    : `<a class="crumb" href="/">${escape(site?.title ?? "Home")}</a>
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
};

factory.meta = meta;

export default factory;
