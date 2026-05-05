#!/usr/bin/env deno

import { parseArgs } from "jsr:@std/cli@1/parse-args";
import XMLBuilder from "npm:fast-xml-builder@1";
import { walk } from "../utils/fs.ts";
import parse from "../parse/parse.ts";
import { getBackend, getWriter } from "../utils/common.ts";

let {
  _: [dir],
  root: DocRoot,
  title,
  backend,
  output,
} = parseArgs(Deno.args, {
  string: ["root", "_", "title", "backend", "output"],
  alias: {
    output: "o",
  },
});
if (!dir) dir = ".";
if (!(await Deno.stat(dir)).isDirectory) throw new Error();
if (!DocRoot) throw new Error();

const read = await getBackend(backend).then((i) => i.read);

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
  cdataPropName: ":CDATA",
});

const toCDATA = (content: string) => [{ ":CDATA": [{ "#text": content }] }];

const writer = await getWriter(output);

await writer.write(
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
              const content = await read(path, dir),
                url = new URL(pathWithoutExt, DocRoot).toString();

              const meta = await parse(content.content, ext);

              if (!meta) return {};

              return {
                entry: [
                  {
                    title: [{ "#text": meta.meta.title ?? pathWithoutExt }],
                  },
                  { id: [{ "#text": url }] },
                  { ":@": { "@_href": url }, link: [] },
                  {
                    ":@": {
                      "@_href": new URL(path, DocRoot).toString(),
                      "@_rel": "via",
                    },
                    link: [],
                  },
                  {
                    updated: [{ "#text": content.modifiedTime?.toISOString() }],
                  },
                  { author: [{ name: [{ "#text": meta.meta.author }] }] },
                  { summary: toCDATA(meta.summary || "") },
                ],
              };
            },
          )),
        ],
      },
    ]),
  ),
);

await writer.close();
