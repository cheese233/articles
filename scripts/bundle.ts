#!/usr/bin/env node

import buildShell from "./gen/shell.ts";
import buildSw from "./gen/sw.ts";
import buildVendor from "./gen/vendor.ts";

const vendors = await buildVendor();
await buildSw(vendors);
await buildShell(vendors);

console.log("bundle: node_modules vendor bundles + shell");
