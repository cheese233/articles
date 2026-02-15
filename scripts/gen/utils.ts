import { walk as fsWalk } from "jsr:@std/fs@1/walk";
import path from "node:path";
import parseMd from "../parse/md.ts";
import parseHTML from "../parse/html.ts";
import parseJs from "../parse/js.ts";

export const walk = (dir: string) =>
  fsWalk(dir, {
    includeDirs: false,
    exts: [".md", ".html", ".js"],
    skip: [/^scripts[\\\/]/, /^render[\\\/]/],
    match: [/^(?!.*(?:^|\/)\.)/],
  });

export const load = async (file: string): Promise<
  {
    meta: {
      title?: string;
      author?: string;
      entrypoint?: string;
    };
    summary: string;
  } | null
> => {
  const ext = path.extname(file);
  const content = await Deno.readTextFile(file);
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
};
