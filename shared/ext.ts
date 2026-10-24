import type { AdapterInfo } from "./types.ts";

const directoryMarker = "[...]";

/**
 * Split `<ext>.ext.<lang>` into its two halves. The handled extension keeps
 * every dot it contains, so `pages.js.ext.js` handles `.pages.js`.
 */
export const parseAdapterName = (name: string, file: string): AdapterInfo => {
  const parts = name.split(".ext.");
  if (parts.length != 2) throw new Error(`invalid adapter filename: ${name}`);

  const [ext, lang] = parts;
  if (!ext || !lang) throw new Error(`invalid adapter filename: ${name}`);

  const directory =
    ext == directoryMarker || ext.endsWith("." + directoryMarker);
  const prefix = directory
    ? ext.slice(0, ext.length - directoryMarker.length).replace(/\.$/, "")
    : "";

  return { ext, lang, file, directory, prefix };
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
 * Pick the most specific directory adapter for a route. `[...]` accepts
 * every directory; `posts.[...]` only accepts `/posts/` and below.
 */
export const findDirectoryAdapter = (
  route: string,
  adapters: AdapterInfo[],
) =>
  adapters
    .filter((adapter) => adapter.directory)
    .filter((adapter) =>
      !adapter.prefix ||
      route == `/${adapter.prefix}/` ||
      route.startsWith(`/${adapter.prefix}/`)
    )
    .sort((a, b) => b.prefix.length - a.prefix.length)[0] ?? null;
