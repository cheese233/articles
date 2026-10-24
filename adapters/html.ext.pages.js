import PagesAdapter from "./pages.js.ext.js";

/** @typedef {import("vfile").VFile} VFile */
/** @typedef {import("../shared/types.ts").ParsedMeta} ParsedMeta */

/** @type {import("../shared/types.ts").AdapterStatics} */
const meta = Object.freeze({
  ext: "html",
  lang: "pages.js",
  priority: 30,
});

const entities = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  "#39": "'",
  nbsp: " ",
};

/**
 * @param {string} value
 */
const decode = (value) =>
  value.replace(/&(#?\w+);/g, (entity, name) => {
    const key = /** @type {keyof typeof entities} */ (name);
    return entities[key] ?? entity;
  });

/**
 * @param {string} source
 */
const metaTags = (source) => {
  /** @type {Map<string, string>} */
  const tags = new Map();

  for (const match of source.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = match[0];
    const name = /\bname=["']([^"']+)["']/i.exec(tag)?.[1] ??
      /\bproperty=["']([^"']+)["']/i.exec(tag)?.[1];
    const content = /\bcontent=["']([^"']*)["']/i.exec(tag)?.[1];
    if (name && content != null) tags.set(name.toLowerCase(), decode(content));
  }

  return tags;
};

/**
 * @param {string} source
 */
const titleOf = (source) => {
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(source)?.[1];
  return title ? decode(title.trim()) : undefined;
};

/**
 * @param {ShadowRoot | HTMLElement} target
 * @param {HTMLElement} content
 */
const execute = async (target, content) => {
  const scripts = [...content.querySelectorAll("script")];

  for (const script of scripts) {
    const type = (script.getAttribute("type") ?? "").trim().toLowerCase();
    const src = script.getAttribute("src");
    const code = script.textContent ?? "";

    if (type && type != "module" && type != "text/javascript" &&
      type != "application/javascript") {
      script.remove();
      continue;
    }

    if (type != "module") {
      const element = document.createElement("script");
      if (src) element.src = src;
      else element.textContent = code;
      content.append(element);
      continue;
    }

    const url = src
      ? src
      : URL.createObjectURL(
        new Blob([code], { type: "text/javascript" }),
      );
    try {
      const mod = await import(url);
      if (typeof mod.default == "function") await mod.default(target);
    } finally {
      if (!src) URL.revokeObjectURL(url);
      script.remove();
    }
  }
};

export default class HtmlAdapter extends PagesAdapter {
  static meta = meta;

  /** @returns {Promise<ParsedMeta>} */
  async parse() {
    const source = String(this.file);
    const tags = metaTags(source);

    return {
      title: tags.get("title") ?? tags.get("og:title") ?? titleOf(source),
      author: tags.get("author") ?? tags.get("article:author"),
      date: tags.get("date"),
      tags: tags.get("tags")?.split(",").map((tag) => tag.trim()),
      routable: tags.get("routable") != "false",
      summary: tags.get("description") ?? tags.get("og:description"),
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
      const source = String(this.file);
      const body = /<body[^>]*>([\s\S]*?)<\/body>/i.exec(source)?.[1] ?? source;

      this.classList.add("html-page", "markdown");
      this.innerHTML = body;
      this.querySelectorAll("meta").forEach((tag) => tag.remove());

      const root = this.getRootNode();
      await execute(root instanceof ShadowRoot ? root : this, this);
      this.dispatchEvent(new Event("rendered"));
    } catch (error) {
      console.error(error);
      this.dispatchEvent(new Event("error"));
    }
  }
}
