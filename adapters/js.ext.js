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

/**
 * Define the class produced by the pages.js wrapper. The class is generated
 * once per extension; the content path is an attribute at mount time.
 *
 * @param {typeof HTMLElement & { meta: AdapterStatics }} Adapter
 */
export default function (Adapter) {
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
}
