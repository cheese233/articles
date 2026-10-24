import { readFile } from "node:fs/promises";
import { paths } from "../lib/paths.ts";
import { writeText } from "../lib/fs.ts";

const placeholder = "<!-- @importmap -->";

export default async function (hashes: Map<string, string>) {
  const template = await readFile(
    `${paths.render}/index.template.html`,
    "utf8",
  );

  if (!template.includes(placeholder))
    throw new Error("index.template.html has no import map placeholder");

  const imports = {
    "yaml": `/vendor/yaml.js?v=${hashes.get("yaml")}`,
    "@site/markdown": `/vendor/markdown.js?v=${hashes.get("markdown")}`,
  };

  const map = JSON.stringify({ imports }, null, 2)
    .split("\n")
    .map((line, index) => (index ? `            ${line}` : line))
    .join("\n");

  await writeText(
    `${paths.render}/index.html`,
    template.replace(placeholder, map),
  );
}
