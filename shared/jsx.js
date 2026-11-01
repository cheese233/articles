/**
 * JSX compile options shared by the Service Worker (runtime), the import
 * scanner (build) and the tests. The caller passes sucrase's `transform`, so
 * this module has no bare imports and the Service Worker can load it as is.
 */

/** Runtime module that provides the DOM `h` / `Fragment` factory. */
export const jsxRuntime = "/render/lib/jsx.ts";

/** Namespace the compiled code uses; unlikely to clash with user names. */
const namespace = "__jsx";

/**
 * @typedef {(source: string, options: {
 *   transforms: "jsx"[];
 *   jsxPragma: string;
 *   jsxFragmentPragma: string;
 *   production: boolean;
 * }) => { code: string }} Transform
 */

/**
 * Compile JSX to plain ESM with the classic runtime. Sucrase keeps line
 * numbers, and the runtime import shares the first line, so stack traces
 * still point at the original source.
 * @param {Transform} transform
 * @param {string} source
 * @param {string} [runtime]
 * @returns {string}
 */
export const compileJsx = (transform, source, runtime = jsxRuntime) => {
  const { code } = transform(source, {
    transforms: ["jsx"],
    jsxPragma: `${namespace}.h`,
    jsxFragmentPragma: `${namespace}.Fragment`,
    production: true,
  });

  return `import * as ${namespace} from ${JSON.stringify(runtime)};${code}`;
};
