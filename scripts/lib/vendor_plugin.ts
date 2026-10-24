import * as path from "node:path";
import type { Plugin } from "esbuild";
import { paths } from "./paths.ts";

const nodeModules = path.join(paths.root, "node_modules") + path.sep;

/**
 * Resolve virtual `vendor:<specifier>` entries through esbuild, then reject
 * any loaded file outside node_modules.
 */
export const onlyNodeModules = (): Plugin => ({
  name: "only-node-modules",
  setup(build) {
    build.onResolve({ filter: /^vendor:/ }, async (args) => {
      const specifier = args.path.slice("vendor:".length);
      const resolved = await build.resolve(specifier, {
        kind: "import-statement",
        resolveDir: paths.root,
      });

      if (resolved.errors.length) return { errors: resolved.errors };

      return { path: resolved.path };
    });

    build.onLoad({ filter: /.*/ }, (args) => {
      if (args.namespace != "file") return undefined;
      if (!path.resolve(args.path).startsWith(nodeModules)) {
        throw new Error(
          `refusing to vendor a file outside node_modules: ${args.path}`,
        );
      }
      return undefined;
    });
  },
});
