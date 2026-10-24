import assert from "node:assert/strict";
import { test } from "node:test";
import { discoverSpecifiers } from "../scripts/lib/imports.ts";
import { buildVendor } from "../scripts/lib/vendor_bundle.ts";

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

test("vendor bundle keeps every module in one chunk", async () => {
  const { output } = await buildVendor({ write: false, minify: false });
  const owners = new Map<string, string>();
  const duplicates: string[] = [];

  for (const chunk of output) {
    if (chunk.type != "chunk") continue;

    for (const [id, module] of Object.entries(chunk.modules)) {
      if (module.renderedLength == 0) continue;

      const owner = owners.get(id);
      if (owner) duplicates.push(`${id} (${owner}, ${chunk.fileName})`);
      else owners.set(id, chunk.fileName);
    }
  }

  assert.ok(owners.size > 0);
  assert.deepEqual(duplicates, []);
});
