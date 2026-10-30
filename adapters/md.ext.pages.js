import { parse as parseYaml } from "yaml";

/** @typedef {import("vfile").VFile} VFile */
/** @typedef {import("../shared/types.ts").AdapterStatics} AdapterStatics */
/** @typedef {import("../shared/types.ts").ParsedMeta} ParsedMeta */

/** @type {AdapterStatics} */
export const meta = Object.freeze({
  ext: "md",
  lang: "pages.js",
  priority: 20,
});

const asText = (/** @type {unknown} */ value) => {
  if (value instanceof Date) return value.toISOString();
  return String(value).trim();
};

const normalizeTags = (/** @type {unknown} */ tags) => {
  if (tags == null) return undefined;
  if (Array.isArray(tags)) return tags.map((tag) => asText(tag));
  return asText(tags)
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
};

const splitFrontmatter = (/** @type {string} */ source) => {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(source);
  if (!match) {
    return {
      data: /** @type {Record<string, unknown>} */ ({}),
      body: source,
    };
  }

  const data = parseYaml(match[1] ?? "");
  if (data != null && (typeof data != "object" || Array.isArray(data)))
    throw new Error("frontmatter must be a YAML mapping");

  return {
    data: /** @type {Record<string, unknown>} */ (data ?? {}),
    body: source.slice(match[0].length),
  };
};

const stripMarkdown = (/** @type {string} */ text) =>
  text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/[#>*_`~-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const summaryOf = (/** @type {string} */ body) => {
  const marker = body.indexOf("<!-- more -->");
  const text = marker >= 0 ? body.slice(0, marker) : body;
  return stripMarkdown(text).slice(0, 280);
};

/** @param {VFile} file @returns {Promise<ParsedMeta>} */
export const parse = async (file) => {
  const source = String(file);
  const { data, body } = splitFrontmatter(source);
  const heading = /^#\s+(.+)$/m.exec(body)?.[1]?.trim();
  const title = data.title != null ? asText(data.title) : heading;

  return {
    title: title || undefined,
    date: data.date != null ? asText(data.date) : undefined,
    updated: data.updated != null ? asText(data.updated) : undefined,
    author: data.author != null ? asText(data.author) : undefined,
    tags: normalizeTags(data.tags),
    routable: data.routable === false ? false : true,
    summary: data.summary != null ? asText(data.summary) : summaryOf(body),
  };
};

/**
 * @param {VFile} file
 */
const factory = (file) => async (/** @type {ShadowRoot} */ shadow) => {
  const { renderMarkdown } = await import("../render/markdown_deps.ts");
  const article = document.createElement("article");
  article.className = "markdown";
  article.innerHTML = renderMarkdown(String(file));
  shadow.append(article);
};

factory.meta = meta;

export default factory;
