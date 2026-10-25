import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import * as path from "node:path";
import { gitIgnoredPatterns, isGitIgnored } from "./lib/ignore.ts";

const git = (...args: string[]) =>
  execFileSync("git", args, { encoding: "utf8" });

const stripStaged = () => {
  const staged = git("diff", "--cached", "--name-only", "-z")
    .split("\0")
    .filter(Boolean);
  const ignored = staged.filter(isGitIgnored);

  if (ignored.length == 0) return;

  execFileSync("git", ["restore", "--staged", "--", ...ignored], {
    stdio: "inherit",
  });
  console.error(`unstaged ${ignored.length} ignored file(s)`);
};

const main = async () => {
  let gitDir: string;
  try {
    gitDir = path.resolve(git("rev-parse", "--git-dir").trim());
  } catch {
    return;
  }

  const info = path.join(gitDir, "info");
  await mkdir(info, { recursive: true });
  await writeFile(
    path.join(info, "exclude"),
    [
      "# generated from scripts/lib/ignore.ts",
      ...gitIgnoredPatterns,
      "",
    ].join("\n"),
  );

  if (process.argv.includes("--staged")) stripStaged();
};

await main();
