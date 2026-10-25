import type { ManifestEntry } from "./types.ts";

export const isMainEntry = (file: string) =>
  /(^|\/)main\.[^/]+$/.test(file);

/**
 * A directory route renders `main.<ext>` when it exists; otherwise the
 * directory adapter lists the directory.
 */
export const findMainEntry = (
  route: string,
  entries: ManifestEntry[],
) => {
  const dir = route.endsWith("/") ? route : `${route}/`;

  return entries.find((entry) => {
    if (!entry.file.startsWith(`${dir}main.`)) return false;
    const tail = entry.file.slice(`${dir}main.`.length);
    return !tail.includes("/");
  }) ?? null;
};
