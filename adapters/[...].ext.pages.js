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
 * @param {typeof import("./pages.js.ext.js").default} WebElements
 */
export default function (WebElements) {
  return class DirectoryAdapter extends WebElements {
    static meta = meta;

    async connectedCallback() {
      if (this.connected) return;
      this.connected = true;

      try {
        const route = this.route ?? "/";
        const entries = route == "/"
          ? this.entries
          : this.entries.filter((entry) => entry.route.startsWith(route));

        const site = this.site;
        const title = route == "/" ? site?.title ?? "Blog" : label(route);
        const description = route == "/"
          ? site?.description ?? ""
          : `${entries.length} 篇内容`;

        const breadcrumb = route == "/"
          ? ""
          : `<a class="crumb" href="/">${escape(site?.title ?? "Home")}</a>
            <span class="crumb-sep">/</span>
            <span>${escape(title)}</span>`;

        this.innerHTML = `
          <article class="listing">
            <header class="listing-header">
              ${breadcrumb}
              <h1>${escape(title)}</h1>
              <p>${escape(description)}</p>
            </header>
            <ul class="post-list">
              ${entries.map(card).join("")}
            </ul>
            ${entries.length ? "" : '<p class="empty">这里还没有内容。</p>'}
          </article>`;

        this.dispatchEvent(new Event("rendered"));
      } catch (error) {
        console.error(error);
        this.dispatchEvent(new Event("error"));
      }
    }
  };
}
