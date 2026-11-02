import type { VFile } from "vfile";
import { loaderTag } from "../../shared/ext.ts";
import type {
  AdapterInfo,
  EntryMeta,
  Manifest,
  ManifestEntry,
  SiteConfig,
} from "../../shared/types.ts";
import type { CompiledAdapter } from "./adapters.ts";

/**
 * Lazy adapters. `defineLoaders(manifest)` returns a registry Proxy keyed by
 * adapter extension (`adapters.md`, `adapters["[...path]"]`). Each value is
 * itself a Proxy standing in for the compiled adapter chain:
 *
 * - its own fields (`ext`, `info`, `tag`, `loaded`, `read`) are local and
 *   cost nothing;
 * - any other property (`mount`, `meta`, ...) is an async forwarder that
 *   imports and compiles the chain on first use, then calls through.
 *
 * Every adapter renders through this one shim: the `<ext>-loader` element
 * defined per adapter is a thin subclass of `LoaderShim`, the router mounts
 * through it, and the directory adapter mounts `main.*` through the same
 * registry. Adapters no longer define elements of their own, so defining
 * every tag at boot imports nothing, and content can embed any loader, for
 * example `<jsx-loader path="/x.jsx"></jsx-loader>`.
 */

export const shimStyles = ["/render/shadow.css", "/render/markdown.css"];

export const renderedEvent = "rendered";
export const errorEvent = "error";

export interface LazyAdapter {
  readonly ext: string;
  readonly info: AdapterInfo;
  readonly tag: string;
  /** Whether the adapter chain has been imported and compiled. */
  readonly loaded: boolean;
  /** Read a content path the way this adapter expects it. */
  read(path: string): Promise<VFile>;
  /** Render `file` into `shadow`; loads the chain on first call. */
  mount(file: VFile, shadow: ShadowRoot): Promise<unknown>;
  /** Compiled chain metadata; loads the chain on first call. */
  meta(): Promise<AdapterInfo>;
}

export type AdapterRegistry = Readonly<Record<string, LazyAdapter | undefined>>;

export interface LoaderElement extends HTMLElement {
  file?: VFile;
  site?: SiteConfig;
  entries: ManifestEntry[];
  route?: string;
  entry: EntryMeta | null;
  /** Every adapter, so content can mount others without importing them. */
  adapters: AdapterRegistry;
  /** Settles once the first render finished or failed. */
  ready: Promise<void>;
}

const appendStyles = (target: ShadowRoot) => {
  for (const href of shimStyles) {
    const stylesheet = document.createElement("link");
    stylesheet.rel = "stylesheet";
    stylesheet.href = href;
    target.append(stylesheet);
  }
};

const readFile = async (info: AdapterInfo, path: string) => {
  const { VFile } = await import("vfile");
  // Directory adapters render from the loader fields, not from a body.
  if (info.directory) return new VFile({ path });

  const { fetchSource } = await import("./fetch.ts");
  return new VFile({ path, value: await fetchSource(path, info.ext) });
};

const createLazy = (info: AdapterInfo, manifest: Manifest) => {
  let compiled: Promise<CompiledAdapter> | null = null;
  let loaded = false;

  const load = () =>
    compiled ??= import("./adapters.ts")
      .then(({ compileAdapter }) => compileAdapter(info.ext, manifest))
      .then(
        (adapter) => {
          loaded = true;
          return adapter;
        },
        (error: unknown) => {
          // A failed import must not poison later attempts.
          compiled = null;
          throw error;
        },
      );

  const own: Record<string, unknown> = {
    ext: info.ext,
    info,
    tag: loaderTag(info.ext),
    read: (path: string) => readFile(info, path),
  };

  const lazy = new Proxy(own, {
    get(target, name) {
      if (name == "loaded") return loaded;
      // `then` stays undefined so awaiting the proxy itself is harmless.
      if (typeof name == "symbol" || name == "then") return undefined;
      if (Object.hasOwn(target, name)) return target[name];

      return async (...args: unknown[]) => {
        const adapter = await load() as unknown as Record<string, unknown>;
        const value = adapter[name];
        return typeof value == "function"
          ? (value as (...args: unknown[]) => unknown).apply(adapter, args)
          : value;
      };
    },
    set: () => false,
    defineProperty: () => false,
    deleteProperty: () => false,
  });

  // Proxy cannot express its forwarded members in TypeScript; the
  // interface above is the contract the traps implement.
  return lazy as unknown as LazyAdapter;
};

const createRegistry = (manifest: Manifest) => {
  const lazies = new Map<string, LazyAdapter>();

  for (const info of manifest.adapters) {
    // Language roots such as `js.ext.js` only parse; they never mount.
    if (info.ext == info.lang) continue;
    lazies.set(info.ext, createLazy(info, manifest));
  }

  const lookup = (name: string | symbol) =>
    typeof name == "string" ? lazies.get(name) : undefined;

  return new Proxy({}, {
    get: (_, name) => lookup(name),
    has: (_, name) => lookup(name) != null,
    ownKeys: () => [...lazies.keys()],
    getOwnPropertyDescriptor: (_, name) => {
      const value = lookup(name);
      return value
        ? { value, enumerable: true, configurable: true, writable: false }
        : undefined;
    },
    set: () => false,
    defineProperty: () => false,
    deleteProperty: () => false,
  }) as AdapterRegistry;
};

/** The one loader element; each tag is a subclass bound to its adapter. */
class LoaderShim extends HTMLElement implements LoaderElement {
  static adapter: LazyAdapter;
  static adapters: AdapterRegistry;
  static manifest: Manifest;

  file?: VFile;
  site?: SiteConfig;
  entries: ManifestEntry[];
  route?: string;
  entry: EntryMeta | null = null;
  adapters: AdapterRegistry;
  ready: Promise<void>;

  private settle: () => void = () => {};
  private started = false;

  constructor() {
    super();
    const shim = this.constructor as typeof LoaderShim;
    this.site = shim.manifest.site;
    this.entries = shim.manifest.entries;
    this.adapters = shim.adapters;
    this.ready = new Promise((resolve) => {
      this.settle = resolve;
    });
    appendStyles(this.attachShadow({ mode: "open" }));
  }

  connectedCallback() {
    if (this.started) return;
    this.started = true;
    void this.render();
  }

  private async render() {
    try {
      const shadow = this.shadowRoot;
      if (!shadow) throw new Error("loader has no shadow root");

      const path = this.file?.path ?? this.getAttribute("path") ?? "";
      if (!path) throw new Error(`<${this.localName}> has no path`);

      const adapter = (this.constructor as typeof LoaderShim).adapter;
      this.route ??= path;
      this.file ??= await adapter.read(path);

      await adapter.mount(this.file, shadow);
      this.dispatchEvent(new Event(renderedEvent));
    } catch (error) {
      console.error(error);
      this.dispatchEvent(new Event(errorEvent));
    } finally {
      this.settle();
    }
  }
}

/**
 * Build the lazy registry and define one `<ext>-loader` per adapter;
 * already defined tags are kept.
 */
export const defineLoaders = (manifest: Manifest) => {
  const adapters = createRegistry(manifest);

  for (const entry of Object.values(adapters)) {
    if (!entry || customElements.get(entry.tag)) continue;
    const adapter: LazyAdapter = entry;

    customElements.define(
      adapter.tag,
      class extends LoaderShim {
        static adapter = adapter;
        static adapters = adapters;
        static manifest = manifest;
      },
    );
  }

  return adapters;
};
