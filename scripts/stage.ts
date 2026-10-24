#!/usr/bin/env node

import stage from "./gen/stage.ts";

await stage();

console.log("stage: dist/");
