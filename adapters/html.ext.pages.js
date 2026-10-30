/** @typedef {import("vfile").VFile} VFile */
/** @typedef {import("../shared/types.ts").AdapterStatics} AdapterStatics */
/** @typedef {import("../shared/types.ts").ParsedMeta} ParsedMeta */

/** @type {AdapterStatics} */
export const meta = Object.freeze({
  ext: "html",
  lang: "pages.js",
  priority: 30,
  kind: "handler",
});

const entities = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  "#39": "'",
  nbsp: " ",
};

const decode = (/** @type {string} */ value) =>
  value.replace(/&(#?\w+);/g, (entity, name) => {
    const key = /** @type {keyof typeof entities} */ (name);
    return entities[key] ?? entity;
  });

const metaTags = (/** @type {string} */ source) => {
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

const titleOf = (/** @type {string} */ source) => {
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(source)?.[1];
  return title ? decode(title.trim()) : undefined;
};

const execute = async (
  /** @type {ShadowRoot} */ target,
  /** @type {HTMLElement} */ content,
) => {
  const scripts = [...content.querySelectorAll("script[async], script[defer]")];

  for (const script of scripts) {
    const src = script.getAttribute("src");
    const code = script.textContent ?? "";
    script.remove();
    if (!src && !code) continue;

    const key = `$${crypto.randomUUID()}_shadow`;
    const holder = /** @type {Record<string, ShadowRoot> & {
     *   getShadow?: () => ShadowRoot;
     * }} */ (
      /** @type {unknown} */ (window)
    );
    holder[key] = target;
    holder.getShadow = () => target;

    let blobUrl;
    if (!src) {
      blobUrl = URL.createObjectURL(
        new Blob([code], { type: "text/javascript" }),
      );
    }

    try {
      const url = new URL(src ?? blobUrl ?? "", window.location.href);
      url.hash = key;
      await import(url.toString());
    } catch (error) {
      console.error(error);
    } finally {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
      delete holder[key];
      delete holder.getShadow;
    }
  }
};

/** @param {VFile} file @returns {Promise<ParsedMeta>} */
export const parse = async (file) => {
  const source = String(file);
  const tags = metaTags(source);

  return {
    title: tags.get("title") ?? tags.get("og:title") ?? titleOf(source),
    author: tags.get("author") ?? tags.get("article:author"),
    date: tags.get("date"),
    tags: tags.get("tags")?.split(",").map((tag) => tag.trim()),
    routable: tags.get("routable") != "false",
    summary: tags.get("description") ?? tags.get("og:description"),
  };
};

/**
 * @param {VFile} file
 */
const factory = (file) => async (/** @type {ShadowRoot} */ shadow) => {
  const source = String(file);
  const body = /<body[^>]*>([\s\S]*?)<\/body>/i.exec(source)?.[1] ?? source;
  const article = document.createElement("article");
  article.className = "html-page markdown";
  article.innerHTML = body;
  article.querySelectorAll("meta").forEach((tag) => tag.remove());

  shadow.append(article);
  await execute(shadow, article);
};

factory.meta = meta;

export default factory;

/**
 * Compile an HTML schema into a JS loader class.
 *
 * @param {{ meta: import("../shared/types.ts").AdapterStatics, body: string }} child
 */
export const compile = (child) => {
  const mount = async (/** @type {ShadowRoot} */ shadow) => {
    const article = document.createElement("article");
    article.className = "html-page markdown";
    article.innerHTML = child.body;
    article.querySelectorAll("meta").forEach((tag) => tag.remove());

    shadow.append(article);
    await execute(shadow, article);
  };

  const Adapter = class HtmlAdapter extends HTMLElement {
    static meta = child.meta;

    constructor() {
      super();
      this.attachShadow({ mode: "open" });
    }

    async connectedCallback() {
      try {
        const shadow = this.shadowRoot;
        if (!shadow) throw new Error("html loader has no shadow root");
        await mount(shadow);
        this.dispatchEvent(new Event("rendered"));
      } catch (error) {
        console.error(error);
        this.dispatchEvent(new Event("error"));
      }
    }
  };

  Adapter.mount = () => mount;
  return { meta: child.meta, Adapter };
};
