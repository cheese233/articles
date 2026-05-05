import parseMd from "../parse/md.ts";
import parseHTML from "../parse/html.ts";
import parseJs from "../parse/js.ts";

export interface ParseResult {
  meta: {
    title?: string;
    author?: string;
    include?: string[];
    exclude?: string[];
  };
  summary: string;
}

export default async function (
  content: string,
  ext: string,
): Promise<ParseResult | null> {
  switch (ext) {
    case ".md":
      return await parseMd(content);
    case ".html":
      return parseHTML(content);
    case ".js":
      return await parseJs(content);
    default:
      return null;
  }
}
