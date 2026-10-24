/**
 * @param {string} value
 */
const unquote = (value) =>
  value.trim().replace(/^["'](.*)["']$/, "$1").trim();

/**
 * @typedef {{
 *   title?: string;
 *   author?: string;
 *   date?: string;
 *   updated?: string;
 *   tags?: string[];
 *   summary?: string;
 *   routable?: boolean;
 * }} JsDocMeta
 */

/**
 * @param {string} source
 * @returns {JsDocMeta}
 */
export const parseJsDoc = (source) => {
  const blocks = [...source.matchAll(/\/\*\*([\s\S]*?)\*\//g)];
  if (!blocks.length) return {};

  // Prefer the block immediately before `export default`, then the block
  // that opted into routing, then the first block.
  const exportAt = source.indexOf("export default");
  const before = exportAt >= 0
    ? blocks.filter((match) => (match.index ?? 0) < exportAt).at(-1)
    : undefined;
  const block = before?.[1] ??
    blocks.find((match) => (match[1] ?? "").includes("@routable"))?.[1] ??
    blocks[0][1] ??
    "";

  const lines = block
    .split("\n")
    .map((line) => line.replace(/^\s*\*\s?/, "").trim())
    .filter(Boolean);

  /** @type {JsDocMeta} */
  const parsed = {};
  const heading = lines.find((line) => line.startsWith("# "));
  if (heading) parsed.title = heading.slice(2).trim();

  for (const line of lines) {
    const match = /^@([a-z_]+)\s*(.*)$/i.exec(line);
    if (!match) continue;

    const name = match[1] ?? "";
    const value = match[2] ?? "";

    switch (name) {
      case "routable":
        parsed.routable = true;
        break;
      case "title":
        parsed.title = unquote(value);
        break;
      case "author":
        parsed.author = unquote(value);
        break;
      case "date":
        parsed.date = unquote(value);
        break;
      case "updated":
        parsed.updated = unquote(value);
        break;
      case "summary":
        parsed.summary = unquote(value);
        break;
      case "tags": {
        const tags = value.trim();
        if (tags.startsWith("[")) {
          const list = JSON.parse(tags);
          if (Array.isArray(list)) parsed.tags = list.map(String);
        } else if (tags) {
          parsed.tags = tags.split(",").map((tag) => tag.trim());
        }
        break;
      }
    }
  }

  return parsed;
};
