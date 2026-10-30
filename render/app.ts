import { VFile } from "vfile";
import { findDirectoryAdapter, matchFileAdapter, stripExt } from "../shared/ext.ts";
import type {
  AdapterContext,
  EntryMeta,
  Manifest,
} from "../shared/types.ts";
import "./fluent.ts";
import { loadLoader, type LoaderConstructor } from "./lib/adapters.ts";
import {
  fetchEntry,
  fetchManifest,
  fetchSource,
  NotFoundError,
} from "./lib/fetch.ts";

const main = document.querySelector<HTMLElement>("#main");
if (!main) throw new Error("missing #main");

let manifest: Manifest | null = null;
let generation = 0;

const getManifest = async () => {
  manifest ??= await fetchManifest();
  return manifest;
};

const labelOf = (route: string) => {
  try {
    return decodeURIComponent(route.replace(/^\/|\/$/g, ""));
  } catch {
    return route;
  }
};

const setTitle = (title?: string | null) => {
  const site = manifest?.site.title ?? "";
  document.title = title && title != site ? `${title} — ${site}` : site;
};

const setDescription = (text?: string | null) => {
  const content = text || manifest?.site.description || "";
  let tag = document.querySelector('meta[name="description"]');

  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute("name", "description");
    document.head.append(tag);
  }

  tag.setAttribute("content", content);
};

const appendStyles = (target: HTMLElement | ShadowRoot) => {
  for (const href of ["/render/shadow.css", "/render/markdown.css"]) {
    const stylesheet = document.createElement("link");
    stylesheet.rel = "stylesheet";
    stylesheet.href = href;
    target.append(stylesheet);
  }
};

const createHost = (route: string) => {
  const host = document.createElement("div");
  host.className = "page";
  host.dataset.route = route;

  main.replaceChildren(host);
  return host;
};

/**
 * Adapter classes are defined as `<final-ext>-loader` elements. They render
 * into their own light DOM, inside the page host's ShadowRoot.
 */
type AdapterElement = HTMLElement & {
  file?: VFile;
  site?: import("../shared/types.ts").SiteConfig;
  entries: import("../shared/types.ts").ManifestEntry[];
  route?: string;
  entry: EntryMeta | null;
};

