import { VFile } from "vfile";
import type {
  AdapterIndex,
  AdapterInfo,
  AdapterStatics,
} from "../../shared/types.ts";

type AdapterFactory = ((
  file: VFile,
) => (shadow: ShadowRoot) => void | Promise<void>) & {
  meta: AdapterStatics;
};

export type LoaderConstructor = new () => HTMLElement;

const cache = new Map<string, LoaderConstructor>();

const contentFactory = (meta: AdapterStatics) => {
  const factory = ((file: VFile) => async (shadow: ShadowRoot) => {
    const path = file.path;
    if (!path) throw new Error("vfile has no path");
    const mod = await import(path);
    if (typeof mod.default != "function")
      throw new Error(`${path}: default export must be a function`);
    await mod.default(shadow);
  }) as AdapterFactory;

  factory.meta = meta;
  return factory;
};

/**
 * Walk the adapter chain from the content extension to the js root. Nothing
 * here knows about md, json, or pages specifically; each step only follows the
 * `lang` edge.
 */
export const loadLoader = async (
  ext: string,
  index: AdapterIndex,
): Promise<LoaderConstructor> => {
  const cached = cache.get(ext);
  if (cached) return cached;

  const find = (name: string) =>
    index.adapters.find((adapter) => adapter.ext == name);

  const info = find(ext);
  if (!info) throw new Error(`no adapter for .${ext}`);

  let factory: AdapterFactory;
  let start: AdapterInfo | undefined;

  if (info.lang == "js") {
    const mod = await import(info.file);
    factory = contentFactory(mod.meta ?? { ext: info.ext, lang: info.lang });
    start = info;
  } else if (info.file.endsWith(".html")) {
    const lang = find(info.lang);
    if (!lang) throw new Error(`no ${info.lang} adapter for .${ext}`);

    const [html, response] = await Promise.all([
      import(lang.file),
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
    start = find(lang.lang);
  } else {
    const mod = await import(info.file);
    factory = mod.default as AdapterFactory;
    if (typeof factory != "function")
      throw new Error(`adapter .${ext} has no default factory`);
    start = find(info.lang);
  }

  const chain: AdapterInfo[] = [];
  let node = start;
  while (node) {
    chain.push(node);
    if (node.ext == "js") break;
    node = find(node.lang);
  }

  let value: unknown = factory;
  for (const adapter of chain) {
    const mod = await import(adapter.file);
    value = mod.default(value);
  }

  const Adapter = value as LoaderConstructor;
  cache.set(ext, Adapter);
  return Adapter;
};
