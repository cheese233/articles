import { mkdir, readdir, writeFile } from "node:fs/promises";
import * as path from "node:path";

/**
 * Yield every non-dot file below `dir`, sorted by posix relative path.
 * Sorting here is what makes the metadata build reproducible.
 */
export const walk = async function* (dir: string) {
  const entries = await readdir(dir, {
    recursive: true,
    withFileTypes: true,
  });

  const files = entries
    .filter((entry) => entry.isFile())
    .map((entry) =>
      path
        .relative(dir, path.join(entry.parentPath, entry.name))
        .split(path.sep)
        .join("/")
    )
    .filter((file) => !file.split("/").some((part) => part.startsWith(".")))
    .sort();

  for (const file of files) {
    yield { path: file, full: path.join(dir, file) };
  }
};

export const writeText = async (file: string, content: string) => {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, content, "utf8");
};

export const writeJson = (file: string, value: unknown) =>
  writeText(file, JSON.stringify(value, null, 2) + "\n");
