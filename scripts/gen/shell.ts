import { readFile } from "node:fs/promises";
import Handlebars from "handlebars";
import { writeText } from "../lib/fs.ts";
import { paths } from "../lib/paths.ts";

export default async function (vendors: Map<string, string>) {
  const template = await readFile(
    `${paths.render}/index.hbs`,
    "utf8",
  );
  const imports = Object.fromEntries(vendors);
  imports["fluentui-webcomponents/"] = "/vendor/fluentui/";

  const importmap = JSON.stringify(
    { imports },
    null,
    2,
  )
    .split("\n")
    .map((line, index) => (index ? `            ${line}` : line))
    .join("\n");

  const render = Handlebars.compile(template);
  await writeText(`${paths.render}/index.html`, render({ importmap }));
}
