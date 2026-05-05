import parseMd from "./md.ts";
import { Project, SyntaxKind, Node } from "jsr:@ts-morph/ts-morph@28";
import type { JSDocTag } from "jsr:@ts-morph/ts-morph@28";
const project = new Project();

const parse = async (content: string) => {
  const data = project.createSourceFile(".ts", content, { overwrite: true });

  const routable = data
    .getDescendantsOfKind(SyntaxKind.JSDocTag)
    .filter((tag) => tag.getTagName() == "routable");

  for (const jsdoc of routable
    .map((tag) => tag.getParent())
    .filter((e) => !!e)) {
    if (!jsdoc.isKind(SyntaxKind.JSDoc)) continue;

    const func = jsdoc.getParent();

    const isExported =
      (Node.isExportable(func) && func.isExported()) ||
      (Node.isModifierable(func) && func.hasModifier(SyntaxKind.ExportKeyword));
    if (!isExported) console.warn(`@routable function may not be exported`);

    const {
      meta: { title, author, include, exclude },
      summary,
    } = await parseMd(jsdoc.getDescription() ?? "");

    const parseIncludes = (name: string) => {
      const str = jsdoc
        .getFirstChild(
          (tag): tag is JSDocTag =>
            tag.isKind(SyntaxKind.JSDocTag) && tag.getTagName() == name,
        )
        ?.getCommentText();
      if (str) return JSON.parse(str);
    };

    return {
      meta: {
        title,
        author:
          jsdoc
            .getFirstChildByKind(SyntaxKind.JSDocAuthorTag)
            ?.getCommentText() || author,
        include: parseIncludes("include") || include,
        exclude: parseIncludes("exclude") || exclude,
      },
      summary,
    };
  }

  return null;
};

export default parse;
