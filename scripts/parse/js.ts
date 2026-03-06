import { doc } from "jsr:@deno/doc@0";
import parseMd from "./md.ts";

const parse = async (content: string) => {
  const url = `data:text/javascript,${encodeURIComponent(content)}`;

  const nodes = (await doc([url]))[url] || [];

  for (const node of nodes) {
    const tags = node.jsDoc?.tags || [];

    if (
      tags.some((t) => t.kind == "unsupported" && t.value == "@routable")
    ) {
      if (!node.declarationKind.includes("export")) {
        console.error(`${node.name} might not be correctly exported`);
      }

      let { meta: { title, author }, summary } = parseMd(node.jsDoc?.doc ?? "");
      author = (tags.find((t) =>
        t.kind == "unsupported" && t.value.startsWith("@author")
      ) as { value: string } | undefined)?.value.replace(/^@author\s*/, "") ||
        author;

      return {
        meta: { title, author, entrypoint: node.name },
        summary: summary,
      };
    }
  }

  return null;
};

export default parse;
