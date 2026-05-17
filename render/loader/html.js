import { unified } from "../markdown_deps.js";
import rehypeDomParse from "https://cdn.c23.me/rehype-dom-parse@5?module";
import { Loader as BaseLoader } from "./base.js";
import { selectAll } from "https://esm.cdn.c23.me/hast-util-select@6";
import { hasProperty } from "https://cdn.c23.me/hast-util-has-property@3?module";
import { toString } from "https://cdn.c23.me/hast-util-to-string@3?module";
import { remove } from "https://cdn.c23.me/unist-util-remove@4?module";
import rehypeDomStringify from "https://cdn.c23.me/rehype-dom-stringify@4?module";

export class Loader extends BaseLoader {
  /**
   * @param {string} content
   */
  async update(content) {
    const file = await unified()
      .use(rehypeDomParse)
      .use(() => (tree, file) => {
        file.data.scripts = [
          // <src> without async or defer will not be executed
          ...selectAll("script[async]", tree).map((e) => {
            return { elem: e, isAsync: true };
          }),
          ...selectAll("script[defer]", tree).map((e) => {
            return { elem: e, isAsync: false };
          }),
        ]
          .map(({ elem, isAsync }) => {
            remove(tree, elem);
            let content, src;
            if (hasProperty(elem, "src")) {
              if (typeof elem.properties.src == "string") {
                src = elem.properties.src;
              }
            } else content = toString(elem);
            return { content, isAsync, src };
          })
          .filter(({ content, _, src }) => !!(content || src));
      })
      .use(rehypeDomStringify)
      .process(content);

    this.shadow.innerHTML = file.toString();

    /** @type {(
     *   { content: string, isAsync: boolean } |
     *   { src: string, isAsync: boolean }
     * )[]} */
    const scripts = file.data.scripts;

    await Promise.all(
      scripts.map(({ content, src }) => this.execute(content, src)),
    );
    this.dispatchEvent(new Event("update"));
  }

  /**
   * @param {string | undefined} content
   * @param {string | undefined} src
   */
  async execute(content, src) {
    const key = `$${crypto.randomUUID()}_shadow`;
    window[key] = this.shadow;

    let blobUrl;
    if (!src)
      blobUrl = URL.createObjectURL(
        new Blob([content], {
          type: "text/javascript",
        }),
      );

    try {
      const structed = new URL(src ?? blobUrl, window.location.href);
      structed.hash = key;
      await import(structed.toString());
    } catch (e) {
      console.error(e);
    } finally {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
      delete window[key];
    }
  }
}
