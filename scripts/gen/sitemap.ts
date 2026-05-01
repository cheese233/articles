#!/usr/bin/env deno

import { parseArgs } from "jsr:@std/cli@1/parse-args";
import { XMLBuilder } from "npm:fast-xml-parser@5";
import { walk, read } from "../utils/fs.ts";
import parse from "../parse/parse.ts";

let {
  _: [dir],
  root: DocRoot,
} = parseArgs(Deno.args, {
  string: ["root", "_"],
});

if (!dir) dir = ".";
if (!(await Deno.stat(dir)).isDirectory) throw new Error();
if (!DocRoot) throw new Error();

const builder = new XMLBuilder({
  ignoreAttributes: false,
  suppressEmptyNode: true,
  preserveOrder: true,
  // format: true,
});

Deno.stdout.writeSync(
  new TextEncoder().encode(
    builder.build([
      {
        "?xml": [{ "#text": "" }],
        ":@": {
          "@_version": "1.0",
          "@_encoding": "UTF-8",
        },
      },
      {
        ":@": {
          "@_xmlns": "http://www.sitemaps.org/schemas/sitemap/0.9",
          "@_xmlns:meta": "https://codeberg.org/cheese233/articles",
        },
        urlset: await Array.fromAsync(
          walk(dir),
          async ({ path, pathWithoutExt, ext }) => {
            const content = await read(path),
              meta = await parse(content.content, ext);

            if (!meta) return {};

            return {
              url: [
                {
                  loc: [
                    {
                      "#text": new URL(pathWithoutExt, DocRoot).toString(),
                    },
                  ],
                },
                { "meta:routable": [] },
                { lastmod: [{ "#text": content.modifiedTime?.toISOString() }] },
                { "meta:suffix": [{ "#text": ext }] },
              ],
            };
          },
        ),
      },
    ]),
  ),
);
