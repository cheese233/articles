#!/usr/bin/env node

import buildMetadata from "./gen/metadata.ts";
import buildShell from "./gen/shell.ts";
import buildSw from "./gen/sw.ts";
import buildVendor from "./gen/vendor.ts";

const vendors = await buildVendor();
await buildSw(vendors);
await buildShell(vendors);

const data = await buildMetadata();

console.log(
  `built ${data.entries.length} pages, metadata only, into the repository root`,
);
