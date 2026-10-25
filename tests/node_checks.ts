import { readdir, readFile } from "node:fs/promises";
import * as path from "node:path";
import tsBlankSpace from "ts-blank-space";
import { discoverSpecifiers } from "../scripts/lib/imports.ts";
import { buildVendor } from "../scripts/lib/vendor_bundle.ts";

const clientDirs = ["render", "shared"];

const clientTypescript = async () => {
  const files: string[] = [];

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

export const typescriptCheck = async () => {
  const files = await clientTypescript();
  const errors: Array<{ file: string; nodes: number[] }> = [];

  for (const file of files) {
    const source = await readFile(file, "utf8");
    const nodes: number[] = [];
    tsBlankSpace(source, (node) => nodes.push(node.kind));
    if (nodes.length) errors.push({ file, nodes });
  }

  const app = await readFile("render/app.ts", "utf8");
  const code = tsBlankSpace(app);

  return {
    count: files.length,
    errors,
    app: {
      importsExt: code.includes('from "../shared/ext.ts"'),
      topLevelAwait: code.includes("await boot()"),
      noPromiseAnnotation: !code.includes(": Promise<"),
    },
  };
};

export const vendorCheck = async () => {
  const specifiers = await discoverSpecifiers();
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

  return { specifiers, modules: owners.size, duplicates };
};
