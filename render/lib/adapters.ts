import { VFile } from "vfile";
import type {
  AdapterConstructor,
  AdapterIndex,
  AdapterInstance,
} from "../../shared/types.ts";

const cache = new Map<string, AdapterConstructor>();

/**
 * Every adapter is loaded by the adapter for the language it is written in.
 * `js.ext.js` is the only module imported directly, which is what breaks the
 * self-loop.
 */
export const loadAdapterClass = async (
  ext: string,
  index: AdapterIndex,
  stack: string[] = [],
): Promise<AdapterConstructor> => {
  const cached = cache.get(ext);
  if (cached) return cached;

  if (ext == "js") {
    const url = new URL("/adapters/js.ext.js", location.href).href;
    const mod = await import(url);
    const Adapter = mod.default as AdapterConstructor;
    cache.set(ext, Adapter);
    return Adapter;
  }

  if (stack.includes(ext))
    throw new Error(`adapter cycle: ${[...stack, ext].join(" -> ")}`);

  const info = index.adapters.find((adapter) => adapter.ext == ext);
  if (!info) throw new Error(`no adapter for .${ext}`);

  const Parent = await loadAdapterClass(info.lang, index, [...stack, ext]);
  const parent = new Parent(new VFile({ path: info.file })) as AdapterInstance;
  if (!parent.module)
    throw new Error(`adapter .${info.lang} cannot load .${ext}`);

  const mod = await parent.module();
  const Adapter = mod.default as AdapterConstructor | undefined;
  if (typeof Adapter != "function")
    throw new Error(`adapter .${ext} has no default class`);

  cache.set(ext, Adapter);
  return Adapter;
};

export const instantiate = (Adapter: AdapterConstructor, file: VFile) =>
  new Adapter(file) as AdapterInstance;
