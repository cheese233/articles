import { spawnSync } from "node:child_process";

if (process.env.LEFTHOOK == "0") process.exit(0);

if (process.platform == "win32") {
  const result = spawnSync(
    process.execPath,
    ["scripts/sync_git_exclude.ts", "--staged"],
    { stdio: "inherit" },
  );
  process.exit(result.status ?? 1);
}

const result = spawnSync(
  "npx",
  ["lefthook", "run", "pre-commit"],
  { stdio: "inherit" },
);

process.exit(result.status ?? 1);
