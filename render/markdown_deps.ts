import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkFrontmatter from "remark-frontmatter";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";

/**
 * The browser-side markdown pipeline. It is bundled into `vendor/` so the
 * adapters and the CI side resolve the same package versions from the
 * lockfile.
 */
export const renderMarkdown = (source: string) =>
  unified()
    .use(remarkParse)
    .use(remarkFrontmatter, ["yaml"])
    .use(remarkGfm)
    // Raw HTML is kept so articles can embed loader tags such as
    // `<jsx-loader path="/x.jsx">`; content is authored in this repository.
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeStringify, { allowDangerousHtml: true })
    .processSync(source)
    .toString();
