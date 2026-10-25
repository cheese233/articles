import { cp, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import * as path from "node:path";
import { paths } from "./paths.ts";

const require = createRequire(import.meta.url);

/** Copy the package source tree so component-relative CSS URLs keep working. */
export default async function () {
  const root = path.dirname(
    require.resolve("fluentui-webcomponents/package.json"),
  );
  const target = path.join(paths.vendor, "fluentui");

  await mkdir(target, { recursive: true });
  await cp(path.join(root, "core"), path.join(target, "core"), {
    recursive: true,
  });
  await cp(path.join(root, "components"), path.join(target, "components"), {
    recursive: true,
  });
  await cp(path.join(root, "tokens.css"), path.join(target, "tokens.css"));
}
