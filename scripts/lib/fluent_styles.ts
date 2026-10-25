import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import * as path from "node:path";
import type { Plugin } from "rolldown";

const require = createRequire(import.meta.url);
const root = path.dirname(require.resolve("fluentui-webcomponents/package.json"));
const componentPath = `${path.sep}node_modules${path.sep}fluentui-webcomponents${path.sep}components${path.sep}`;

/**
 * Fluent components build their stylesheet URL from `import.meta.url`.
 * Inline the CSS as a data URL so the components can be bundled directly
 * with the rest of the vendor graph, without a separate asset tree.
 */
export const inlineFluentStyles = (): Plugin => ({
  name: "inline-fluent-styles",

  async transform(code, id) {
    if (!id.includes(componentPath)) return null;

    const match = /const stylesUrl = new URL\('([^']+\.css)', import\.meta\.url\)\.href;/
      .exec(code);
    if (!match) return null;

    const cssFile = path.join(path.dirname(id), match[1] ?? "");
    const tokens = await readFile(path.join(root, "tokens.css"), "utf8");
    const css = (await readFile(cssFile, "utf8")).replace(
      /@import\s+url\((['"])\.\.\/\.\.\/tokens\.css\1\);\s*/g,
      `${tokens}\n`,
    );
    const data = `data:text/css;charset=utf-8,${encodeURIComponent(css)}`;

    return {
      code: code.replace(match[0], `const stylesUrl = ${JSON.stringify(data)};`),
      map: null,
    };
  },
});
