import PagesAdapter, { WebElements } from "./pages.js.ext.js";
import { parseJsDoc } from "../shared/jsdoc.js";

/** @typedef {import("vfile").VFile} VFile */
/** @typedef {import("../shared/types.ts").ParsedMeta} ParsedMeta */

let contentTag = 0;
/** @type {WeakMap<Function, string>} */
const contentTags = new WeakMap();

/**
 * Register a content module's custom element class once. The page component
 * calls this through the static `definePage` hook set below.
 *
 * @param {Function} Page
 */
const definePage = (Page) => {
  const existing = contentTags.get(Page);
  if (existing) return existing;

  const tag = `page-content-${contentTag++}`;
  try {
    customElements.define(
      tag,
      /** @type {CustomElementConstructor} */ (Page),
    );
  } catch {
    // The class may already be registered elsewhere; `new Page()` is still
    // constructible in that case.
  }
  contentTags.set(Page, tag);
  return tag;
};

WebElements.definePage = definePage;

/** @type {import("../shared/types.ts").AdapterStatics} */
const meta = Object.freeze({
  ext: "js",
  lang: "js",
  priority: 40,
});

/**
 * The plain `.js` language loader. It is not an HTMLElement: it parses
 * metadata and creates the `pages.js` Web Component that actually renders.
 * It also registers the page classes; `pages.js.ext.js` only exports them.
 */
export default class JavaScriptAdapter {
  static meta = meta;

  /** @type {VFile} */
  file;
  /** @type {import("../shared/types.ts").SiteConfig | undefined} */
  site;
  /** @type {import("../shared/types.ts").ManifestEntry[]} */
  entries = [];
  /** @type {string | undefined} */
  route;
  /** @type {import("../shared/types.ts").EntryMeta | null} */
  entry = null;

  /** @param {VFile} file */
  constructor(file) {
    this.file = file;
  }

  /** @returns {Promise<ParsedMeta>} */
  async parse() {
    return parseJsDoc(String(this.file));
  }

  /** @returns {import("../shared/types.ts").AdapterInstance} */
  create() {
    const page = new PagesAdapter(this.file);
    page.site = this.site;
    page.entries = this.entries;
    page.route = this.route;
    page.entry = this.entry;
    return page;
  }
}

if (!customElements.get("web-elements")) {
  customElements.define(
    "web-elements",
    /** @type {CustomElementConstructor} */ (WebElements),
  );
}

if (!customElements.get("pages-element")) {
  customElements.define(
    "pages-element",
    /** @type {CustomElementConstructor} */ (PagesAdapter),
  );
}
