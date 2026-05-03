import { unified } from "https://esm.sh/unified@11";
import rehypeParse from "https://esm.sh/rehype-parse@9";
import { Loader as BaseLoader } from "./base_loader.js";
import { selectAll } from "https://esm.sh/hast-util-select@6";
import { hasProperty } from "https://esm.sh/hast-util-has-property@3";
import { toString } from "https://esm.sh/hast-util-to-string@3";
import { remove } from "https://esm.sh/unist-util-remove@4";
import rehypeStringify from "https://esm.sh/rehype-stringify@10";

export class Loader extends BaseLoader {
  /**
   * @param {string} content
   */
  async update(content) {
    const file = await unified()
      .use(rehypeParse)
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
      .use(rehypeStringify)
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
