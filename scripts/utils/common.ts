import { simpleGit } from "npm:simple-git@3";

export async function getBackend(backend?: string) {
  if (!backend)
    backend = await (async () => {
      try {
        if (await simpleGit().checkIsRepo()) return "git";
        else return "fs";
      } catch {
        return "fs";
      }
    })();
  return await (backend == "git" ? import("./git.ts") : import("./fs.ts"));
}

export async function getWriter(output?: string) {
  const stream = output
    ? await Deno.open(output, {
      write: true,
      create: true,
      truncate: true,
    }).then((f) => f.writable)
    : Deno.stdout.writable;
  return stream.getWriter();
}

