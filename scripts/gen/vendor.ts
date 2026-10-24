import { createHash } from "node:crypto";
import { mkdir, readFile, rm } from "node:fs/promises";
import * as path from "node:path";
import { build } from "esbuild";
import { discoverSpecifiers } from "../lib/imports.ts";
import { paths } from "../lib/paths.ts";
import { onlyNodeModules } from "../lib/vendor_plugin.ts";

const safeName = (specifier: string) =>
  specifier.replace(/^@/, "").replace(/[\\/]/g, "-");

export default async function () {
  const specifiers = await discoverSpecifiers();
  if (!specifiers.length) throw new Error("no browser dependencies found");

  await rm(paths.vendor, { recursive: true, force: true });
  await mkdir(paths.vendor, { recursive: true });

  await build({
    entryPoints: specifiers.map((specifier) => ({
      in: `vendor:${specifier}`,
      out: safeName(specifier),
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

  for (const specifier of specifiers) {
    const file = path.join(paths.vendor, `${safeName(specifier)}.js`);
    const content = await readFile(file);
    const hash = createHash("sha256")
      .update(content)
      .digest("hex")
      .slice(0, 12);

    urls.set(specifier, `/vendor/${safeName(specifier)}.js?v=${hash}`);
  }

  return urls;
}
