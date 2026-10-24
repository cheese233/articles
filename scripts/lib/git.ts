import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

/**
 * Committer date of the last commit touching `file`, in strict ISO 8601.
 * Returns null when git is unavailable or the file has no history yet.
 */
export const commitTime = async (root: string, file: string) => {
  try {
    const { stdout } = await run(
      "git",
      ["log", "-1", "--format=%cI", "--", file],
      { cwd: root },
    );
    const value = stdout.trim();
    return value ? new Date(value).toISOString() : null;
  } catch {
    return null;
  }
};
