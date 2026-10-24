import { createHash } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import { build } from "esbuild";
import { paths } from "../lib/paths.ts";

const entries = [
  { name: "markdown", file: "render/markdown_deps.ts" },
  { name: "yaml", file: "render/yaml_deps.ts" },
];

export default async function () {
  await mkdir(paths.vendor, { recursive: true });

  const hashes = new Map<string, string>();

  for (const entry of entries) {
    const outfile = `${paths.vendor}/${entry.name}.js`;

    await build({
      entryPoints: [`${paths.root}/${entry.file}`],
      outfile,
      bundle: true,
      format: "esm",
      platform: "browser",
      target: "es2022",
      minify: false,
      legalComments: "none",
      logLevel: "silent",
    });

    const content = await readFile(outfile);
    hashes.set(
      entry.name,
      createHash("sha256").update(content).digest("hex").slice(0, 12),
    );
  }

  return hashes;
}
