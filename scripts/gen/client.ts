import { build } from "esbuild";
import { paths } from "../lib/paths.ts";

export default async function () {
  await build({
    entryPoints: [`${paths.render}/app.ts`],
    outfile: `${paths.render}/app.js`,
    bundle: true,
    format: "esm",
    platform: "browser",
    target: "es2022",
    minify: false,
    sourcemap: false,
    legalComments: "none",
    logLevel: "silent",
  });
}
