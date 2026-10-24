import { createHash } from "node:crypto";
import { mkdir, readFile, rm, stat } from "node:fs/promises";
import * as path from "node:path";
import { build } from "esbuild";
import { paths } from "../lib/paths.ts";

/**
 * Only packages from node_modules are bundled. Application code is served as
 * TypeScript and blanked in the browser by `ts-blank-space`.
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

const pickExport = (value: unknown): string | undefined => {
  if (typeof value == "string") return value;
  if (!value || typeof value != "object") return undefined;

  const record = value as Record<string, unknown>;
  for (const key of ["browser", "default", "import", "module", "node"]) {
    const picked = pickExport(record[key]);
    if (picked) return picked;
  }
  return undefined;
};

const resolveEntry = async (name: string) => {
  const dir = path.join(paths.root, "node_modules", ...name.split("/"));
  const meta = JSON.parse(
    await readFile(path.join(dir, "package.json"), "utf8"),
  ) as {
    exports?: Record<string, unknown>;
    browser?: string | Record<string, string>;
    module?: string;
    main?: string;
  };

  const exported = typeof meta.exports == "string"
    ? meta.exports
    : meta.exports?.["."];
  const entry = pickExport(exported) ??
    (typeof meta.browser == "string" ? meta.browser : undefined) ??
    meta.module ??
    meta.main;

  if (!entry) throw new Error(`${name}: package has no entry point`);

  const file = path.resolve(dir, entry);
  await stat(file);
  return file;
};

const safeName = (name: string) =>
  name.replace(/^@/, "").replace(/[\\/]/g, "-");

export default async function () {
  await rm(paths.vendor, { recursive: true, force: true });
  await mkdir(paths.vendor, { recursive: true });

  const urls = new Map<string, string>();

  for (const name of packages) {
    const outfile = path.join(paths.vendor, `${safeName(name)}.js`);

    await build({
      entryPoints: [await resolveEntry(name)],
      outfile,
      bundle: true,
      format: "esm",
      platform: "browser",
      target: "es2022",
      minify: true,
      legalComments: "none",
      logLevel: "silent",
    });

    const content = await readFile(outfile);
    const hash = createHash("sha256")
      .update(content)
      .digest("hex")
      .slice(0, 12);
    const file = `/vendor/${safeName(name)}.js?v=${hash}`;

    urls.set(name, file);
  }

  return urls;
}
