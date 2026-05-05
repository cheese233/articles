#!/usr/bin/env deno

import { parseArgs } from "jsr:@std/cli@1/parse-args";
import XMLBuilder from "npm:fast-xml-builder@1";
import { walk } from "../utils/fs.ts";
import parse from "../parse/parse.ts";
import { getBackend, getWriter } from "../utils/common.ts";

let {
  _: [dir],
  root: DocRoot,
  backend,
  output,
} = parseArgs(Deno.args, {
  string: ["root", "_", "backend", "output"],
  alias: {
    output: "o",
  },
});

if (!dir) dir = ".";
if (!(await Deno.stat(dir)).isDirectory) throw new Error();
if (!DocRoot) throw new Error();

const read = await getBackend(backend).then((i) => i.read);

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
          "@_xmlns": "http://www.sitemaps.org/schemas/sitemap/0.9",
          "@_xmlns:meta": "https://codeberg.org/cheese233/articles",
        },
        urlset: await Array.fromAsync(
          walk(dir),
          async ({ path, pathWithoutExt, ext }) => {
            const content = await read(path, dir),
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
                meta.meta.include || meta.meta.exclude
                  ? {
                      "meta:includes": toCDATA(
                        JSON.stringify({
                          include: meta?.meta.include ?? [],
                          exclude: meta?.meta.exclude ?? [],
                        }),
                      ),
                    }
                  : {},
              ],
            };
          },
        ),
      },
    ]),
  ),
);

await writer.close();
