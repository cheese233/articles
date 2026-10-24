import { VFile } from "vfile";
import { findDirectoryAdapter, matchFileAdapter, stripExt } from "../shared/ext.ts";
import type {
  AdapterInstance,
  EntryMeta,
  Manifest,
} from "../shared/types.ts";
import { instantiate, loadAdapterClass } from "./lib/adapters.ts";
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

const createHost = (route: string) => {
  const host = document.createElement("div");
  host.className = "page";
  host.dataset.route = route;

  const shadow = host.attachShadow({ mode: "open" });
  for (const href of ["/render/shadow.css", "/render/markdown.css"]) {
    const stylesheet = document.createElement("link");
    stylesheet.rel = "stylesheet";
    stylesheet.href = href;
    shadow.append(stylesheet);
  }

  main.replaceChildren(host);
  return shadow;
};

/**
 * The adapter is a Web Component: mounting it is the render. No module() or
 * render() call exists; the runtime waits for the component's lifecycle
 * event instead.
 */
const mount = async (element: AdapterInstance, route: string) => {
  const shadow = createHost(route);
  element.style.display = "block";
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
    shadow.append(element);
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
    ? `<a class="timeline-link" href="${prev.route}">
        <span class="timeline-label">← older</span>
        <strong>${escapeHtml(prev.title)}</strong>
      </a>`
    : "<span></span>";

  const newer = next
    ? `<a class="timeline-link timeline-next" href="${next.route}">
        <span class="timeline-label">newer →</span>
        <strong>${escapeHtml(next.title)}</strong>
      </a>`
    : "<span></span>";

  nav.innerHTML = `
    ${older}
    ${newer}
    <a class="timeline-source" data-raw href="${meta.file}">view source</a>`;

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
  const Adapter = await loadAdapterClass(ext, current);
  const adapter = instantiate(Adapter, new VFile({ path: file, value: source }));

  adapter.entry = meta;
  adapter.route = route;
  adapter.site = current.site;
  adapter.entries = current.entries;

  const shadow = await mount(adapter, route);
  appendTimeline(shadow, meta);

  setTitle(meta?.title);
  setDescription(meta?.summary);
};

const renderDirectory = async (current: Manifest, route: string) => {
  const info = findDirectoryAdapter(route, current.adapters);
  if (!info) throw new NotFoundError(route);

  const Adapter = await loadAdapterClass(info.ext, current);
  const adapter = instantiate(Adapter, new VFile({ path: route }));

  adapter.route = route;
  adapter.site = current.site;
  adapter.entries = current.entries;

  await mount(adapter, route);

  setTitle(route == "/" ? undefined : labelOf(route));
  setDescription(current.site.description);
};

const renderNotFound = async (current: Manifest) => {
  const file = "/content/404.md";
  const source = await fetchSource(file, "md").catch(() => null);

  if (source == null) {
    const shadow = createHost("/404");
    const article = document.createElement("article");
    article.className = "error";
    article.innerHTML =
      '<h1>404</h1><p>找不到这个页面。</p><p><a href="/">返回首页</a></p>';
    shadow.append(article);
  } else {
    const Adapter = await loadAdapterClass("md", current);
    const adapter = instantiate(
      Adapter,
      new VFile({ path: file, value: source }),
    );
    adapter.route = "/404";
    await mount(adapter, "/404");
  }

  setTitle("404");
  setDescription("找不到这个页面。");
};

const renderError = async (_current: Manifest, error: unknown) => {
  console.error(error);

  const shadow = createHost("/error");
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
  shadow.append(article);

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

  const anchor = event.composedPath().find(
    (node): node is HTMLAnchorElement => node instanceof HTMLAnchorElement,
  );
  if (!anchor) return;
  if (anchor.target || anchor.hasAttribute("download")) return;
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
