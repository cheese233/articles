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
    .use(remarkRehype)
    .use(rehypeStringify)
    .processSync(source)
    .toString();
