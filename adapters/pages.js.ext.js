import { VFile } from "vfile";
import { parseJsDoc } from "../shared/jsdoc.js";

/** @typedef {import("../shared/types.ts").AdapterInfo} AdapterInfo */
/** @typedef {import("../shared/types.ts").AdapterStatics} AdapterStatics */
/** @typedef {import("../shared/types.ts").ParsedMeta} ParsedMeta */

/** @type {AdapterStatics} */
const meta = Object.freeze({
  ext: "pages.js",
  lang: "js",
  priority: 10,
});

/**
 * @typedef {((file: VFile) => (shadow: ShadowRoot) => unknown) & {
 *   meta?: AdapterStatics;
 * }} Handler
 */

/**
 * @typedef {{
 *   meta: AdapterInfo;
 *   handler?: Handler;
 *   Adapter?: typeof PagesLoader;
 * }} CompileChild
 */

/** @type {Handler} */
const identity = () => () => {};

const isLoader = (/** @type {unknown} */ value) =>
  typeof value == "function" &&
  value.prototype instanceof HTMLElement;

const wrap = (/** @type {Handler} */ handler) => {
  const Adapter = class JSLoader extends HTMLElement {
    static meta = handler.meta ?? meta;

    /** @type {VFile | undefined} */
    file;

    constructor() {
      super();
      this.attachShadow({ mode: "open" });
    }

    async connectedCallback() {
      try {
        const file = this.file ??
          new VFile({ path: this.getAttribute("path") ?? "" });
        if (!file.path) throw new Error("loader has no path");

        this.file = file;
        const shadow = this.shadowRoot;
        if (!shadow) throw new Error("loader has no shadow root");

        await handler(file)(shadow);
        this.dispatchEvent(new Event("rendered"));
      } catch (error) {
        console.error(error);
        this.dispatchEvent(new Event("error"));
      }
    }
  };

  Adapter.mount = handler;
  return Adapter;
};

export default class PagesLoader extends HTMLElement {
  static meta = meta;

  /** @param {VFile} file @returns {Promise<ParsedMeta>} */
  static async parse(file) {
    return {
      ...parseJsDoc(String(file)),
      routable: true,
    };
  }

  static handler = (/** @type {VFile} */ file) =>
    async (/** @type {ShadowRoot} */ shadow) => {
      const path = file.path;
      if (!path) throw new Error("pages.js file has no path");

      const mod = await import(path);
      if (typeof mod.default != "function")
        throw new Error(`${path}: default export must be a function`);

      await mod.default(shadow);
    };

  /** @param {VFile} file */
  static mount(file) {
    return async (/** @type {ShadowRoot} */ shadow) => {
      await this.handler(file)(shadow);
    };
  }

  /**
   * @param {CompileChild} child
   * @returns {{
   *   meta: AdapterInfo;
   *   Adapter: import("../render/lib/adapters.ts").LoaderConstructor;
   * }}
   */
  static compile(child) {
    const handler = child.handler ?? identity;
    const Adapter = child.Adapter ??
      (isLoader(handler)
        ? /** @type {import("../render/lib/adapters.ts").LoaderConstructor} */ (
          /** @type {unknown} */ (handler)
        )
        : wrap(/** @type {Handler} */ (handler)));

    Adapter.meta = child.meta;

    return {
      meta: child.meta,
      Adapter,
    };
  }

  /** @type {VFile | undefined} */
  file;

  #shadow;

  constructor() {
    super();
    this.#shadow = this.attachShadow({ mode: "open" });
  }

  async connectedCallback() {
    try {
      const file = this.file ??
        new VFile({ path: this.getAttribute("path") ?? "" });
      if (!file.path) throw new Error("pages.js loader has no path");

      this.file = file;
      const Loader = /** @type {typeof PagesLoader} */ (this.constructor);
      await Loader.mount(file)(this.#shadow);
      this.dispatchEvent(new Event("rendered"));
    } catch (error) {
      console.error(error);
      this.dispatchEvent(new Event("error"));
    }
  }
}

export const compile = PagesLoader.compile;
