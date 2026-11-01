import { parseJsDoc } from "../shared/jsdoc.js";

/** @typedef {import("vfile").VFile} VFile */
/** @typedef {import("../shared/types.ts").ParsedMeta} ParsedMeta */
/** @typedef {import("../render/lib/jsx.ts").Child} Child */

/**
 * JSX metadata follows js.ext.js: `# title`, `@date`, `@tags`. A file is
 * routable only with `@routable`; `@hidden` keeps components such as
 * `components/kipfel.jsx` out of the index, sitemap and feeds.
 * @param {VFile} file
 * @returns {Promise<ParsedMeta>}
 */
export const parse = async (file) => {
  const { hidden, ...meta } = parseJsDoc(String(file));
  return { ...meta, routable: meta.routable === true && !hidden };
};

/**
 * The Service Worker compiles `.jsx` module requests, so the module is
 * imported by URL and can import other `.jsx` files or bare specifiers.
 * @param {VFile} file
 */
const factory = (file) => async (/** @type {ShadowRoot} */ shadow) => {
  const path = file.path;
  if (!path) throw new Error("jsx file has no path");

  const [mod, { append }] = await Promise.all([
    import(new URL(path, location.href).href),
    import("../render/lib/jsx.ts"),
  ]);
  if (typeof mod.default != "function")
    throw new Error(`${path}: default export must be a function`);

  /** @type {Child} */
  const result = await mod.default(shadow);
  append(shadow, [result]);
};

export default factory;
