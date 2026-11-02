import { readFile } from "node:fs/promises";
import Handlebars from "handlebars";
import { writeText } from "../lib/fs.ts";
import { paths } from "../lib/paths.ts";

// Template variable -> vendored specifier, matching `@vendor` in sw.js.hbs.
const urlNames = {
  tsBlankSpaceUrl: "ts-blank-space",
};

export default async function (vendors: Map<string, string>) {
  const template = await readFile(
    `${paths.root}/sw.js.hbs`,
    "utf8",
  );
  const context = Object.fromEntries(
    Object.entries(urlNames).map(([name, specifier]) => {
      const url = vendors.get(specifier);
      if (!url)
        throw new Error(`service worker needs the ${specifier} vendor URL`);
      return [name, url];
    }),
  );

  const render = Handlebars.compile(template, { noEscape: true });
  const code = render(context);

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
