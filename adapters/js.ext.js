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
 * Import an adapter `.js` class and define its `<final-ext>-loader` element.
 * The adapter class is registered directly; there is no wrapper base class.
 *
 * @param {string} file
 */
export default async function (file) {
  const adapter = await import(file);
  const Adapter = adapter.default;
  if (typeof Adapter != "function" || !(Adapter.prototype instanceof HTMLElement))
    throw new Error(`${file}: default export must be a custom element class`);

  const ext = adapter.meta?.ext ?? Adapter.meta?.ext;
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
