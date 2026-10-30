import { parseFragment, serializeOuter } from "parse5";

/** @typedef {import("vfile").VFile} VFile */
/** @typedef {import("../shared/types.ts").AdapterStatics} AdapterStatics */
/** @typedef {import("../shared/types.ts").ParsedMeta} ParsedMeta */
/**
 * @typedef {{
 *   nodeName: string;
 *   tagName?: string;
 *   value?: string;
 *   attrs?: { name: string; value: string }[];
 *   childNodes?: HtmlNode[];
 * }} HtmlNode
 */

/** @type {AdapterStatics} */
export const meta = Object.freeze({
  ext: "html",
  lang: "pages.js",
  priority: 30,
});

/**
 * @param {HtmlNode} node
 * @param {(node: HtmlNode) => void} visit
 */
const walk = (node, visit) => {
  visit(node);
  for (const child of node.childNodes ?? []) walk(child, visit);
};

const attribute = (/** @type {HtmlNode} */ node, /** @type {string} */ name) =>
  node.attrs?.find((item) => item.name == name)?.value;

/** @param {HtmlNode} node @returns {string} */
const textOf = (/** @type {HtmlNode} */ node) => {
  if (node.nodeName == "#text") return node.value ?? "";
  return (node.childNodes ?? []).map(textOf).join("");
};

const findElement = (/** @type {HtmlNode} */ root, /** @type {string} */ tag) => {
  /** @type {HtmlNode | undefined} */
  let found;
  walk(root, (node) => {
    if (!found && node.tagName?.toLowerCase() == tag) found = node;
  });
  return found;
};

const metaTags = (/** @type {HtmlNode} */ root) => {
  /** @type {Map<string, string>} */
  const tags = new Map();

  walk(root, (node) => {
    if (node.tagName?.toLowerCase() != "meta") return;
    const name = attribute(node, "name") ?? attribute(node, "property");
    const content = attribute(node, "content");
    if (name && content != null) tags.set(name.toLowerCase(), content);
  });

  return tags;
};

const bodyOf = (/** @type {HtmlNode} */ root) => {
  const body = findElement(root, "body");
  const nodes = body?.childNodes ?? root.childNodes ?? [];

  return nodes.map((node) => {
    const serializable =
      /** @type {import("parse5").DefaultTreeAdapterTypes.ParentNode} */ (
        /** @type {unknown} */ (node)
      );
    return serializeOuter(serializable);
  }).join("");
};

const documentOf = (/** @type {string} */ source) =>
  /** @type {HtmlNode} */ (parseFragment(source));

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
    const holder = /** @type {Record<string, ShadowRoot>} */ (
      /** @type {unknown} */ (window)
    );
    holder[key] = target;

    let blobUrl;
    if (!src) {
      const wrapped =
        `const getShadow = () => window[${JSON.stringify(key)}];\n${code}`;
      blobUrl = URL.createObjectURL(
        new Blob([wrapped], { type: "text/javascript" }),
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
    }
  }
};

/** @param {VFile} file @returns {Promise<ParsedMeta>} */
export const parse = async (file) => {
  const source = String(file);
  const document = documentOf(source);
  const tags = metaTags(document);
  const title = findElement(document, "title");

  return {
    title: tags.get("title") ?? tags.get("og:title") ??
      (title ? textOf(title).trim() : undefined),
    author: tags.get("author") ?? tags.get("article:author"),
    date: tags.get("date"),
    tags: tags.get("tags")?.split(",").map((tag) => tag.trim()),
    routable: tags.get("routable") != "false",
    summary: tags.get("description") ?? tags.get("og:description"),
  };
};

const mount = (/** @type {string} */ source) =>
  async (/** @type {ShadowRoot} */ shadow) => {
    const body = bodyOf(documentOf(source));
    const article = document.createElement("article");
    article.className = "html-page markdown";
    article.innerHTML = body;
    article.querySelectorAll("meta").forEach((tag) => tag.remove());

    shadow.append(article);
    await execute(shadow, article);
  };

/**
 * @param {VFile} file
 */
const factory = (file) => mount(String(file));

factory.meta = meta;

export default factory;

/**
 * HTML schema adapter: the body is already fetched by the runtime.
 * @param {{ meta: import("../shared/types.ts").AdapterInfo, body: string }} child
 */
export const compile = (child) => ({
  meta: child.meta,
  handler: () => mount(child.body),
});
