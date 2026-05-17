import {
  rehypeDomStringify,
  remarkParse,
  remarkRehype,
  remarkMath,
  remarkFrontmatter,
  remarkGfm,
  unified,
  select,
} from "../markdown_deps.js";
import { Loader as BaseLoader } from "./base.js";

export class Loader extends BaseLoader {
  /**
   * @param {string} content
   */
  async update(content) {
    let head = _I.prestyle
      ? /* html */ `<link rel="stylesheet" href="/render/markdown.css" />`
      : "";

    const processed = await unified()
      .use(remarkParse)
      .use(remarkFrontmatter)
      .use(remarkMath)
      .use(remarkGfm)
      .use(remarkRehype, { allowDangerousHtml: true })
      .use(() => async (hast, file) => {
        const sub = unified();

        if (select("code.language-math", hast)) {
          sub.use(
            (
              await import("https://cdn.c23.me/@daiji256/rehype-mathml@1?module")
            ).default,
          );
          head += /* html */ `<link rel="stylesheet" href="https://cdn.c23.me/temml@0.13/dist/Temml-Local.css" />`;
        }

        if (select("code.language-mermaid", hast)) {
          sub.use(
            (await import("https://cdn.c23.me/rehype-mermaid@3?module"))
              .default,
            {
              strategy: "img-svg",
              dark: true,
            },
          );
        }

        if (select("pre > code", hast)) {
          sub.use(
            (await import("https://cdn.c23.me/@shikijs/rehype@4?module"))
              .default,
            {
              themes: { light: "github-light", dark: "github-dark" },
              defaultColor: "light-dark()",
            },
          );
        }

        return await sub.run(hast, file);
      })
      .use(rehypeDomStringify)
      .process(content)
      .then((file) => file.toString());

    this.shadow.innerHTML = head + processed;
    this.dispatchEvent(new Event("update"));
  }
}
