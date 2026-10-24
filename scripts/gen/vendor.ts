import { mkdir, rm } from "node:fs/promises";
import * as path from "node:path";
import * as commonjs from "@rollup/plugin-commonjs";
import * as json from "@rollup/plugin-json";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import * as terser from "@rollup/plugin-terser";
import { rollup } from "rollup";
import type { Plugin } from "rollup";
import { discoverSpecifiers } from "../lib/imports.ts";
import { paths } from "../lib/paths.ts";
import { builtinStubs, onlyNodeModules } from "../lib/vendor_plugin.ts";

const commonjsPlugin = commonjs.default as unknown as (
  options?: { transformMixedEsModules?: boolean },
) => Plugin;
const jsonPlugin = json.default as unknown as () => Plugin;
const terserPlugin = terser.default as unknown as () => Plugin;

const safeName = (specifier: string) =>
  specifier.replace(/^@/, "").replace(/[\\/]/g, "-");

export default async function () {
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

  await rm(paths.vendor, { recursive: true, force: true });
  await mkdir(paths.vendor, { recursive: true });

  const bundle = await rollup({
    input: Object.fromEntries(
      specifiers.map((specifier) => [
        names.get(specifier) ?? specifier,
        `vendor:${specifier}`,
      ]),
    ),
    plugins: [
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
      terserPlugin(),
    ],
  });

  const write = async () => {
    try {
      return await bundle.write({
        dir: paths.vendor,
        format: "esm",
        entryFileNames: "[name]-[hash].js",
        chunkFileNames: "chunks/[name]-[hash].js",
        sourcemap: false,
      });
    } finally {
      await bundle.close();
    }
  };

  const { output } = await write();

  const files = new Map(
    output
      .filter((item) => item.type == "chunk" && item.isEntry)
      .map((item) => [item.name, item.fileName]),
  );
  const owners = new Map<string, string>();

  for (const item of output) {
    if (item.type != "chunk") continue;

    for (const [id, module] of Object.entries(item.modules)) {
      if (module.renderedLength == 0) continue;

      const owner = owners.get(id);
      if (owner) {
        throw new Error(
          `module bundled twice: ${id} (${owner}, ${item.fileName})`,
        );
      }
      owners.set(id, item.fileName);
    }
  }

  const urls = new Map<string, string>();

  for (const specifier of specifiers) {
    const file = files.get(names.get(specifier) ?? "");
    if (!file) throw new Error(`missing Rollup entry for ${specifier}`);
    urls.set(specifier, `/vendor/${file}`);
  }

  return urls;
}
