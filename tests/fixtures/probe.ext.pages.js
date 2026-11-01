/** @typedef {import("vfile").VFile} VFile */

const probe = /** @type {Record<string, number>} */ (
  /** @type {unknown} */ (window)
);
probe.__probeImports = (probe.__probeImports ?? 0) + 1;

/** @param {VFile} file */
export default (file) => (/** @type {ShadowRoot} */ shadow) => {
  const article = document.createElement("article");
  article.className = "probe";
  article.innerHTML = String(file.value ?? "");
  shadow.append(article);
};