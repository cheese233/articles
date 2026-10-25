import { readdir, readFile } from "node:fs/promises";
import { builtinModules } from "node:module";
import * as path from "node:path";
import { init, parse } from "es-module-lexer";
import tsBlankSpace from "ts-blank-space";
import { contentFiles } from "./content.ts";
import { paths } from "./paths.ts";

const roots = ["render", "shared", "adapters"];
const extraFiles = ["sw.js.hbs"];
const extensions = new Set([".ts", ".js", ".mjs", ".html"]);
const builtins = new Set(builtinModules);
const ready = init();

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

/**
 * js + md/html adapters are JavaScript, client code is TypeScript. Blanking
 * types first keeps es-module-lexer focused on the ESM syntax only.
 */
const scan = (source: string, file: string, found: Set<string>) => {
  const errors: number[] = [];
  const code = tsBlankSpace(source, (node) => errors.push(node.kind));

  if (errors.length) {
    throw new Error(
      `ts-blank-space cannot erase ${file} (${errors.length} nodes)`,
    );
  }

  let imports: ReturnType<typeof parse>[0];

  try {
    imports = parse(code)[0];
  } catch (error) {
    throw new Error(
      `failed to parse imports in ${file}: ${(error as Error).message}`,
    );
  }

  for (const item of imports) {
    if (!("specifier" in item)) continue;

    const specifier = item.specifier;
    if (specifier && isBare(specifier)) {
      if (specifier.startsWith("fluentui-webcomponents/")) continue;
      found.add(specifier);
    }
  }
};

const sourceFiles = async () => {
  const files = [];

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

      files.push(file);
    }
  }

  for (const rel of await contentFiles()) {
    const file = path.join(paths.root, rel);
    if (extensions.has(path.extname(file))) files.push(file);
  }

  for (const file of extraFiles) files.push(path.join(paths.root, file));

  return files.sort();
};

/**
 * Bare imports in every browser-executed file. `import type` is removed by
 * ts-blank-space, so only runtime specifiers reach the vendor build.
 */
export const discoverSpecifiers = async () => {
  await ready;

  const found = new Set<string>();

  for (const file of await sourceFiles()) {
    const source = await readFile(file, "utf8");

    if (file.endsWith(".hbs")) {
      for (const match of source.matchAll(/@vendor\s+([^\s}]+)/g)) {
        found.add(match[1] ?? "");
      }
    } else if (file.endsWith(".html")) {
      for (const script of moduleScripts(source)) {
        scan(script, file, found);
      }
    } else {
      scan(source, file, found);
    }
  }

  return [...found].sort();
};
