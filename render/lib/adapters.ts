import { VFile } from "vfile";
import type {
  AdapterIndex,
  AdapterInfo,
  AdapterStatics,
} from "../../shared/types.ts";

type Handler = ((file: VFile) => (shadow: ShadowRoot) => unknown) & {
  meta?: AdapterStatics;
};

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
  meta?: AdapterStatics;
  parse?: (file: VFile) => unknown;
  mount?: (file: VFile) => (shadow: ShadowRoot) => unknown;
};

const cache = new Map<string, LoaderConstructor>();

const loadAdapter = async (info: AdapterInfo) => {
  if (info.file.endsWith(".html")) {
    const response = await fetch(info.file, { cache: "no-store" });
    if (!response.ok) throw new Error(`cannot load adapter ${info.file}`);
    return { mod: null, body: await response.text() };
  }

  return { mod: await import(info.file), body: "" };
};

const resolve = async (
  info: AdapterInfo,
  child: CompileChild,
  index: AdapterIndex,
): Promise<LoaderConstructor | undefined> => {
  const { mod, body } = await loadAdapter(info);
  const adapter = mod?.default as
    | (Function & { meta?: AdapterStatics })
    | undefined;
  const meta = mod?.meta ?? adapter?.meta;
  const next = body ? { ...child, body } : child;
  const compiled = mod?.compile
    ? await (mod.compile as Compile)(next)
    : next;

  const parent = index.adapters.find(
    (item) => item.ext == (meta?.lang ?? info.lang),
  );

  if (!parent) {
    const adapterFn = mod?.Adapter as
      | ((child: CompileChild) => LoaderConstructor)
      | undefined;
    return adapterFn ? adapterFn(compiled) : compiled.Adapter;
  }

  return resolve(parent, compiled, index);
};

export const loadLoader = async (
  ext: string,
  index: AdapterIndex,
): Promise<LoaderConstructor> => {
  const cached = cache.get(ext);
  if (cached) return cached;

  const info = index.adapters.find((adapter) => adapter.ext == ext);
  if (!info) throw new Error(`no adapter for .${ext}`);

  const { mod, body } = await loadAdapter(info);
  const Adapter = await resolve(info, {
    meta: info,
    handler: mod?.default as Handler | undefined,
    body,
  }, index);

  cache.set(ext, Adapter as LoaderConstructor);
  return Adapter as LoaderConstructor;
};
