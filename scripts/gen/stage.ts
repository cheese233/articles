import { cp, mkdir, rm } from "node:fs/promises";
import * as path from "node:path";
import { paths } from "../lib/paths.ts";

const renderFiles = [
  "app.js",
  "style.css",
  "shadow.css",
  "markdown.css",
  "favicon.svg",
];

const rootFiles = [
  "sitemap.xml",
  "atom.xml",
  "feed.json",
  "robots.txt",
  "_redirects",
  "_headers",
  "LICENSE",
];

export default async function () {
  await rm(paths.dist, { recursive: true, force: true });
  await mkdir(path.join(paths.dist, "render"), { recursive: true });

  await cp(`${paths.render}/index.html`, path.join(paths.dist, "index.html"));

  for (const file of renderFiles) {
    await cp(
      path.join(paths.render, file),
      path.join(paths.dist, "render", file),
    );
  }

  for (const dir of ["content", "adapters", "meta", "vendor"]) {
    await cp(
      path.join(paths.root, dir),
      path.join(paths.dist, dir),
      { recursive: true },
    );
  }

  for (const file of rootFiles) {
    await cp(
      path.join(paths.root, file),
      path.join(paths.dist, file),
    );
  }
}
