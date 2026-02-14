import { Marked, shake } from "../../render/markdown.js";
const marked: import("npm:marked").Marked = await Marked();

import { marked as markedPlaintify, Token } from "npm:marked@17";

import matter from "npm:gray-matter@4";

markedPlaintify.use(
  (await import("npm:marked-plaintify@1")).default(),
);

const parse = (text: string) => {
  const meta = matter(text).data;

  text = shake(text);

  const tokens = marked.Lexer.lex(text);

  const { titles, body } = tokens.reduce((acc, t) => {
    if (t.type == "heading" && t.depth == 1) {
      acc.titles.push(markedPlaintify.Parser.parseInline(t.tokens ?? []));
    } else acc.body.push(t);
    return acc;
  }, {
    titles: (meta.title) ? [meta.title] : [],
    body: [] as Token[],
  });

  if (titles.length > 1) {
    console.warn("multiple title detected:", titles.join(", "));
  }

  return {
    meta: { ...meta, title: (titles[0] as string | undefined) },
    summary: markedPlaintify.Parser.parse(body).substring(0, 100),
  };
};

export default parse;
