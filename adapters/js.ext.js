import WebElements from "./pages.js.ext.js";
import { parseJsDoc } from "../shared/jsdoc.js";

/** @typedef {import("vfile").VFile} VFile */
/** @typedef {import("../shared/types.ts").AdapterModule} AdapterModule */
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
 * Import an adapter `.js` file, read its final `meta.ext`, and define
 * `<final-ext>-loader`. The loader extends `pages.js`; for `md` / `html` /
 * directory it calls the adapter function, while `js` / `pages.js` fall back to
 * the content module's `default(shadow)`.
 *
 * @param {string} file
 */
export default async function (file) {
  const adapter = await import(file);
  const ext = adapter.meta?.ext;
  if (!ext) throw new Error(`${file}: adapter has no meta.ext`);

  const base = ext
    .replaceAll("[...]", "directory")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "");
  const tag = `${base}-loader`;
  const existing = customElements.get(tag);
  if (existing) return /** @type {typeof WebElements} */ (existing);

  const Adapter = class extends WebElements {
    static meta = adapter.meta;
    static adapter = ext == "js" || ext == "pages.js" ? null : adapter;
  };

  customElements.define(tag, Adapter);
  return Adapter;
}
