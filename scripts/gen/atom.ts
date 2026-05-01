#!/usr/bin/env deno

import { parseArgs } from "jsr:@std/cli@1/parse-args";
import { XMLBuilder } from "npm:fast-xml-parser@5";
import { walk, read } from "../utils/fs.ts";
import parse from "../parse/parse.ts";

let {
  _: [dir],
  root: DocRoot,
  title,
} = parseArgs(Deno.args, {
  string: ["root", "_", "title"],
});
if (!dir) dir = ".";
if (!(await Deno.stat(dir)).isDirectory) throw new Error();

const info = [
  { title: [{ "#text": title ?? "" }] },
  {
    id: [{ "#text": DocRoot }],
  },
];

const builder = new XMLBuilder({
  ignoreAttributes: false,
  suppressEmptyNode: true,
  preserveOrder: true,
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
          "@_xmlns": "http://www.w3.org/2005/Atom",
        },
        feed: [
          ...info,
          { updated: [{ "#text": new Date().toISOString() }] },
          ...(await Array.fromAsync(
            walk(dir),
            async ({ ext, pathWithoutExt, path }) => {
              const content = await read(path),
                url = new URL(pathWithoutExt, DocRoot).toString();

              if (!content) return {};

              const meta = await parse(content.content, ext);

              return {
                entry: [
                  {
                    title: [
                      {
                        "#text": meta?.meta.title ?? pathWithoutExt,
                      },
                    ],
                  },
                  { id: [{ "#text": url }] },
                  { ":@": { "@_href": url }, link: [] },
                  {
                    ":@": {
                      "@_href": new URL(pathWithoutExt, DocRoot).toString(),
                      "@_rel": "via",
                    },
                    link: [],
                  },
                  {
                    updated: [{ "#text": content.modifiedTime?.toISOString() }],
                  },
                  { author: [{ name: [{ "#text": meta?.meta.author }] }] },
                  { summary: [{ "#text": meta?.summary }] },
                ],
              };
            },
          )),
        ],
      },
    ]),
  ),
);
