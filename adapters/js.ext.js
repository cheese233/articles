import Pages from "./pages.js.ext.js";
import { parseJsDoc } from "../shared/jsdoc.js";

/** @typedef {import("vfile").VFile} VFile */
/** @typedef {import("../shared/types.ts").AdapterStatics} AdapterStatics */
/** @typedef {import("../shared/types.ts").ParsedMeta} ParsedMeta */

/** @type {AdapterStatics} */
export const meta = Object.freeze({
  ext: "js",
  lang: "js",
  priority: 40,
});

/** @param {VFile} file @returns {Promise<ParsedMeta>} */
export const parse = async (file) => parseJsDoc(String(file));

/** @param {typeof HTMLElement & { meta: AdapterStatics }} Adapter */
const define = (Adapter) => {
  const ext = Adapter.meta.ext;
  const base = ext
    .replaceAll("[...]", "directory")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "");
  const tag = `${base}-loader`;
  const existing = customElements.get(tag);
  if (existing) return /** @type {typeof Adapter} */ (existing);

  customElements.define(tag, Adapter);
  return Adapter;
};

/**
 * The js root receives either the class produced by pages.js or a raw content
 * factory for a `.js` file.
 *
 * @param {Function & { meta?: AdapterStatics }} input
 */
export default function (input) {
  if (input.prototype instanceof HTMLElement)
    return define(/** @type {typeof HTMLElement & { meta: AdapterStatics }} */ (input));

  return define(Pages(/** @type {((file: VFile) => (shadow: ShadowRoot) => unknown) & { meta?: AdapterStatics }} */ (input)));
}
