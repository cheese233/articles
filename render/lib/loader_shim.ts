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
 * Lazy adapters. There is one element class, `LoaderShim`. Every adapter is
 * a Proxy of that class, so the adapter *is* its element constructor:
 *
 *   customElements.define("md-loader", adapters.md);
 *   new adapters.md();              // same as createElement("md-loader")
 *   await adapters.md.mount(file, shadow);
 *
 * The Proxy's own fields (`ext`, `info`, `tag`, `loaded`, `read`, ...) are
 * local and cost nothing. Any other static member (`mount`, `meta`, ...) is
 * an async forwarder that imports and compiles the adapter chain on first
 * use, then calls through. Construction is not trapped: the browser builds
 * the element with the Proxy as `new.target`, which is how `HTMLElement`
 * finds the definition and how the instance finds its adapter.
 *
 * `defineLoaders(manifest)` returns a read-only registry Proxy keyed by
 * extension (`adapters.md`, `adapters["[...path]"]`). The router, the
 * directory adapter (for `main.*`) and embedded content all go through it,
 * so defining every tag at boot imports nothing and content can embed any
 * loader, for example `<jsx-loader path="/x.jsx"></jsx-loader>`.
 */

export const shimStyles = ["/render/shadow.css", "/render/markdown.css"];

export const renderedEvent = "rendered";
export const errorEvent = "error";

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

/** An adapter: a Proxy of the shim class with lazy static members. */
export interface LazyAdapter {
  new (): LoaderElement;
  readonly ext: string;
  readonly info: AdapterInfo;
  readonly tag: string;
  readonly manifest: Manifest;
  readonly adapters: AdapterRegistry;
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

/** The one loader element. Instances learn their adapter from `new.target`. */
class LoaderShim extends HTMLElement implements LoaderElement {
  file?: VFile;
  site?: SiteConfig;
  entries: ManifestEntry[];
  route?: string;
  entry: EntryMeta | null = null;
  adapters: AdapterRegistry;
  ready: Promise<void>;

  private adapter: LazyAdapter;
  private settle: () => void = () => {};
  private started = false;

  constructor() {
    super();
    // The Proxy that was defined for this tag, not LoaderShim itself.
    const adapter = new.target as unknown as LazyAdapter;
    this.adapter = adapter;
    this.site = adapter.manifest.site;
    this.entries = adapter.manifest.entries;
    this.adapters = adapter.adapters;
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

      this.route ??= path;
      this.file ??= await this.adapter.read(path);

      await this.adapter.mount(this.file, shadow);
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
 * Names `customElements.define` reads from a constructor. They must keep
 * their real (undefined) value instead of becoming lazy forwarders, or
 * `define` would try to read a function as `observedAttributes`.
 */
const reserved = new Set([
  "observedAttributes",
  "disabledFeatures",
  "formAssociated",
  // Awaiting an adapter must not look like a thenable and load it.
  "then",
]);

const createAdapter = (
  info: AdapterInfo,
  manifest: Manifest,
  registry: () => AdapterRegistry,
) => {
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

  const own: Record<string, () => unknown> = {
    ext: () => info.ext,
    info: () => info,
    tag: () => loaderTag(info.ext),
    manifest: () => manifest,
    adapters: registry,
    loaded: () => loaded,
    read: () => (path: string) => readFile(info, path),
  };

  const adapter = new Proxy(LoaderShim, {
    get(target, name, receiver) {
      if (typeof name == "string" && Object.hasOwn(own, name)) {
        return own[name]?.();
      }
      // Real class members (`prototype`, `name`, `Symbol.hasInstance`, ...)
      // and the names `define` reads stay untouched.
      if (typeof name == "symbol" || name in target || reserved.has(name)) {
        return Reflect.get(target, name, receiver);
      }

      return async (...args: unknown[]) => {
        const chain = await load() as unknown as Record<string, unknown>;
        const value = chain[name];
        return typeof value == "function"
          ? (value as (...args: unknown[]) => unknown).apply(chain, args)
          : value;
      };
    },
    has: (target, name) =>
      (typeof name == "string" && Object.hasOwn(own, name)) ||
      Reflect.has(target, name),
    set: () => false,
    defineProperty: () => false,
    deleteProperty: () => false,
  });

  // Proxy cannot express its forwarded statics in TypeScript; LazyAdapter
  // is the contract the traps implement.
  return adapter as unknown as LazyAdapter;
};

const createRegistry = (manifest: Manifest) => {
  const adapters = new Map<string, LazyAdapter>();
  const registry = new Proxy({}, {
    get: (_, name) => typeof name == "string" ? adapters.get(name) : undefined,
    has: (_, name) => typeof name == "string" && adapters.has(name),
    ownKeys: () => [...adapters.keys()],
    getOwnPropertyDescriptor: (_, name) => {
      const value = typeof name == "string" ? adapters.get(name) : undefined;
      return value
        ? { value, enumerable: true, configurable: true, writable: false }
        : undefined;
    },
    set: () => false,
    defineProperty: () => false,
    deleteProperty: () => false,
  }) as AdapterRegistry;

  for (const info of manifest.adapters) {
    // Language roots such as `js.ext.js` only parse; they never mount.
    if (info.ext == info.lang) continue;
    adapters.set(info.ext, createAdapter(info, manifest, () => registry));
  }

  return registry;
};

/**
 * Build the registry and define every adapter as its own `<ext>-loader`;
 * already defined tags are kept.
 */
export const defineLoaders = (manifest: Manifest) => {
  const adapters = createRegistry(manifest);

  for (const adapter of Object.values(adapters)) {
    if (!adapter || customElements.get(adapter.tag)) continue;
    customElements.define(adapter.tag, adapter);
  }

  return adapters;
};
