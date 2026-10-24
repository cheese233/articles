import { parseJsDoc } from "../shared/jsdoc.js";

/** @typedef {import("vfile").VFile} VFile */
/** @typedef {import("../shared/types.ts").AdapterContext} AdapterContext */
/** @typedef {import("../shared/types.ts").AdapterModule} AdapterModule */
/** @typedef {import("../shared/types.ts").AdapterStatics} AdapterStatics */
/** @typedef {import("../shared/types.ts").ParsedMeta} ParsedMeta */

/** @type {AdapterStatics} */
export const meta = Object.freeze({
  ext: "pages.js",
  lang: "js",
  priority: 10,
});

/** @param {VFile} file @returns {Promise<ParsedMeta>} */
export const parse = async (file) => ({
  ...parseJsDoc(String(file)),
  routable: true,
});

/**
 * The base page class. `js.ext.js` extends it for every adapter and defines
 * `<final-ext>-loader` elements. For `md` / `html` / directory the subclass
 * holds the adapter function; for `js` / `pages.js` it falls back to the content
 * module's `default(shadow)`.
 */
export default class WebElements extends HTMLElement {
  static meta = meta;

  /** @type {AdapterModule | null} */
  static adapter = null;

  /** @type {VFile} */
  file;
  /** @type {AdapterContext} */
  context;

  /** @param {VFile} file @param {AdapterContext} context */
  constructor(file, context) {
    super();
    this.file = file;
    this.context = context;
    this.attachShadow({ mode: "open" });
  }

  async connectedCallback() {
    const shadow = this.shadowRoot;
    if (!shadow) {
      this.dispatchEvent(new Event("error"));
      return;
    }

    try {
      const AdapterClass = /** @type {typeof WebElements} */ (this.constructor);
      const adapter = AdapterClass.adapter;

      if (adapter) {
        await adapter.default(this.file, shadow, this.context);
      } else {
        const path = this.file.path;
        if (!path) throw new Error("vfile has no path");

        const mod = await import(path);
        if (typeof mod.default != "function") {
          throw new Error(`${path}: default export must be a function`);
        }
        await mod.default(shadow);
      }

      this.dispatchEvent(new Event("rendered"));
    } catch (error) {
      console.error(error);
      this.dispatchEvent(new Event("error"));
    }
  }
}
