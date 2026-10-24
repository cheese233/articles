import WebElements from "./js.ext.js";

/** @type {import("../shared/types.ts").AdapterStatics} */
const meta = Object.freeze({
  ext: "pages.js",
  lang: "js",
  priority: 10,
});

/**
 * The parent of every page adapter. It extends the shared Web Component and
 * inherits the `.js` mounting behaviour from `js.ext.js`. A `.pages.js` file
 * is a page even without `@routable`.
 */
export default class PagesAdapter extends WebElements {
  static meta = meta;

  /** @returns {Promise<import("../shared/types.ts").ParsedMeta>} */
  async parse() {
    const parsed = await super.parse();
    return { ...parsed, routable: true };
  }
}
