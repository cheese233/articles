import * as path from "node:path";

const projectDirs = [
  "adapters",
  "render",
  "scripts",
  "shared",
  "tests",
];

const projectRootFiles = [
  "LICENSE",
  "index.html",
  "lefthook.yml",
  "package-lock.json",
  "package.json",
  "site.json",
  "sw.js.hbs",
  "tsconfig.json",
  "web-test-runner.config.js",
  "wrangler.toml",
  "_headers",
  "_redirects",
];

const generatedDirs = [
  ".wrangler",
  "dist",
  "meta",
  "node_modules",
  "vendor",
];

const generatedFiles = [
  "atom.xml",
  "feed.json",
  "render/index.html",
  "robots.txt",
  "sitemap.xml",
  "sw.js",
];

const editorNoise = [".DS_Store", ".dev.vars", "Thumbs.db"];

export const contentSkipDirs = new Set([
  ...projectDirs,
  ...generatedDirs,
]);

export const contentSkipRootFiles = new Set([
  ...projectRootFiles,
  ...generatedFiles.filter((file) => !file.includes("/")),
]);

export const gitIgnoredPatterns = [
  ...generatedDirs.map((dir) => `${dir}/`),
  ...generatedFiles,
  ...editorNoise,
];

/** Generated files and editor noise, shared by staging and Git excludes. */
export const isGitIgnored = (file: string) => {
  const normalized = file.replace(/\\/g, "/");

  if (editorNoise.includes(path.posix.basename(normalized))) return true;
  if (generatedFiles.includes(normalized)) return true;

  return generatedDirs.some(
    (dir) => normalized == dir || normalized.startsWith(`${dir}/`),
  );
};
