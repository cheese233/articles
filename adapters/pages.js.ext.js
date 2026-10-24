import { parseJsDoc } from "../shared/jsdoc.js";

/** @typedef {import("vfile").VFile} VFile */
/** @typedef {import("../shared/types.ts").ParsedMeta} ParsedMeta */

/** @type {import("../shared/types.ts").AdapterStatics} */
const meta = Object.freeze({
  ext: "pages.js",
  lang: "js",
  priority: 10,
});

/**
 * The single page class. The `.js` loader creates it for plain `.js` files;
 * the `.pages.js` adapter is this class itself. Markdown, HTML, and directory
 * adapters extend it.
 */
export class WebElements extends HTMLElement {
  static meta = meta;

  /** @type {((Page: Function) => string) | undefined} */
  static definePage;

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
    return { ...parseJsDoc(String(this.file)), routable: true };
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
        const definePage = /** @type {typeof WebElements} */ (this.constructor)
          .definePage;
        if (!definePage) throw new Error("page registration is not ready");
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

export default WebElements;
