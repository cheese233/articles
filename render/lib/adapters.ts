import type { AdapterIndex, AdapterModule } from "../../shared/types.ts";

const cache = new Map<string, AdapterModule>();

/**
 * Import an adapter module by extension. Adapters are functions: named
 * `meta` / `parse` plus a default render function; there is no class chain.
 */
export const loadAdapter = async (
  ext: string,
  index: AdapterIndex,
): Promise<AdapterModule> => {
  const cached = cache.get(ext);
  if (cached) return cached;

  const info = index.adapters.find((adapter) => adapter.ext == ext);
  if (!info) throw new Error(`no adapter for .${ext}`);

  const mod = await import(info.file) as AdapterModule;
  if (typeof mod.default != "function")
    throw new Error(`adapter .${ext} has no default function`);
  if (typeof mod.parse != "function")
    throw new Error(`adapter .${ext} has no parse function`);
  if (!mod.meta) throw new Error(`adapter .${ext} has no meta`);

  cache.set(ext, mod);
  return mod;
};
