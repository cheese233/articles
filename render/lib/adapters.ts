import { VFile } from "vfile";
import type {
  AdapterIndex,
  AdapterInfo,
  AdapterStatics,
} from "../../shared/types.ts";

type Handler = ((file: VFile) => (shadow: ShadowRoot) => unknown) & {
  meta?: AdapterStatics;
};

type AdapterDef = {
  meta: AdapterInfo;
  body: string;
  handler?: Handler;
  compile?: (child: AdapterDef) => Promise<{ meta: AdapterStatics; Adapter: LoaderConstructor }>;
};

export type LoaderConstructor = (new () => HTMLElement) & {
  meta?: AdapterStatics;
};

const cache = new Map<string, LoaderConstructor>();

const contentHandler = (meta: AdapterStatics): Handler => {
  const handler = ((file: VFile) => async (shadow: ShadowRoot) => {
    const path = file.path;
    if (!path) throw new Error("vfile has no path");
    const mod = await import(path);
    if (typeof mod.default != "function")
      throw new Error(`${path}: default export must be a function`);
    await mod.default(shadow);
  }) as Handler;

  handler.meta = meta;
  return handler;
};

const loadModule = async (info: AdapterInfo) => {
  if (info.file.endsWith(".html")) return null;
  return await import(info.file);
};

const loadDef = async (
  info: AdapterInfo,
  index: AdapterIndex,
): Promise<AdapterDef> => {
  const mod = await loadModule(info);
  const kind = mod?.meta?.kind;
  const body = info.file.endsWith(".html")
    ? await fetch(info.file, { cache: "no-store" }).then((res) => {
      if (!res.ok) throw new Error(`cannot load adapter ${info.file}`);
      return res.text();
    })
    : "";

  const handler = kind == "handler"
    ? mod.default as Handler
    : kind == "content"
    ? contentHandler(mod.meta as AdapterStatics)
    : undefined;

  const parent = index.adapters.find(
    (adapter) => adapter.ext == (mod?.meta?.lang ?? info.lang),
  );
  const parentMod = parent ? await loadModule(parent) : null;
  const compile = parentMod?.compile ?? mod?.compile;

  return { meta: info, body, handler, compile };
};

/**
 * Compile the content adapter until it reaches a def without a compile step.
 * The loop never asks what the extension or language is; it only checks for
 * the next compiler.
 */
export const loadLoader = async (
  ext: string,
  index: AdapterIndex,
): Promise<LoaderConstructor> => {
  const cached = cache.get(ext);
  if (cached) return cached;

  const info = index.adapters.find((adapter) => adapter.ext == ext);
  if (!info) throw new Error(`no adapter for .${ext}`);

  let def = await loadDef(info, index);

  while (def.compile) {
    const next = await def.compile(def);
    cache.set(ext, next.Adapter);
    return next.Adapter;
  }

  throw new Error(`adapter .${ext} produced no loader`);
};
