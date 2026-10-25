import { readFile } from "node:fs/promises";
import Handlebars from "handlebars";
import { writeText } from "../lib/fs.ts";
import { paths } from "../lib/paths.ts";

export default async function (vendors: Map<string, string>) {
  const template = await readFile(
    `${paths.root}/templates/sw.hbs`,
    "utf8",
  );
  const tsBlankSpaceUrl = vendors.get("ts-blank-space");
  if (!tsBlankSpaceUrl)
    throw new Error("service worker needs the ts-blank-space vendor URL");

  const render = Handlebars.compile(template, { noEscape: true });
  const code = render({ tsBlankSpaceUrl });

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
