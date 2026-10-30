import type { AdapterInfo } from "./types.ts";

const directoryPattern = /^(.*?)(\[\[?\.\.\.[^\]]+\]\]?|\[[^\]]+\])$/;

const escape = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const matchesGlob = (pattern: string, path: string) => {
  if (pattern == "**") return true;
  if (pattern.endsWith("/**")) {
    const base = escape(pattern.slice(0, -3));
    return new RegExp(`^${base}(?:/.*)?$`).test(path);
  }

  const source = pattern
    .split("/")
    .map((segment) => segment == "*" ? "[^/]+" : escape(segment))
    .join("/");

  return new RegExp(`^${source}$`).test(path);
};

/**
 * Split `<ext>.ext.<lang>` into its two halves. The handled extension keeps
 * every dot it contains, so `pages.js.ext.js` handles `.pages.js`.
 *
 * Directory adapters use Astro-style brackets:
 *   [...path]      every depth
 *   [slug]         one segment
 *   posts.[...path] only /posts/ and below
 */
export const parseAdapterName = (name: string, file: string): AdapterInfo => {
  const parts = name.split(".ext.");
  if (parts.length != 2) throw new Error(`invalid adapter filename: ${name}`);

  const [ext, lang] = parts;
  if (!ext || !lang) throw new Error(`invalid adapter filename: ${name}`);

  const match = directoryPattern.exec(ext);
  if (!match) {
    return { ext, lang, file, directory: false, prefix: "", pattern: "" };
  }

  const prefix = (match[1] ?? "").replace(/\.$/, "");
  const token = match[2] ?? "";
  const rest = token.includes("...");
  const base = prefix ? prefix.replace(/\./g, "/") : "";
  const pattern = base ? `${base}/${rest ? "**" : "*"}` : rest ? "**" : "*";

  return { ext, lang, file, directory: true, prefix, pattern };
};

/**
 * Match a path against the longest adapter extension, so compound
 * extensions win over their tail (`pages.js` before `js`).
 */
export const matchFileAdapter = (path: string, adapters: AdapterInfo[]) =>
  adapters
    .filter((adapter) => !adapter.directory)
    .sort((a, b) => b.ext.length - a.ext.length)
    .find((adapter) => path.endsWith("." + adapter.ext)) ?? null;

export const stripExt = (path: string, ext: string) =>
  path.slice(0, -(ext.length + 1));

export const findAdapter = (ext: string, adapters: AdapterInfo[]) =>
  adapters.find((adapter) => adapter.ext == ext) ?? null;

/**
 * Pick the most specific directory adapter for a route.
 * `[...path]` accepts every directory; `posts.[...path]` only accepts
 * `/posts/` and below.
 */
export const findDirectoryAdapter = (
  route: string,
  adapters: AdapterInfo[],
) => {
  const path = route.replace(/^\/|\/$/g, "");

  return adapters
    .filter((adapter) => adapter.directory)
    .filter((adapter) => {
      if (!path) return adapter.pattern == "**";
      return matchesGlob(adapter.pattern, path);
    })
    .sort((a, b) =>
      b.prefix.length - a.prefix.length ||
      Number(a.pattern.endsWith("**")) - Number(b.pattern.endsWith("**"))
    )[0] ?? null;
};
