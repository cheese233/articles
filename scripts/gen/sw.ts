import { readFile } from "node:fs/promises";
import { writeText } from "../lib/fs.ts";
import { paths } from "../lib/paths.ts";

const placeholder = "<!-- @ts-blank-space -->";

export default async function (vendors: Map<string, string>) {
  const url = vendors.get("ts-blank-space");
  if (!url) throw new Error("missing ts-blank-space vendor bundle");

  const template = await readFile(`${paths.root}/sw.template.js`, "utf8");
  if (!template.includes(placeholder))
    throw new Error("sw.template.js has no ts-blank-space placeholder");

  await writeText(
    `${paths.root}/sw.js`,
    template.replace(placeholder, url),
  );
}
