import { readdir } from "node:fs/promises";
import * as path from "node:path";
import { contentSkipDirs, contentSkipRootFiles } from "./ignore.ts";
import { paths } from "./paths.ts";

const walk = async (dir: string, rel: string, files: string[]) => {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    if (entry.isDirectory()) {
      if (contentSkipDirs.has(entry.name)) continue;
      const next = rel ? `${rel}/${entry.name}` : entry.name;
      await walk(path.join(dir, entry.name), next, files);
      continue;
    }

    if (!rel && contentSkipRootFiles.has(entry.name)) continue;
    files.push(rel ? `${rel}/${entry.name}` : entry.name);
  }
};

/** Content lives at the repository root; project directories are skipped. */
export const contentFiles = async () => {
  const files: string[] = [];
  await walk(paths.root, "", files);
  return files.sort();
};
