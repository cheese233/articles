import type { MainFile } from "./types.ts";

export const isMainEntry = (file: string) =>
  /(^|\/)main\.[^/]+$/.test(file);

/**
 * A directory route renders its `main.<ext>` when the build recorded one;
 * otherwise the directory adapter lists the directory. `main.*` is not an
 * entry of its own, so it is only reachable through the directory route.
 */
export const findMain = (route: string, mains: MainFile[]) => {
  const dir = route.endsWith("/") ? route : `${route}/`;
  return mains.find((main) => main.dir == dir) ?? null;
};
