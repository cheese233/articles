import { readFile } from "node:fs/promises";
import { writeText } from "../lib/fs.ts";
import { paths } from "../lib/paths.ts";

const placeholder = "<!-- @importmap -->";

export default async function (vendors: Map<string, string>) {
  const template = await readFile(
    `${paths.render}/index.template.html`,
    "utf8",
  );

  if (!template.includes(placeholder))
    throw new Error("index.template.html has no import map placeholder");

  const map = JSON.stringify(
    { imports: Object.fromEntries(vendors) },
    null,
    2,
  )
    .split("\n")
    .map((line, index) => (index ? `            ${line}` : line))
    .join("\n");

  await writeText(
    `${paths.render}/index.html`,
    template.replace(placeholder, map),
  );
}
