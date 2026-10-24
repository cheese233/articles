import type { VFile } from "vfile";
import type { AdapterContext, AdapterIndex } from "../../shared/types.ts";

export type LoaderConstructor = new (
  file: VFile,
  context: AdapterContext,
) => HTMLElement;

const cache = new Map<string, LoaderConstructor>();

/**
 * `js.ext.js` defines a `<final-ext>-loader` custom element for each adapter
 * `.js` file. Load that loader class on demand.
 */
export const loadLoader = async (
  ext: string,
  index: AdapterIndex,
): Promise<LoaderConstructor> => {
  const cached = cache.get(ext);
  if (cached) return cached;

  const info = index.adapters.find((adapter) => adapter.ext == ext);
  if (!info) throw new Error(`no adapter for .${ext}`);

  const mod = await import("../../adapters/js.ext.js") as {
    default: (file: string) => Promise<LoaderConstructor>;
  };
  const Loader = await mod.default(info.file);

  cache.set(ext, Loader);
  return Loader;
};
