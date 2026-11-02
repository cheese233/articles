import { parseJsDoc } from "../shared/jsdoc.js";

/** @typedef {import("vfile").VFile} VFile */
/** @typedef {import("../shared/types.ts").ParsedMeta} ParsedMeta */
/** @typedef {import("../render/lib/adapters.ts").Handler} Handler */
/** @typedef {import("../render/lib/adapters.ts").CompileChild} CompileChild */

/**
 * `.pages.js`: a module whose default export renders into a shadow root.
 * The module is the only `<pages-js-loader>` behaviour; the element itself
 * is the shared lazy shim in render/lib/loader_shim.ts, like every adapter.
 */
export default class PagesJs {
  /** @param {VFile} file @returns {Promise<ParsedMeta>} */
  static async parse(file) {
    return {
      ...parseJsDoc(String(file)),
      routable: true,
    };
  }

  /** @type {Handler} */
  static handler = (file) => async (shadow) => {
    const path = file.path;
    if (!path) throw new Error("pages.js file has no path");

    const mod = await import(new URL(path, location.href).href);
    if (typeof mod.default != "function")
      throw new Error(`${path}: default export must be a function`);

    await mod.default(shadow);
  };

  /**
   * Children of `pages.js` (md, html, jsx, directories) bring their own
   * handler; `.pages.js` content itself uses the module handler above.
   * @param {CompileChild} child
   * @returns {CompileChild}
   */
  static compile(child) {
    // For `.pages.js` content the chain starts at this module, so its
    // default export (this class, not a handler) arrives as `handler`.
    /** @type {unknown} */
    const handler = child.handler;
    return {
      ...child,
      handler: typeof handler == "function" && handler != PagesJs
        ? /** @type {Handler} */ (handler)
        : PagesJs.handler,
    };
  }
}

export const compile = PagesJs.compile;
