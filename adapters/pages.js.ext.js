import { parseJsDoc } from "../shared/jsdoc.js";

/** @typedef {import("vfile").VFile} VFile */
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
 * `.pages.js` content is a default-exported function(shadowDom), exactly like
 * `.js`; the page adapter only supplies the routable default.
 *
 * @param {VFile} file
 * @param {ShadowRoot} shadow
 */
export default async function (file, shadow) {
  const path = file.path;
  if (!path) throw new Error("vfile has no path");

  const mod = await import(path);
  if (typeof mod.default != "function") {
    throw new Error(`${path}: default export must be a function`);
  }

  await mod.default(shadow);
}
