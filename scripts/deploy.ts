#!/usr/bin/env node

import { spawnSync } from "node:child_process";

const project = process.env.CLOUDFLARE_PROJECT_NAME ?? "articles";
const command = [
  "wrangler",
  "pages",
  "deploy",
  "dist",
  "--project-name",
  project,
];

console.log(`deploy: npx ${command.join(" ")}`);

const result = spawnSync("npx", command, {
  stdio: "inherit",
  shell: process.platform == "win32",
});

if (result.status != 0)
  throw new Error(`wrangler exited with status ${result.status ?? "null"}`);
