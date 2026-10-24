import { mkdir, rm } from "node:fs/promises";
import * as path from "node:path";
import * as commonjs from "@rollup/plugin-commonjs";
import * as json from "@rollup/plugin-json";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import * as terser from "@rollup/plugin-terser";
import { rollup } from "rollup";
import type { Plugin, RollupOutput } from "rollup";
import { discoverSpecifiers } from "./imports.ts";
import { paths } from "./paths.ts";
import { builtinStubs, onlyNodeModules } from "./vendor_plugin.ts";

const commonjsPlugin = commonjs.default as unknown as (
  options?: { transformMixedEsModules?: boolean },
) => Plugin;
const jsonPlugin = json.default as unknown as () => Plugin;
const terserPlugin = terser.default as unknown as () => Plugin;

const safeName = (specifier: string) =>
  specifier.replace(/^@/, "").replace(/[\\/]/g, "-");

export interface VendorBuildOptions {
  write?: boolean;
  minify?: boolean;
}

export interface VendorBuild {
  urls: Map<string, string>;
  output: RollupOutput["output"];
}

export const buildVendor = async (
  { write = true, minify = true }: VendorBuildOptions = {},
): Promise<VendorBuild> => {
  const specifiers = await discoverSpecifiers();
  if (!specifiers.length) throw new Error("no browser dependencies found");

  const names = new Map<string, string>();
  const used = new Set<string>();

  for (const specifier of specifiers) {
    const name = safeName(specifier);
    if (used.has(name)) throw new Error(`vendor name collision: ${specifier}`);
    used.add(name);
    names.set(specifier, name);
  }

  if (write) {
    await rm(paths.vendor, { recursive: true, force: true });
    await mkdir(paths.vendor, { recursive: true });
  }

  const plugins: Plugin[] = [
    onlyNodeModules(),
    builtinStubs(),
    nodeResolve({
      browser: true,
      exportConditions: ["browser", "import", "default"],
      mainFields: ["browser", "module", "main"],
      preferBuiltins: false,
    }),
    commonjsPlugin({ transformMixedEsModules: true }),
    jsonPlugin(),
  ];

  if (minify) plugins.push(terserPlugin());

  const bundle = await rollup({
    input: Object.fromEntries(
      specifiers.map((specifier) => [
        names.get(specifier) ?? specifier,
        `vendor:${specifier}`,
      ]),
    ),
    plugins,
  });

  const options = {
    format: "esm" as const,
    entryFileNames: "[name]-[hash].js",
    chunkFileNames: "chunks/[name]-[hash].js",
    sourcemap: false,
  };

  const render = async () => {
    try {
      return write
        ? await bundle.write({ ...options, dir: paths.vendor })
        : await bundle.generate(options);
    } finally {
      await bundle.close();
    }
  };

  const { output } = await render();
  const files = new Map(
    output
      .filter((item) => item.type == "chunk" && item.isEntry)
      .map((item) => [item.name, item.fileName]),
  );
  const urls = new Map<string, string>();

  for (const specifier of specifiers) {
    const file = files.get(names.get(specifier) ?? "");
    if (!file) throw new Error(`missing Rollup entry for ${specifier}`);
    urls.set(specifier, `/vendor/${file}`);
  }

  return { urls, output };
};
