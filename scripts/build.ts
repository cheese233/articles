#!/usr/bin/env node

import buildClient from "./gen/client.ts";
import buildMetadata from "./gen/metadata.ts";
import buildShell from "./gen/shell.ts";
import stage from "./gen/stage.ts";
import buildVendor from "./gen/vendor.ts";

const hashes = await buildVendor();
await buildShell(hashes);
await buildClient();

const data = await buildMetadata();
await stage();

console.log(
  `built ${data.entries.length} pages, metadata only, into dist/`,
);
