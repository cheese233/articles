import { VFile } from "vfile";
import {
  adapterChain,
  buildAdapterGraph,
} from "../../shared/adapter_graph.ts";
import type { AdapterIndex, AdapterInfo } from "../../shared/types.ts";

type Handler = (file: VFile) => (shadow: ShadowRoot) => unknown;

type CompileChild = {
  meta: AdapterInfo;
  handler?: Handler;
  body?: string;
  Adapter?: LoaderConstructor;
};

type Compile = (
  child: CompileChild,
) => CompileChild | Promise<CompileChild>;

export type LoaderConstructor = (new () => HTMLElement) & {
  meta?: AdapterInfo;
  parse?: (file: VFile) => unknown;
  mount?: (file: VFile) => (shadow: ShadowRoot) => unknown;
};

// Promises are cached so concurrent loaders share one chain import.
const cache = new Map<string, Promise<LoaderConstructor>>();

const loadAdapter = async (info: AdapterInfo) => {
  if (info.file.endsWith(".html")) {
    const response = await fetch(info.file, { cache: "no-store" });
    if (!response.ok) throw new Error(`cannot load adapter ${info.file}`);
    return { mod: null, body: await response.text() };
  }

  return { mod: await import(info.file), body: "" };
};

export const loadLoader = (
  ext: string,
  index: AdapterIndex,
): Promise<LoaderConstructor> => {
  const cached = cache.get(ext);
  if (cached) return cached;

  const pending = compileChain(ext, index);
  cache.set(ext, pending);
  pending.catch(() => cache.delete(ext));
  return pending;
};

const compileChain = async (
  ext: string,
  index: AdapterIndex,
): Promise<LoaderConstructor> => {
  const graph = buildAdapterGraph(index.adapters);
  const chain = adapterChain(ext, graph);
  const info = chain[0];
  const { mod, body } = await loadAdapter(info);

  let child: CompileChild = {
    meta: info,
    handler: mod?.default as Handler | undefined,
    body,
  };

  for (const node of chain) {
    const { mod, body } = await loadAdapter(node);
    if (body) child = { ...child, body };

    if (mod?.compile) {
      child = await (mod.compile as Compile)(child);
    }

    if (mod?.Adapter) {
      child.Adapter = (mod.Adapter as (child: CompileChild) => LoaderConstructor)(
        child,
      );
    }
  }

  if (!child.Adapter) throw new Error(`adapter chain for .${ext} has no loader`);
  return child.Adapter;
};
