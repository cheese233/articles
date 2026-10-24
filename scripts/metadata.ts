#!/usr/bin/env node

import buildMetadata from "./gen/metadata.ts";

const data = await buildMetadata();

console.log(`metadata: ${data.entries.length} routable entries`);
