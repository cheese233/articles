import JavaScriptAdapter from "./js.ext.js";

/** @type {import("../shared/types.ts").AdapterStatics} */
const meta = Object.freeze({
  ext: "pages.js",
  lang: "js",
  priority: 10,
});

export default class PagesAdapter extends JavaScriptAdapter {
  static meta = meta;

  /**
   * A `.pages.js` file is a page, even without `@routable`. The parent
   * `js.ext.js` adapter still decides how the module is executed.
   *
   * @returns {Promise<import("../shared/types.ts").ParsedMeta>}
   */
  async parse() {
    const parsed = await super.parse();
    return { ...parsed, routable: true };
  }
}

