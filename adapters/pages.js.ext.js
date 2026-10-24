import { VFile } from "vfile";
import { parseJsDoc } from "../shared/jsdoc.js";

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
 * Wrap an adapter factory into a custom element class. The element receives
 * its content path through the `path` attribute, for example
 * `<md-loader path="a.md">`.
 *
 * @param {((file: VFile) => (shadow: ShadowRoot) => unknown) & {
 *   meta?: AdapterStatics;
 * }} factory
 */
export default function (factory) {
  return class JSLoader extends HTMLElement {
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
}
