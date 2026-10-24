import { readdir, readFile } from "node:fs/promises";
import { builtinModules } from "node:module";
import * as path from "node:path";
import ts from "typescript";
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

const scriptKind = (file: string) =>
  file.endsWith(".ts") ? ts.ScriptKind.TS : ts.ScriptKind.JS;

const addSpecifier = (node: ts.Node, found: Set<string>) => {
  if (ts.isStringLiteral(node) && isBare(node.text)) found.add(node.text);
};

const collect = (source: string, file: string, found: Set<string>) => {
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    scriptKind(file),
  );

  const walk = (node: ts.Node) => {
    if (ts.isImportDeclaration(node)) {
      if (!node.importClause?.isTypeOnly) addSpecifier(node.moduleSpecifier, found);
    } else if (ts.isExportDeclaration(node)) {
      if (!node.isTypeOnly && node.moduleSpecifier)
        addSpecifier(node.moduleSpecifier, found);
    } else if (ts.isCallExpression(node)) {
      if (
        node.expression.kind == ts.SyntaxKind.ImportKeyword &&
        node.arguments.length == 1
      ) {
        const [specifier] = node.arguments;
        if (specifier) addSpecifier(specifier, found);
      }
    }

    ts.forEachChild(node, walk);
  };

  walk(sourceFile);
};

const moduleScripts = (source: string) =>
  [...source.matchAll(
    /<script\b(?=[^>]*\btype\s*=\s*["']module["'])[^>]*>([\s\S]*?)<\/script>/gi,
  )].map((match) => match[1] ?? "");

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

  for (const file of extraFiles) files.push(path.join(paths.root, file));

  return files.sort();
};

/**
 * Bare imports found in browser-executed source. The service worker template
 * is included too, so its `ts-blank-space` import is vendored the same way.
 */
export const discoverSpecifiers = async () => {
  const found = new Set<string>();

  for (const file of await sourceFiles()) {
    const source = await readFile(file, "utf8");

    if (file.endsWith(".html")) {
      for (const script of moduleScripts(source)) {
        collect(script, file, found);
      }
    } else {
      collect(source, file, found);
    }
  }

  return [...found].sort();
};
