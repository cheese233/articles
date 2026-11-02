import { findMainEntry, isMainEntry } from "../shared/directory.ts";

/** @typedef {import("vfile").VFile} VFile */

/** @typedef {import("../shared/types.ts").ManifestEntry} ManifestEntry */

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
    <fluent-card appearance="outline" size="small">
      <fluent-link class="post-title" href="${escape(entry.route)}">${escape(entry.title)}</fluent-link>
      <div class="post-meta">
        <time datetime="${escape(entry.date)}">${entry.date.slice(0, 10)}</time>
        ${entry.tags.map((tag) => `<fluent-badge appearance="outline" size="small">${escape(tag)}</fluent-badge>`).join("")}
      </div>
      <fluent-link class="post-source" appearance="subtle" data-raw href="${escape(entry.file)}">source</fluent-link>
    </fluent-card>
  </li>`;

/**
 * @param {VFile} _file
 */
const factory = (_file) => async (/** @type {ShadowRoot} */ shadow) => {
  const host = /** @type {import("../render/lib/loader_shim.ts").LoaderElement} */ (
    shadow.host
  );

  const route = host.route ?? "/";
  const main = findMainEntry(route, host.entries);

  if (main) {
    // `main.*` goes through the same lazy shim registry as every loader.
    const adapter = host.adapters[main.ext];
    if (!adapter) throw new Error(`no adapter for .${main.ext}`);
    await adapter.mount(await adapter.read(main.file), shadow);
    return;
  }

  const entries = (route == "/"
    ? host.entries
    : host.entries.filter((entry) => entry.route.startsWith(route)))
    .filter((entry) => !isMainEntry(entry.file));

  const site = host.site;
  const title = route == "/" ? site?.title ?? "Blog" : label(route);
  const description = route == "/"
    ? site?.description ?? ""
    : `${entries.length} 篇内容`;

  const breadcrumb = route == "/"
    ? ""
    : `<fluent-link class="crumb" href="/">${escape(site?.title ?? "Home")}</fluent-link>
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

export default factory;
