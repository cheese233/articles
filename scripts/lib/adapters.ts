// Must precede adapter imports: classes extend HTMLElement.
import "./dom.ts";
import { readdir, readFile } from "node:fs/promises";
import * as path from "node:path";
import { pathToFileURL } from "node:url";
import { VFile } from "vfile";
import { parseAdapterName } from "../../shared/ext.ts";
import type {
  AdapterInfo,
  AdapterStatics,
  ParsedMeta,
} from "../../shared/types.ts";
import { paths } from "./paths.ts";

interface AdapterClass {
  new (file: VFile): { parse?: () => Promise<ParsedMeta> | ParsedMeta };
}

interface AdapterModule {
  default: Function;
  meta?: AdapterStatics;
  parse?: (file: VFile) => Promise<ParsedMeta> | ParsedMeta;
}

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
  if (typeof mod.default != "function" && typeof mod.parse != "function")
    throw new Error(`adapter ${info.file} has neither default nor parse`);

  cache.set(info.file, mod);
  return mod;
};

/**
 * Run only the adapter's metadata half. Class adapters expose parse on an
 * instance; the js.ext.js loader exposes a named parse function. No page is
 * ever rendered here.
 */
export const parseFile = async (
  info: AdapterInfo,
  rel: string,
  source: string,
): Promise<ParsedMeta> => {
  const file = new VFile({ path: rel, value: source, cwd: paths.root });

  try {
    if (info.file.endsWith(".html")) {
      const htmlInfo = (await listAdapters()).find((item) => item.ext == "html");
      if (!htmlInfo) throw new Error("missing html adapter");

      const html = await loadAdapter(htmlInfo);
      const htmlSource = await readFile(
        path.join(paths.adapters, path.basename(info.file)),
        "utf8",
      );
      const adapterFile = new VFile({ path: info.file, value: htmlSource });
      if (typeof html.parse != "function")
        throw new Error("html adapter has no parse");

      return await html.parse(adapterFile);
    }

    const adapter = await loadAdapter(info);
    let meta: ParsedMeta;

    if (typeof adapter.parse == "function") {
      meta = await adapter.parse(file);
    } else {
      const Adapter = adapter.default as AdapterClass;
      const instance = new Adapter(file);
      if (typeof instance.parse != "function")
        throw new Error(`adapter .${info.ext} cannot extract metadata (${rel})`);
      meta = await instance.parse();
    }

    if (!meta || typeof meta != "object")
      throw new Error(`adapter .${info.ext} returned invalid metadata`);

    return meta;
  } catch (e) {
    throw new Error(`failed to parse ${rel}: ${(e as Error).message}`, {
      cause: e,
    });
  }
};
