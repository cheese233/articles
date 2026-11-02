import type { VFile } from "vfile";
import {
  adapterChain,
  buildAdapterGraph,
} from "../../shared/adapter_graph.ts";
import type { AdapterIndex, AdapterInfo } from "../../shared/types.ts";

/**
 * Compile an adapter chain into a plain mount function. This module is only
 * imported by the lazy shim (render/lib/loader_shim.ts) the first time an
 * adapter is used; no adapter defines a custom element of its own.
 */

export type Handler = (file: VFile) => (shadow: ShadowRoot) => unknown;

export interface CompileChild {
  meta: AdapterInfo;
  handler?: Handler;
  body?: string;
}

type Compile = (
  child: CompileChild,
) => CompileChild | Promise<CompileChild>;

export interface CompiledAdapter {
  meta: AdapterInfo;
  mount(file: VFile, shadow: ShadowRoot): Promise<unknown>;
}

// Promises are cached so concurrent loaders share one chain import.
const cache = new Map<string, Promise<CompiledAdapter>>();

const loadAdapter = async (info: AdapterInfo) => {
  if (info.file.endsWith(".html")) {
    const response = await fetch(info.file, { cache: "no-store" });
    if (!response.ok) throw new Error(`cannot load adapter ${info.file}`);
    return { mod: null, body: await response.text() };
  }

  return { mod: await import(info.file), body: "" };
};

export const compileAdapter = (
  ext: string,
  index: AdapterIndex,
): Promise<CompiledAdapter> => {
  const cached = cache.get(ext);
  if (cached) return cached;

  const pending = compileChain(ext, index);
  cache.set(ext, pending);
  pending.catch(() => cache.delete(ext));
  return pending;
};

/**
 * Walk the filename chain (`md -> pages.js -> js`): the first module's
 * default export is the handler, and every module's `compile(child)` may
 * transform it. The result is the final handler, wrapped as `mount`.
 */
const compileChain = async (
  ext: string,
  index: AdapterIndex,
): Promise<CompiledAdapter> => {
  const graph = buildAdapterGraph(index.adapters);
  const chain = adapterChain(ext, graph);
  const info = chain[0];
  if (!info) throw new Error(`no adapter for .${ext}`);

  const modules = await Promise.all(chain.map(loadAdapter));
  const first = modules[0];

  let child: CompileChild = {
    meta: info,
    handler: first?.mod?.default as Handler | undefined,
    body: first?.body ?? "",
  };

  for (const { mod, body } of modules) {
    if (body) child = { ...child, body };
    if (mod?.compile) child = await (mod.compile as Compile)(child);
  }

  const handler = child.handler;
  if (typeof handler != "function")
    throw new Error(`adapter chain for .${ext} has no handler`);

  return {
    meta: child.meta,
    mount: async (file, shadow) => await handler(file)(shadow),
  };
};
