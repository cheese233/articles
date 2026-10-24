/** @typedef {import("vfile").VFile} VFile */
/** @typedef {import("../shared/types.ts").ParsedMeta} ParsedMeta */

/** @type {import("../shared/types.ts").AdapterStatics} */
const meta = Object.freeze({
  ext: "js",
  lang: "js",
  priority: 40,
});

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

export default class JavaScriptAdapter {
  static meta = meta;

  /** @type {VFile} */
  file;

  /** @param {VFile} file */
  constructor(file) {
    this.file = file;
  }

  /** @returns {Promise<ParsedMeta>} */
  async parse() {
    return parseJsDoc(String(this.file));
  }

  /** @returns {Promise<{ default: unknown }>} */
  async module() {
    const path = this.file.path;
    if (!path) throw new Error("vfile has no path");
    return await import(path);
  }

  /** @param {import("../shared/types.ts").AdapterContext} ctx */
  async render(ctx) {
    const mod = await this.module();
    if (typeof mod.default != "function")
      throw new Error(`${this.file.path}: default export is not a function`);
    await mod.default(ctx.target);
  }
}

