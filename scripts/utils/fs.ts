import { walk as fsWalk } from "jsr:@std/fs@1/walk";
import * as path from "jsr:@std/path@1";
import { format } from "jsr:@std/path@1/posix/format";

export const walk = async function* (dir: string) {
  for await (const { path: p, name } of fsWalk(dir, {
    includeDirs: false,
    followSymlinks: true,
    exts: [".md", ".html", ".js"],
    skip: [/^scripts[\\\/]/, /^render[\\\/]/],
    match: [/^(?!.*(?:^|\/)\.)/],
  })) {
    const relPath = path.parse(path.relative(dir, p));
    yield {
      ext: path.extname(name),
      path: format(relPath),
      pathWithoutExt: format({ ...relPath, ext: undefined, base: undefined }),
    };
  }
};

export const read = async (p: string, root?: string) => {
  const fullPath = path.join(root ?? "", p);
  const meta = await Deno.stat(fullPath);
  return {
    content: await Deno.readTextFile(fullPath),
    modifiedTime: meta.mtime,
    creationTime: meta.birthtime,
  };
};
