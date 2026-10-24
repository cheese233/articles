// Must precede adapter imports: the js host extends HTMLElement.
import "./dom.ts";
import { readdir } from "node:fs/promises";
import * as path from "node:path";
import { pathToFileURL } from "node:url";
import { VFile } from "vfile";
import { parseAdapterName } from "../../shared/ext.ts";
import type {
  AdapterInfo,
  AdapterModule,
  ParsedMeta,
} from "../../shared/types.ts";
import { paths } from "./paths.ts";

const cache = new Map<string, AdapterModule>();

export const listAdapters = async () => {
  const names = await readdir(paths.adapters);

  return names
    .filter((name) => name.includes(".ext."))
    .map((name) => parseAdapterName(name, `/adapters/${name}`))
    .sort((a, b) => (a.ext < b.ext ? -1 : a.ext > b.ext ? 1 : 0));
};

export const loadAdapter = async (info: AdapterInfo) => {
  const cached = cache.get(info.file);
  if (cached) return cached;

  const file = path.join(paths.adapters, path.basename(info.file));
  const mod = await import(pathToFileURL(file).href) as AdapterModule;

  if (typeof mod.default != "function")
    throw new Error(`adapter ${info.file} has no default function`);
  if (typeof mod.parse != "function")
    throw new Error(`adapter ${info.file} has no parse function`);
  if (!mod.meta) throw new Error(`adapter ${info.file} has no meta`);

  cache.set(info.file, mod);
  return mod;
};

/**
 * Run only the adapter's metadata half. This is the whole CI job: no page
 * is ever rendered here.
 */
export const parseFile = async (
  info: AdapterInfo,
  rel: string,
  source: string,
): Promise<ParsedMeta> => {
  const adapter = await loadAdapter(info);

  try {
    const meta = await adapter.parse(
      new VFile({ path: rel, value: source, cwd: paths.content }),
    );
    if (!meta || typeof meta != "object")
      throw new Error(`adapter .${info.ext} returned invalid metadata`);
    return meta;
  } catch (e) {
    throw new Error(`failed to parse ${rel}: ${(e as Error).message}`, {
      cause: e,
    });
  }
};
