import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import * as path from "node:path";
import { test } from "node:test";
import tsBlankSpace from "ts-blank-space";

const clientDirs = ["render", "shared"];

const clientTypescript = async () => {
  const files = [];

  for (const dir of clientDirs) {
    for (const entry of await readdir(dir, {
      recursive: true,
      withFileTypes: true,
    })) {
      if (!entry.isFile() || !entry.name.endsWith(".ts")) continue;
      files.push(path.join(entry.parentPath, entry.name));
    }
  }

  return files.sort();
};

test("all client TypeScript is erasable by ts-blank-space", async () => {
  const files = await clientTypescript();
  assert.ok(files.length > 0);

  for (const file of files) {
    const source = await readFile(file, "utf8");
    const errors: number[] = [];
    tsBlankSpace(source, (node) => errors.push(node.kind));
    assert.deepEqual(errors, [], `${file} contains non-erasable syntax`);
  }
});

test("render/app.ts keeps its imports and top-level await", async () => {
  const source = await readFile("render/app.ts", "utf8");
  const code = tsBlankSpace(source);

  assert.ok(code.includes('from "../shared/ext.ts"'));
  assert.ok(code.includes("await boot()"));
  assert.ok(!code.includes(": Promise<"));
});
