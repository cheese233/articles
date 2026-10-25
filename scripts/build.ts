#!/usr/bin/env node

import buildFluent from "./lib/fluent.ts";
import buildMetadata from "./gen/metadata.ts";
import buildShell from "./gen/shell.ts";
import buildSw from "./gen/sw.ts";
import stage from "./gen/stage.ts";
import buildVendor from "./gen/vendor.ts";

const vendors = await buildVendor();
await buildFluent();
await buildSw(vendors);
await buildShell(vendors);

const data = await buildMetadata();
await stage();

console.log(
  `built ${data.entries.length} pages, metadata only, into dist/`,
);
