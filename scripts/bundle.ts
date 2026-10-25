#!/usr/bin/env node

import buildFluent from "./lib/fluent.ts";
import buildShell from "./gen/shell.ts";
import buildSw from "./gen/sw.ts";
import buildVendor from "./gen/vendor.ts";

const vendors = await buildVendor();
await buildFluent();
await buildSw(vendors);
await buildShell(vendors);

console.log("bundle: node_modules vendor bundles + fluent + shell");
