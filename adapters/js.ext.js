import { parseJsDoc } from "../shared/jsdoc.js";

/** @typedef {import("vfile").VFile} VFile */
/** @typedef {import("../shared/types.ts").AdapterStatics} AdapterStatics */

/** @type {AdapterStatics} */
export const meta = Object.freeze({
  ext: "js",
  lang: "js",
  priority: 40,
});

export const parse = async (/** @type {VFile} */ file) =>
  parseJsDoc(String(file));

/**
 * The page host. It is the only custom element; adapters render into its
 * ShadowRoot and never extend it.
 */
export class WebElements extends HTMLElement {
  /** @param {VFile} [file] */
  constructor(file) {
    super();
    this.file = file;
    this.attachShadow({ mode: "open" });
  }
}

if (!customElements.get("web-elements")) {
  customElements.define(
    "web-elements",
    /** @type {CustomElementConstructor} */ (WebElements),
  );
}

/**
 * `.js` content is a default-exported function(shadowDom).
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
