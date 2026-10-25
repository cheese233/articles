import { readdir } from "node:fs/promises";
import * as path from "node:path";
import { paths } from "./paths.ts";

const skipDirs = new Set([
  ".git",
  ".dsh",
  ".wrangler",
  "adapters",
  "dist",
  "meta",
  "node_modules",
  "render",
  "scripts",
  "shared",
  "tests",
  "vendor",
]);

const skipRootFiles = new Set([
  ".gitignore",
  "LICENSE",
  "atom.xml",
  "feed.json",
  "index.html",
  "package-lock.json",
  "package.json",
  "robots.txt",
  "site.json",
  "sitemap.xml",
  "sw.js",
  "sw.js.hbs",
  "tsconfig.json",
  "web-test-runner.config.js",
  "wrangler.toml",
  "_headers",
  "_redirects",
]);

const walk = async (dir: string, rel: string, files: string[]) => {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    if (entry.isDirectory()) {
      if (skipDirs.has(entry.name)) continue;
      const next = rel ? `${rel}/${entry.name}` : entry.name;
      await walk(path.join(dir, entry.name), next, files);
      continue;
    }

    if (!rel && skipRootFiles.has(entry.name)) continue;
    files.push(rel ? `${rel}/${entry.name}` : entry.name);
  }
};

/** Content lives at the repository root; project directories are skipped. */
export const contentFiles = async () => {
  const files: string[] = [];
  await walk(paths.root, "", files);
  return files.sort();
};
