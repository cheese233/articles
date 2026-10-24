import { builtinModules } from "node:module";
import * as path from "node:path";
import type { Plugin } from "rollup";
import { paths } from "./paths.ts";

const nodeModules = path.join(paths.root, "node_modules") + path.sep;
const builtins = new Set(builtinModules);

/**
 * Resolve virtual `vendor:<specifier>` entries with Rollup's resolver, and
 * reject any module that does not live under node_modules.
 */
export const onlyNodeModules = (): Plugin => ({
  name: "only-node-modules",
  async resolveId(source) {
    if (!source.startsWith("vendor:")) return null;

    const specifier = source.slice("vendor:".length);
    const resolved = await this.resolve(
      specifier,
      path.join(paths.root, "index.js"),
      { skipSelf: true },
    );

    if (!resolved) throw new Error(`cannot resolve dependency: ${specifier}`);
    return resolved;
  },
  load(id) {
    if (id.startsWith("\0")) return null;
    if (!path.resolve(id).startsWith(nodeModules)) {
      this.error(`refusing to vendor a file outside node_modules: ${id}`);
    }
    return null;
  },
});

/**
 * TypeScript's Node entry probes fs/os/crypto behind a runtime check. Rollup
 * cannot leave those imports in a browser bundle, so give them empty stubs.
 */
export const builtinStubs = (): Plugin => ({
  name: "builtin-stubs",
  resolveId(source) {
    if (source.startsWith("node:") || builtins.has(source)) {
      return { id: `\0builtin:${source}`, moduleSideEffects: false };
    }
    return null;
  },
  load(id) {
    if (id.startsWith("\0builtin:")) return "export default {};";
    return null;
  },
});
