import parseMd from "../parse/md.ts";
import parseHTML from "../parse/html.ts";
import parseJs from "../parse/js.ts";
export default async function (content: string, ext: string) {
  switch (ext) {
    case ".md":
      return parseMd(content);
    case ".html":
      return parseHTML(content);
    case ".js":
      return await parseJs(content);
    default:
      return null;
  }
}
