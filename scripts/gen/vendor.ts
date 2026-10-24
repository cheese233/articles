import { createHash } from "node:crypto";
import { mkdir, readFile, rm } from "node:fs/promises";
import * as path from "node:path";
import { build } from "esbuild";
import type { Plugin } from "esbuild";
import { paths } from "../lib/paths.ts";

/**
 * Browser-side packages. Their entry points are resolved by esbuild, so the
 * package's own browser conditions are respected.
 */
const packages = [
  "ts-blank-space",
  "vfile",
  "yaml",
  "unified",
  "remark-parse",
  "remark-gfm",
  "remark-frontmatter",
  "remark-rehype",
  "rehype-stringify",
];

const safeName = (name: string) =>
  name.replace(/^@/, "").replace(/[\\/]/g, "-");

const nodeModules = path.join(paths.root, "node_modules") + path.sep;

/**
 * The virtual entry is resolved through esbuild (so `yaml` picks its browser
 * build, `vfile` its ESM entry, etc.). Everything that is actually loaded
 * must live under node_modules; project files are rejected.
 */
const onlyNodeModules = (): Plugin => ({
  name: "only-node-modules",
  setup(build) {
    build.onResolve({ filter: /^vendor:/ }, async (args) => {
      const name = args.path.slice("vendor:".length);
      const resolved = await build.resolve(name, {
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

export default async function () {
  await rm(paths.vendor, { recursive: true, force: true });
  await mkdir(paths.vendor, { recursive: true });

  await build({
    entryPoints: packages.map((name) => ({
      in: `vendor:${name}`,
      out: safeName(name),
    })),
    outdir: paths.vendor,
    bundle: true,
    format: "esm",
    platform: "browser",
    target: "es2022",
    minify: true,
    legalComments: "none",
    logLevel: "silent",
    plugins: [onlyNodeModules()],
  });

  const urls = new Map<string, string>();

  for (const name of packages) {
    const file = path.join(paths.vendor, `${safeName(name)}.js`);
    const content = await readFile(file);
    const hash = createHash("sha256")
      .update(content)
      .digest("hex")
      .slice(0, 12);

    urls.set(name, `/vendor/${safeName(name)}.js?v=${hash}`);
  }

  return urls;
}
