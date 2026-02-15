#!/usr/bin/env deno

import { parseArgs } from "jsr:@std/cli@1/parse-args";
import path from "node:path";
import { XMLBuilder } from "npm:fast-xml-parser@5";
import { load, walk } from "./utils.ts";

let { _: [dir], root: DocRoot, title } = parseArgs(Deno.args, {
  string: ["root", "_", "title"],
});
if (!dir) dir = ".";
if (!(await Deno.stat(dir)).isDirectory) throw new Error();

const info = [{ title: [{ "#text": title ?? "" }] }, {
  id: [{ "#text": DocRoot }],
}];

const builder = new XMLBuilder({
  ignoreAttributes: false,
  suppressEmptyNode: true,
  preserveOrder: true,
});

Deno.stdout.writeSync(
  new TextEncoder().encode(builder.build([{
    "?xml": [{ "#text": "" }],
    ":@": {
      "@_version": "1.0",
      "@_encoding": "UTF-8",
    },
  }, {
    ":@": {
      "@_xmlns": "http://www.w3.org/2005/Atom",
    },
    feed: [
      ...info,
      { updated: [{ "#text": new Date().toISOString() }] },
      ...(await Array.fromAsync(
        walk(dir),
        async ({ path: p, name }) => {
          const meta = await Deno.stat(p),
            ext = path.extname(name),
            url = new URL(p.slice(0, -ext.length), DocRoot).toString();

          const content = await load(p);

          if (!content) return {};

          return {
            entry: [
              {
                title: [{
                  "#text": content.meta.title ?? name.slice(0, -ext.length),
                }],
              },
              { id: [{ "#text": url }] },
              { ":@": { "@_href": url }, link: [] },
              {
                ":@": {
                  "@_href": new URL(p, DocRoot).toString(),
                  "@_rel": "via",
                },
                link: [],
              },
              { updated: [{ "#text": meta.mtime?.toISOString() }] },
              { author: [{ name: [{ "#text": content.meta.author }] }] },
              { summary: [{ "#text": content.summary }] },
            ],
          };
        },
      )),
    ],
  }])),
);
