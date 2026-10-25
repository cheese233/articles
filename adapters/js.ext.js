import { parseJsDoc } from "../shared/jsdoc.js";

/** @typedef {import("vfile").VFile} VFile */
/** @typedef {import("../shared/types.ts").AdapterStatics} AdapterStatics */
/** @typedef {import("../shared/types.ts").ParsedMeta} ParsedMeta */

/** @type {AdapterStatics} */
export const meta = Object.freeze({
  ext: "js",
  lang: "pages.js",
  priority: 40,
  kind: "content",
});

/** @param {VFile} file @returns {Promise<ParsedMeta>} */
export const parse = async (file) => parseJsDoc(String(file));