const mount = async (
  Loader: LoaderConstructor,
  file: VFile,
  route: string,
  context: AdapterContext,
) => {
  const host = createHost(route);
  const ext = Loader.meta?.ext ?? route;
  const tag = `${ext
    .replace(/\[\[?\.\.\.[^\]]+\]\]?/g, "directory")
    .replace(/\[[^\]]+\]/g, "segment")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")}-loader`;

  if (!customElements.get(tag)) customElements.define(tag, Loader);

  const element = document.createElement(tag) as AdapterElement;
  const path = file.path ?? route;
  element.file = file;
  element.setAttribute("path", path);
  element.site = context.site;
  element.entries = context.entries;
  element.route = context.route;
  element.entry = context.entry;

  const shadow = element.shadowRoot;
  if (!shadow) throw new Error("missing loader shadow root");
  appendStyles(shadow);

  let timeout = 0;

  const rendered = new Promise<void>((resolve, reject) => {
    element.addEventListener("rendered", () => resolve(), { once: true });
    element.addEventListener(
      "error",
      () => reject(new Error(`failed to render ${route}`)),
      { once: true },
    );

    timeout = window.setTimeout(
      () => reject(new Error(`render timeout: ${route}`)),
      15000,
    );
  });

  document.body.classList.add("is-loading");

  try {
    host.append(element);
    await rendered;
  } finally {
    window.clearTimeout(timeout);
    document.body.classList.remove("is-loading");
  }

  return shadow;
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const appendTimeline = (shadow: ShadowRoot, meta: EntryMeta | null) => {
  if (!meta) return;

  // An older (or newer) client can meet a newer sidecar. The page still
  // renders; only the optional timeline loses its neighbours.
  const prev = meta.v == 1 ? meta.prev : null;
  const next = meta.v == 1 ? meta.next : null;

  const nav = document.createElement("nav");
  nav.className = "page-timeline";

  const older = prev
    ? `<fluent-link class="timeline-link" href="${prev.route}">
        <span class="timeline-label">← older</span>
        <strong>${escapeHtml(prev.title)}</strong>
      </fluent-link>`
    : "<span></span>";

  const newer = next
    ? `<fluent-link class="timeline-link timeline-next" href="${next.route}">
        <span class="timeline-label">newer →</span>
        <strong>${escapeHtml(next.title)}</strong>
      </fluent-link>`
    : "<span></span>";

  nav.innerHTML = `
    ${older}
    ${newer}
    <fluent-link class="timeline-source" appearance="subtle" data-raw href="${meta.file}">view source</fluent-link>`;

  shadow.append(nav);
};

const renderFile = async (
  current: Manifest,
  ext: string,
  file: string,
  route: string,
  meta: EntryMeta | null,
) => {
  const source = await fetchSource(file, ext);
  const Loader = await loadLoader(ext, current);
  const sourceFile = new VFile({ path: file, value: source });
  const context: AdapterContext = {
    site: current.site,
    entries: current.entries,
    route,
    entry: meta,
  };

  const shadow = await mount(Loader, sourceFile, route, context);
  appendTimeline(shadow, meta);

  setTitle(meta?.title);
  setDescription(meta?.summary);
};

const renderDirectory = async (current: Manifest, route: string) => {
  const info = findDirectoryAdapter(route, current.adapters);
  if (!info) throw new NotFoundError(route);

  const Loader = await loadLoader(info.ext, current);
  const file = new VFile({ path: route });
  const context: AdapterContext = {
    site: current.site,
    entries: current.entries,
    route,
    entry: null,
  };

  await mount(Loader, file, route, context);

  setTitle(route == "/" ? undefined : labelOf(route));
  setDescription(current.site.description);
};

const renderNotFound = async (current: Manifest) => {
  const file = "/404.md";
  const source = await fetchSource(file, "md").catch(() => null);

  if (source == null) {
    const host = createHost("/404");
    appendStyles(host);
    const article = document.createElement("article");
    article.className = "error";
    article.innerHTML =
      '<h1>404</h1><p>找不到这个页面。</p><p><a href="/">返回首页</a></p>';
    host.append(article);
  } else {
    const Loader = await loadLoader("md", current);
    const sourceFile = new VFile({ path: file, value: source });
    await mount(Loader, sourceFile, "/404", {
      site: current.site,
      entries: current.entries,
      route: "/404",
      entry: null,
    });
  }

  setTitle("404");
  setDescription("找不到这个页面。");
};

const renderError = async (_current: Manifest, error: unknown) => {
  console.error(error);

  const host = createHost("/error");
  appendStyles(host);
  const article = document.createElement("article");
  article.className = "error";

  const title = document.createElement("h1");
  title.textContent = "页面渲染失败";

  const message = document.createElement("pre");
  message.textContent = error instanceof Error
    ? error.message
    : String(error);

  const hint = document.createElement("p");
  hint.innerHTML = '请查看浏览器控制台，或 <a href="/">返回首页</a>。';

  article.append(title, message, hint);
  host.append(article);

  setTitle("出错了");
};

type Target =
  | { kind: "directory"; route: string }
  | {
    kind: "file";
    ext: string;
    file: string;
    route: string;
    meta: EntryMeta | null;
  };

const resolve = async (current: Manifest, path: string): Promise<Target> => {
  const directory = path.endsWith("/") ? path : `${path}/`;
  if (current.dirs.includes(directory)) {
    return { kind: "directory", route: directory };
  }

  const adapter = matchFileAdapter(path, current.adapters);
  if (adapter) {
    const stem = stripExt(path.slice(1), adapter.ext);
    const meta = await fetchEntry(stem);
    const variant = meta?.variants.find(
      (item) => item.ext == adapter.ext && item.routable,
    );

    if (meta && variant)
      return {
        kind: "file",
        ext: variant.ext,
        file: variant.file,
        route: meta.route,
        meta,
      };
    throw new NotFoundError(path);
  }

  const meta = await fetchEntry(path.slice(1));
  if (!meta) throw new NotFoundError(path);

  return {
    kind: "file",
    ext: meta.ext,
    file: meta.file,
    route: meta.route,
    meta,
  };
};

const renderRoute = async (path: string) => {
  const run = ++generation;
  const current = await getManifest();

  try {
    const target = await resolve(current, path);
    if (run != generation) return;

    if (target.kind == "directory") {
      if (target.route != path) {
        history.replaceState(null, "", target.route + location.search);
      }
      await renderDirectory(current, target.route);
    } else {
      await renderFile(
        current,
        target.ext,
        target.file,
        target.route,
        target.meta,
      );
    }
  } catch (error) {
    if (run != generation) return;
    if (error instanceof NotFoundError) await renderNotFound(current);
    else await renderError(current, error);
  }
};

const navigate = async (path: string) => {
  history.pushState(null, "", path + location.search);
  window.scrollTo(0, 0);
  await renderRoute(path);
};

const boot = async () => {
  const current = await getManifest();

  document.documentElement.lang = current.site.language;
  document.querySelectorAll<HTMLElement>("[data-site-title]").forEach((el) => {
    el.textContent = current.site.title;
  });

  setDescription(current.site.description);
  await renderRoute(location.pathname);
};

document.addEventListener("click", (event) => {
  if (event.defaultPrevented || event.button != 0) return;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

  const path = event.composedPath();
  const anchor = path.find(
    (node): node is HTMLAnchorElement => node instanceof HTMLAnchorElement,
  );
  if (!anchor) return;
  if (anchor.target || anchor.hasAttribute("download")) return;
  if (
    path.some((node) =>
      node instanceof Element && node.hasAttribute("data-raw")
    )
  ) return;
  if (anchor.hasAttribute("data-raw")) return;

  const url = new URL(anchor.href, location.href);
  if (url.origin != location.origin) return;
  if (/^\/(content|meta|vendor|render)\//.test(url.pathname)) return;
  if (/\.(xml|json|txt)$/.test(url.pathname)) return;

  event.preventDefault();
  void navigate(url.pathname);
});

window.addEventListener("popstate", () => {
  void renderRoute(location.pathname);
});

await boot().catch((error) => {
  console.error(error);
  document.body.classList.remove("is-loading");

  const box = document.createElement("div");
  box.className = "fatal";
  const title = document.createElement("h1");
  title.textContent = "站点元数据加载失败";
  const message = document.createElement("pre");
  message.textContent = error instanceof Error
    ? error.message
    : String(error);
  box.append(title, message);
  main.replaceChildren(box);
});
