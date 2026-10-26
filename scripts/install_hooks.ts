import { execFileSync } from "node:child_process";
import { chmod, writeFile } from "node:fs/promises";
import * as path from "node:path";

const git = (...args: string[]) =>
  execFileSync("git", args, { encoding: "utf8" });

let hooks: string;
try {
  hooks = path.resolve(git("rev-parse", "--git-path", "hooks").trim());
} catch {
  process.exit(0);
}

const file = path.join(hooks, "pre-commit");
await writeFile(file, "#!/bin/sh\nexec node scripts/run_hook.ts\n");
await chmod(file, 0o755);
