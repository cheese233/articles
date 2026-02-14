import { walk as fsWalk } from "jsr:@std/fs@1/walk";
import path from "node:path";
import parseMd from "../parse/md.ts";
import parseHTML from "../parse/html.ts";

export const walk = (dir: string) =>
  fsWalk(dir, {
    includeDirs: false,
    exts: [".md", ".html"],
    skip: [/^scripts[\\\/]/, /^render[\\\/]/],
    match: [/^(?!.*(?:^|\/)\.)/],
  });

export const load = async (filePath: string) => {
  const ext = path.extname(filePath);
  const content = await Deno.readTextFile(filePath);

  if (ext === ".md") {
    return parseMd(content);
  } else if (ext === ".html") {
    return parseHTML(content);
  } else throw new Error(`WIP: ${ext}`);
};
