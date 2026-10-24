import { parseJsDoc } from "../shared/jsdoc.js";

/** @typedef {import("vfile").VFile} VFile */
/** @typedef {import("../shared/types.ts").ParsedMeta} ParsedMeta */

/** @type {import("../shared/types.ts").AdapterStatics} */
const meta = Object.freeze({
  ext: "pages.js",
  lang: "js",
  priority: 10,
});

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
 * The page Web Component. It is the root of the page hierarchy: `js.ext.js`
 * registers it, and the markdown/html/directory adapters extend
 * `PagesAdapter`.
 */
export class WebElements extends HTMLElement {
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

      if (Page.prototype instanceof HTMLElement) {
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

/**
 * The `.pages.js` adapter. The `.js` loader creates this class for plain
 * `.js` files too; both paths share the same page lifecycle.
 */
export default class PagesAdapter extends WebElements {
  static meta = meta;

  /** @returns {Promise<ParsedMeta>} */
  async parse() {
    return { ...(await super.parse()), routable: true };
  }
}
