import assert from "node:assert/strict";
import { test } from "node:test";
import { discoverSpecifiers } from "../scripts/lib/imports.ts";

test("discovers browser dependencies from source imports", async () => {
  const specifiers = await discoverSpecifiers();

  assert.ok(specifiers.includes("vfile"));
  assert.ok(specifiers.includes("yaml"));
  assert.ok(specifiers.includes("unified"));
  assert.ok(specifiers.includes("ts-blank-space"));

  assert.ok(!specifiers.includes("typescript"));
  assert.ok(!specifiers.includes("fast-xml-builder"));
  assert.ok(!specifiers.includes("fs"));
  assert.ok(!specifiers.includes("node:fs"));
  assert.ok(!specifiers.includes("../render/markdown_deps.ts"));
});
