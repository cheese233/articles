import type { VFile } from "vfile";
import type {
  AdapterConstructor,
  AdapterIndex,
  AdapterInstance,
} from "../../shared/types.ts";

const cache = new Map<string, AdapterConstructor>();
const tags = new Map<string, string>();

/**
 * The browser can only construct a custom element class after it has been
 * registered. The adapter class remains the page; registration is just the
 * Web Components requirement.
 */
const define = (ext: string, Adapter: AdapterConstructor) => {
  // `js.ext.js` registers WebElements itself; only child adapters need a tag.
  if (ext == "js") return;
  if (tags.has(ext)) return;

  const base = ext
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "") || "root";
  const tag = `page-${base}-${tags.size}`;

  if (!customElements.get(tag)) {
    customElements.define(
      tag,
      Adapter as unknown as CustomElementConstructor,
    );
  }

  tags.set(ext, tag);
};

/**
 * Every adapter is imported directly. Its parent adapter is its superclass:
 * `pages.js.ext.js` extends `js.ext.js`, and `md.ext.pages.js` extends the
 * `pages.js` adapter. Loading the parent first also enforces that chain; no
 * separate module() call exists.
 */
export const loadAdapterClass = async (
  ext: string,
  index: AdapterIndex,
  stack: string[] = [],
): Promise<AdapterConstructor> => {
  const cached = cache.get(ext);
  if (cached) return cached;

  if (stack.includes(ext))
    throw new Error(`adapter cycle: ${[...stack, ext].join(" -> ")}`);

  const info = index.adapters.find((adapter) => adapter.ext == ext);
  if (!info) throw new Error(`no adapter for .${ext}`);

  const mod = await import(info.file);
  const Adapter = mod.default as AdapterConstructor;
  if (typeof Adapter != "function")
    throw new Error(`adapter .${ext} has no default class`);

  if (ext != "js") {
    const Parent = await loadAdapterClass(
      info.lang,
      index,
      [...stack, ext],
    );
    if (!(Adapter.prototype instanceof Parent))
      throw new Error(`adapter .${ext} must extend .${info.lang}`);
  }

  define(ext, Adapter);
  cache.set(ext, Adapter);
  return Adapter;
};

export const instantiate = (Adapter: AdapterConstructor, file: VFile) =>
  new Adapter(file) as AdapterInstance;
