import type { VFile } from "vfile";
import { loaderTag } from "../../shared/ext.ts";
import type {
  AdapterInfo,
  EntryMeta,
  Manifest,
  ManifestEntry,
  SiteConfig,
} from "../../shared/types.ts";

/**
 * Lazy loader elements. Every adapter in `meta/index.json` gets a tiny
 * `<ext>-loader` element at boot. Defining it imports nothing; the adapter
 * chain, the dependency graph and the content fetch are loaded only when an
 * instance connects. Content can therefore embed any loader tag, for example
 * `<jsx-loader path="/x.jsx"></jsx-loader>`, and it loads on demand.
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

const createShim = (info: AdapterInfo, manifest: Manifest) =>
  class LoaderShim extends HTMLElement implements LoaderElement {
    file?: VFile;
    site?: SiteConfig = manifest.site;
    entries: ManifestEntry[] = manifest.entries;
    route?: string;
    entry: EntryMeta | null = null;
    ready: Promise<void>;

    private settle: () => void = () => {};
    private started = false;

    constructor() {
      super();
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
        this.file ??= await readFile(info, path);

        const { loadLoader } = await import("./adapters.ts");
        const Loader = await loadLoader(info.ext, manifest);
        if (!Loader?.mount) throw new Error(`no mount for .${info.ext}`);

        await Loader.mount(this.file)(shadow);
        this.dispatchEvent(new Event(renderedEvent));
      } catch (error) {
        console.error(error);
        this.dispatchEvent(new Event(errorEvent));
      } finally {
        this.settle();
      }
    }
  };

/** Define one lazy loader element per adapter; existing tags are kept. */
export const defineLoaders = (manifest: Manifest) => {
  const tags: string[] = [];

  for (const info of manifest.adapters) {
    // Language roots such as `js.ext.js` only parse; they never mount.
    if (info.ext == info.lang) continue;

    const tag = loaderTag(info.ext);
    tags.push(tag);
    if (!customElements.get(tag)) {
      customElements.define(tag, createShim(info, manifest));
    }
  }

  return tags;
};
