/** @typedef {import("vfile").VFile} VFile */
/** @typedef {import("../shared/types.ts").ParsedMeta} ParsedMeta */

/** @type {import("../shared/types.ts").AdapterStatics} */
const meta = Object.freeze({
  ext: "js",
  lang: "js",
  priority: 40,
});

const Base = /** @type {typeof HTMLElement} */ (
  globalThis.HTMLElement ?? class {}
);

/**
 * @param {string} value
 */
const unquote = (value) =>
  value.trim().replace(/^["'](.*)["']$/, "$1").trim();

/**
 * @typedef {{
 *   title?: string;
 *   author?: string;
 *   date?: string;
 *   updated?: string;
 *   tags?: string[];
 *   summary?: string;
 *   routable?: boolean;
 * }} JsDocMeta
 */

/**
 * @param {string} source
 * @returns {JsDocMeta}
 */
export const parseJsDoc = (source) => {
  const blocks = [...source.matchAll(/\/\*\*([\s\S]*?)\*\//g)];
  if (!blocks.length) return {};

  // Prefer the block immediately before `export default`, then the block
  // that opted into routing, then the first block.
  const exportAt = source.indexOf("export default");
  const before = exportAt >= 0
    ? blocks.filter((match) => (match.index ?? 0) < exportAt).at(-1)
    : undefined;
  const block = before?.[1] ??
    blocks.find((match) => (match[1] ?? "").includes("@routable"))?.[1] ??
    blocks[0][1] ??
    "";

  const lines = block
    .split("\n")
    .map((line) => line.replace(/^\s*\*\s?/, "").trim())
    .filter(Boolean);

  /** @type {JsDocMeta} */
  const parsed = {};
  const heading = lines.find((line) => line.startsWith("# "));
  if (heading) parsed.title = heading.slice(2).trim();

  for (const line of lines) {
    const match = /^@([a-z_]+)\s*(.*)$/i.exec(line);
    if (!match) continue;

    const name = match[1] ?? "";
    const value = match[2] ?? "";

    switch (name) {
      case "routable":
        parsed.routable = true;
        break;
      case "title":
        parsed.title = unquote(value);
        break;
      case "author":
        parsed.author = unquote(value);
        break;
      case "date":
        parsed.date = unquote(value);
        break;
      case "updated":
        parsed.updated = unquote(value);
        break;
      case "summary":
        parsed.summary = unquote(value);
        break;
      case "tags": {
        const tags = value.trim();
        if (tags.startsWith("[")) {
          const list = JSON.parse(tags);
          if (Array.isArray(list)) parsed.tags = list.map(String);
        } else if (tags) {
          parsed.tags = tags.split(",").map((tag) => tag.trim());
        }
        break;
      }
    }
  }

  return parsed;
};

let contentTag = 0;
/** @type {WeakMap<Function, string>} */
const contentTags = new WeakMap();

/**
 * A page module may default-export a custom element class. The browser
 * requires every custom element class to be defined before it can be
 * constructed, so allocate a stable tag once per class.
 *
 * @param {Function} Page
 */
const definePage = (Page) => {
  const existing = contentTags.get(Page);
  if (existing) return existing;

  const tag = `page-content-${contentTag++}`;
  try {
    customElements.define(
      tag,
      /** @type {CustomElementConstructor} */ (Page),
    );
  } catch {
    // The class may already be registered elsewhere; `new Page()` is still
    // constructible in that case.
  }
  contentTags.set(Page, tag);
  return tag;
};

/**
 * The shared Web Component. `js.ext.js` is the root of the adapter chain:
 * `pages.js` extends this class, and the markdown/html/directory adapters
 * extend `pages.js`.
 */
export class WebElements extends Base {
  /** @type {VFile} */
  file;
  connected = false;

  /** @type {import("../shared/types.ts").SiteConfig | undefined} */
  site;
  /** @type {import("../shared/types.ts").ManifestEntry[]} */
  entries = [];
  /** @type {string | undefined} */
  route;
  /** @type {import("../shared/types.ts").EntryMeta | null} */
  entry = null;

  /** @param {VFile} file */
  constructor(file) {
    super();
    this.file = file;
  }

  /** @returns {Promise<ParsedMeta>} */
  async parse() {
    return parseJsDoc(String(this.file));
  }

  /**
   * A `.js` or `.pages.js` module is mounted directly: a class is appended
   * as a custom element, a function receives the page's ShadowRoot.
   */
  async connectedCallback() {
    if (this.connected) return;
    this.connected = true;

    try {
      const path = this.file.path;
      if (!path) throw new Error("vfile has no path");

      const mod = await import(path);
      const Page = mod.default;
      const root = this.getRootNode();
      const target = root instanceof ShadowRoot ? root : this;

      if (!Page) throw new Error(`${path}: default export is missing`);

      if (Page.prototype instanceof Base) {
        definePage(Page);
        this.append(new Page(this.file));
      } else if (typeof Page == "function") {
        await Page(target);
      } else {
        throw new Error(`${path}: default export is not a class or function`);
      }

      this.dispatchEvent(new Event("rendered"));
    } catch (error) {
      console.error(error);
      this.dispatchEvent(new Event("error"));
    }
  }
}

export default class JavaScriptAdapter extends WebElements {
  static meta = meta;
}
