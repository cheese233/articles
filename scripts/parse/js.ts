import parseMd from "./md.ts";
import { Project, SyntaxKind } from "jsr:@ts-morph/ts-morph@28";
const project = new Project();

const parse = async (content: string) => {
  const data = project.createSourceFile(".ts", content, { overwrite: true });

  const routable = data
    .getDescendantsOfKind(SyntaxKind.JSDocTag)
    .filter((tag) => tag.getTagName() == "routable");

  // TODO: 1. warn if not exported
  // TODO: 2. find only callable
  // TODO: 3. handle class & arrow functions & unnamed function correctly
  for (const jsdoc of routable
    .map((tag) => tag.getParent())
    .filter((e) => !!e)) {
    if (!jsdoc.isKind(SyntaxKind.JSDoc)) continue;

    let {
      meta: { title, author },
      summary,
    } = parseMd(jsdoc.getDescription() ?? "");
    author =
      jsdoc.getFirstChildByKind(SyntaxKind.JSDocAuthorTag)?.getCommentText() ||
      author;

    return {
      meta: { title, author },
      summary,
    };
  }

  return null;
};

export default parse;
