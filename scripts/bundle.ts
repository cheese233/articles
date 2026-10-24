#!/usr/bin/env node

import buildClient from "./gen/client.ts";
import buildShell from "./gen/shell.ts";
import buildVendor from "./gen/vendor.ts";

const hashes = await buildVendor();
await buildShell(hashes);
await buildClient();

console.log("bundle: vendor + shell + client");
