import WebElements from "./pages.js.ext.js";
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
 * Ask pages.js for the adapter class, then define it as
 * `<final-ext>-loader`. The adapter class is registered directly; there is no
 * wrapper class.
 *
 * @param {string} file
 */
export default async function (file) {
  const Adapter = await WebElements.create(file);
  const ext = Adapter.meta?.ext;
  if (!ext) throw new Error(`${file}: adapter has no meta.ext`);

  const base = ext
    .replaceAll("[...]", "directory")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "");
  const tag = `${base}-loader`;
  const existing = customElements.get(tag);
  if (existing) return /** @type {CustomElementConstructor} */ (existing);

  customElements.define(tag, Adapter);
  return /** @type {CustomElementConstructor} */ (Adapter);
}
