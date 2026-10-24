import { readFile } from "node:fs/promises";
import { writeText } from "../lib/fs.ts";
import { paths } from "../lib/paths.ts";

export default async function (vendors: Map<string, string>) {
  let code = await readFile(`${paths.root}/sw.template.js`, "utf8");

  for (const [specifier, url] of vendors) {
    code = code.replaceAll(JSON.stringify(specifier), JSON.stringify(url));
  }

  const unresolved = [...code.matchAll(/\bfrom\s+["']([^"']+)["']/g)]
    .map((match) => match[1] ?? "")
    .filter((specifier) =>
      !specifier.startsWith(".") && !specifier.startsWith("/")
    );

  if (unresolved.length) {
    throw new Error(
      `unresolved service worker imports: ${unresolved.join(", ")}`,
    );
  }

  await writeText(`${paths.root}/sw.js`, code);
}
