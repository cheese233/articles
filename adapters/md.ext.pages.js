import { parse as parseYaml } from "yaml";
import WebElements from "./pages.js.ext.js";

/** @typedef {import("vfile").VFile} VFile */
/** @typedef {import("../shared/types.ts").ParsedMeta} ParsedMeta */

/** @type {import("../shared/types.ts").AdapterStatics} */
const meta = Object.freeze({
  ext: "md",
  lang: "pages.js",
  priority: 20,
});

/**
 * @param {unknown} value
 */
const asText = (value) => {
  if (value instanceof Date) return value.toISOString();
  return String(value).trim();
};

/**
 * @param {unknown} tags
 */
const normalizeTags = (tags) => {
  if (tags == null) return undefined;
  if (Array.isArray(tags)) return tags.map((tag) => asText(tag));
  return asText(tags)
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
};

/**
 * @param {string} source
 */
const splitFrontmatter = (source) => {
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

/**
 * @param {string} text
 */
const stripMarkdown = (text) =>
  text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/[#>*_`~-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * @param {string} body
 */
const summaryOf = (body) => {
  const marker = body.indexOf("<!-- more -->");
  const text = marker >= 0 ? body.slice(0, marker) : body;
  return stripMarkdown(text).slice(0, 280);
};

export default class MarkdownAdapter extends WebElements {
  static meta = meta;

  /** @returns {Promise<ParsedMeta>} */
  async parse() {
    const source = String(this.file);
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
      summary: data.summary != null
        ? asText(data.summary)
        : summaryOf(body),
    };
  }

  /**
   * Mounting the Web Component is the render: there is no separate
   * module/render phase.
   */
  async connectedCallback() {
    if (this.connected) return;
    this.connected = true;

    try {
      const { renderMarkdown } = await import("../render/markdown_deps.ts");
      this.classList.add("markdown");
      this.innerHTML = renderMarkdown(String(this.file));
      this.dispatchEvent(new Event("rendered"));
    } catch (error) {
      console.error(error);
      this.dispatchEvent(new Event("error"));
    }
  }
}
