import { readdir, readFile } from "node:fs/promises";
import { builtinModules } from "node:module";
import * as path from "node:path";
import { build } from "esbuild";
import type { Plugin } from "esbuild";
import { paths } from "./paths.ts";

const roots = ["render", "shared", "adapters", "content"];
const extraFiles = ["sw.template.js"];
const extensions = new Set([".ts", ".js", ".mjs", ".html"]);
const builtins = new Set(builtinModules);

const isBare = (specifier: string) => {
  if (!specifier) return false;
  if (/^[.#/]/.test(specifier)) return false;
  if (/^[a-z]+:/i.test(specifier)) return false;

  const name = specifier.startsWith("@")
    ? specifier.split("/").slice(0, 2).join("/")
    : specifier.split("/")[0] ?? "";

  return !builtins.has(name);
};

const moduleScripts = (source: string) =>
  [...source.matchAll(
    /<script\b(?=[^>]*\btype\s*=\s*["']module["'])[^>]*>([\s\S]*?)<\/script>/gi,
  )].map((match) => match[1] ?? "");

const sourceEntries = async () => {
  const entryPoints: (string | { in: string; out: string })[] = [];
  const virtual = new Map<string, string>();
  let index = 0;

  const addHtml = async (file: string) => {
    const source = await readFile(file, "utf8");

    for (const script of moduleScripts(source)) {
      if (!script.trim()) continue;

      const id = `html:${file}#${index}`;
      virtual.set(id, script);
      entryPoints.push({ in: id, out: `html-${index}` });
      index += 1;
    }
  };

  for (const root of roots) {
    for (const entry of await readdir(path.join(paths.root, root), {
      recursive: true,
      withFileTypes: true,
    })) {
      if (!entry.isFile()) continue;

      const file = path.join(entry.parentPath, entry.name);
      if (!extensions.has(path.extname(file))) continue;
      if (file.endsWith("render/index.html")) continue;
      if (file.endsWith("render/app.js")) continue;

      if (file.endsWith(".html")) await addHtml(file);
      else entryPoints.push(file);
    }
  }

  for (const file of extraFiles) {
    entryPoints.push(path.join(paths.root, file));
  }

  return { entryPoints, virtual };
};

/**
 * Let esbuild parse every browser source file. Imports are externalized so
 * esbuild only reports them through onResolve; relative modules are covered
 * because every source file is also an entry point.
 */
export const discoverSpecifiers = async () => {
  const { entryPoints, virtual } = await sourceEntries();
  const found = new Set<string>();

  const collector: Plugin = {
    name: "collect-imports",
    setup(build) {
      build.onResolve({ filter: /^html:/ }, (args) => ({
        path: args.path,
        namespace: "html",
      }));

      build.onLoad({ filter: /.*/, namespace: "html" }, (args) => ({
        contents: virtual.get(args.path) ?? "",
        loader: "js",
      }));

      build.onResolve({ filter: /.*/ }, (args) => {
        if (args.kind == "entry-point") return undefined;
        if (isBare(args.path)) found.add(args.path);
        return { path: args.path, external: true };
      });
    },
  };

  await build({
    entryPoints,
    outdir: paths.vendor,
    bundle: true,
    write: false,
    format: "esm",
    logLevel: "silent",
    plugins: [collector],
  });

  return [...found].sort();
};
