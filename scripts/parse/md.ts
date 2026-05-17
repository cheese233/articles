import {
  remarkFrontmatter,
  remarkGfm,
  remarkMath,
  remarkParse,
  unified,
} from "../../render/markdown_deps.js";
import type { ParseResult } from "./parse.ts";

import remarkStringify from "https://cdn.c23.me/remark-stringify@11?module";
import type { Heading, Root } from "npm:@types/mdast@4";
import { toText } from "npm:hast-util-to-text@4";
import { commentMarker } from "npm:mdast-comment-marker@3";
import { fromMarkdown } from "npm:mdast-util-from-markdown@2";
import { toHast } from "npm:mdast-util-to-hast@13";
import { find } from "npm:unist-util-find@3";
import { remove } from "npm:unist-util-remove@4";
import { EXIT, visit } from "npm:unist-util-visit@5";
import { matter } from "npm:vfile-matter@5";

export default async function (content: string) {
  const processor = unified()
    .use(
      remarkParse as unknown as (typeof import("https://esm.sh/remark-parse@11"))["default"],
    )
    .use(remarkFrontmatter)
    .use(remarkMath)
    .use(remarkGfm)
    .use(() => (tree: Root, file) => {
      const h1: Heading | undefined = find(
        tree,
        (e) => e.type == "heading" && (e as Heading).depth == 1,
      );
      if (h1) ((file.data.title = toText(toHast(h1))), remove(tree, h1));
    })
    .use(() => (tree: Root, file) => {
      visit(
        tree,
        (node, _, parent) => {
          const info = commentMarker(node);
          return info && info.name == "more" && parent?.type == "root";
        },
        (_, index) => {
          file.data.summary = toText(
            toHast({ type: "root", children: tree.children.slice(0, index) }),
          );
          return EXIT;
        },
      );
    })
    .use(() => (_, file) => {
      matter(file);
    })
    .use(
      remarkStringify as unknown as (typeof import("https://esm.sh/remark-stringify@11"))["default"],
    );

  const file = await processor.process(content);

  const meta = (file.data.matter as ParseResult["meta"] | undefined) || {};

  if (!meta.title) meta.title = file.data.title as string;

  if (meta.exclude) meta.exclude = meta.exclude.map((e) => String(e));
  if (meta.include) meta.include = meta.include.map((e) => String(e));

  return {
    meta,
    summary:
      (file.data.summary as string | undefined) ||
      toText(toHast(fromMarkdown(file.toString().slice(0, 300)))),
  };
}
