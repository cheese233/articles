import { parseJsDoc } from "../shared/jsdoc.js";

/** @typedef {import("vfile").VFile} VFile */
/** @typedef {import("../shared/types.ts").AdapterStatics} AdapterStatics */
/** @typedef {import("../shared/types.ts").ParsedMeta} ParsedMeta */

/** @type {AdapterStatics} */
export const meta = Object.freeze({
  ext: "pages.js",
  lang: "js",
  priority: 10,
});

/**
 * The page class. `js.ext.js` asks it to create an adapter class:
 * `WebElements.create(file)` imports `*.ext.pages.js`, calls its default
 * factory with this class, and returns the generated class.
 */
export default class WebElements extends HTMLElement {
  static meta = meta;

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

  /**
   * Import an adapter module and turn its default factory into a class.
   * `pages.js.ext.js` is itself a class and is returned directly.
   *
   * @param {string} file
   * @returns {Promise<typeof WebElements>}
   */
  static async create(file) {
    const mod = await import(file);
    const factory = mod.default;

    if (typeof factory != "function")
      throw new Error(`${file}: default export must be a class or factory`);

    if (factory === WebElements || factory.prototype instanceof WebElements)
      return /** @type {typeof WebElements} */ (factory);

    const Adapter = factory(WebElements);
    if (typeof Adapter != "function" || !(Adapter.prototype instanceof WebElements))
      throw new Error(`${file}: factory must return a WebElements class`);

    if (mod.meta && !Adapter.meta) Adapter.meta = mod.meta;
    return Adapter;
  }

  /** @returns {Promise<ParsedMeta>} */
  async parse() {
    return { ...parseJsDoc(String(this.file)), routable: true };
  }

  /**
   * A `.js` or `.pages.js` module is mounted directly: a function receives the
   * page's ShadowRoot.
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

      if (typeof Page != "function") {
        throw new Error(`${path}: default export must be a function`);
      }

      await Page(target);
      this.dispatchEvent(new Event("rendered"));
    } catch (error) {
      console.error(error);
      this.dispatchEvent(new Event("error"));
    }
  }
}
