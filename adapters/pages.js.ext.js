import { VFile } from "vfile";
import { parseJsDoc } from "../shared/jsdoc.js";

/** @typedef {import("../shared/types.ts").AdapterStatics} AdapterStatics */
/** @typedef {import("../shared/types.ts").ParsedMeta} ParsedMeta */

/** @type {AdapterStatics} */
export const meta = Object.freeze({
  ext: "pages.js",
  lang: "js",
  priority: 10,
  kind: "content",
});

/** @param {VFile} file @returns {Promise<ParsedMeta>} */
export const parse = async (file) => ({
  ...parseJsDoc(String(file)),
  routable: true,
});

const wrap = (/** @type {((file: VFile) => (shadow: ShadowRoot) => unknown) & { meta?: AdapterStatics }} */ factory) => {
  const Adapter = class JSLoader extends HTMLElement {
    static meta = factory.meta ?? meta;

    /** @type {VFile | undefined} */
    file;
    /** @type {AdapterStatics} */
    meta = factory.meta ?? meta;
    /** @type {unknown} */
    onMount;

    /** @type {import("../shared/types.ts").SiteConfig | undefined} */
    site;
    /** @type {import("../shared/types.ts").ManifestEntry[]} */
    entries = [];
    /** @type {string | undefined} */
    route;
    /** @type {import("../shared/types.ts").EntryMeta | null} */
    entry = null;

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

        const mount = factory(file);
        this.onMount = await mount(shadow);

        this.dispatchEvent(new Event("rendered"));
      } catch (error) {
        console.error(error);
        this.dispatchEvent(new Event("error"));
      }
    }
  };

  Adapter.mount = factory;
  return Adapter;
};

export default wrap;

/**
 * Compile a child adapter into a JS loader class.
 *
 * @param {{ meta: AdapterStatics, handler: ((file: VFile) => (shadow: ShadowRoot) => unknown) & { meta?: AdapterStatics } }} child
 */
export const compile = (child) => ({
  meta: child.meta,
  Adapter: wrap(child.handler),
});
