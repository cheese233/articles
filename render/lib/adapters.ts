import { VFile } from "vfile";
import type { AdapterIndex, AdapterStatics } from "../../shared/types.ts";

type AdapterFactory = ((
  file: VFile,
) => (shadow: ShadowRoot) => void | Promise<void>) & {
  meta: AdapterStatics;
};

export type LoaderConstructor = new () => HTMLElement;

const cache = new Map<string, LoaderConstructor>();

/**
 * Build the nested chain `js.ext(pages.ext(factory))`. The factory waits for
 * the content file; the generated element receives it through `path` at mount.
 */
export const loadLoader = async (
  ext: string,
  index: AdapterIndex,
): Promise<LoaderConstructor> => {
  const cached = cache.get(ext);
  if (cached) return cached;

  const info = index.adapters.find((adapter) => adapter.ext == ext);
  if (!info) throw new Error(`no adapter for .${ext}`);

  const [{ default: define }, pages] = await Promise.all([
    import("../../adapters/js.ext.js"),
    import("../../adapters/pages.js.ext.js"),
  ]);
  const { default: wrap } = pages;

  let factory: AdapterFactory;

  if (ext == "js" || ext == "pages.js") {
    factory = ((file: VFile) => async (shadow: ShadowRoot) => {
      const path = file.path;
      if (!path) throw new Error("vfile has no path");
      const mod = await import(path);
      if (typeof mod.default != "function")
        throw new Error(`${path}: default export must be a function`);
      await mod.default(shadow);
    }) as AdapterFactory;
    factory.meta = pages.meta;
  } else if (info.file.endsWith(".html")) {
    const [html, response] = await Promise.all([
      import("../../adapters/html.ext.pages.js"),
      fetch(info.file, { cache: "no-store" }),
    ]);
    if (!response.ok) throw new Error(`cannot load adapter ${info.file}`);

    const adapterFile = new VFile({
      path: info.file,
      value: await response.text(),
    });
    const mount = html.default(adapterFile);

    factory = Object.assign((_file: VFile) => mount, {
      meta: { ext: info.ext, lang: info.lang },
    }) as AdapterFactory;
  } else {
    const mod = await import(info.file);
    factory = mod.default as AdapterFactory;
    if (typeof factory != "function")
      throw new Error(`adapter .${ext} has no default factory`);
  }

  const Adapter = define(wrap(factory)) as LoaderConstructor;
  cache.set(ext, Adapter);
  return Adapter;
};
