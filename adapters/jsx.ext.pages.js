import { parseJsDoc } from "../shared/jsdoc.js";

/** @typedef {import("vfile").VFile} VFile */
/** @typedef {import("../shared/types.ts").ParsedMeta} ParsedMeta */
/** @typedef {import("../render/lib/jsx.ts").Child} Child */

/**
 * JSX metadata follows js.ext.js: `# title`, `@date`, `@tags`, `@footer`. A
 * file is routable only with `@routable`; `@hidden` keeps components such
 * as `components/kipfel.jsx` out of the index, sitemap and feeds.
 * @param {VFile} file
 * @returns {Promise<ParsedMeta>}
 */
export const parse = async (file) => {
  const { hidden, ...meta } = parseJsDoc(String(file));
  return { ...meta, routable: meta.routable === true && !hidden };
};

/**
 * The page compiles the module itself (render/lib/jsx_loader.ts), so `.jsx`
 * can import other `.jsx` files and bare specifiers without a Service
 * Worker.
 * @param {VFile} file
 */
const factory = (file) => async (/** @type {ShadowRoot} */ shadow) => {
  const path = file.path;
  if (!path) throw new Error("jsx file has no path");

  const [{ importJsx }, { append }] = await Promise.all([
    import("../render/lib/jsx_loader.ts"),
    import("../render/lib/jsx.ts"),
  ]);
  // The loader already fetched the source; compile that text.
  const source = file.value == null ? undefined : String(file);
  const mod = await importJsx(path, source || undefined);
  if (typeof mod.default != "function")
    throw new Error(`${path}: default export must be a function`);

  /** @type {Child} */
  const result = await mod.default(shadow);
  append(shadow, [result]);
};

export default factory;
