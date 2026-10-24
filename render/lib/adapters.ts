import type { VFile } from "vfile";
import type { AdapterIndex } from "../../shared/types.ts";

export type LoaderConstructor = new (file: VFile) => HTMLElement;

const cache = new Map<string, LoaderConstructor>();

/**
 * `js.ext.js` turns an adapter `.js` class into a `<final-ext>-loader`
 * custom element. Plain `.js` content uses the pages.js adapter, matching the
 * old js adapter behaviour.
 */
export const loadLoader = async (
  ext: string,
  index: AdapterIndex,
): Promise<LoaderConstructor> => {
  const cached = cache.get(ext);
  if (cached) return cached;

  const info = index.adapters.find((adapter) => adapter.ext == ext);
  if (!info) throw new Error(`no adapter for .${ext}`);

  const target = ext == "js"
    ? index.adapters.find((adapter) => adapter.ext == "pages.js") ?? info
    : info;

  const mod = await import("../../adapters/js.ext.js") as {
    default: (file: string) => Promise<LoaderConstructor>;
  };
  const Loader = await mod.default(target.file);

  cache.set(ext, Loader);
  return Loader;
};
