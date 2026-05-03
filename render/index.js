const namespaceUri = "https://codeberg.org/cheese233/articles";

const SiteMap = new DOMParser().parseFromString(
  await (await fetch("/sitemap.xml")).text(),
  "text/xml",
);

class RouteNotFoundError extends Error {
  constructor(path) {
    super(`path not found: ${path}`);
    this.name = "RouteNotFoundError";
  }
}

const customElemBuilder = new (class {
  executed = new Set();

  /**
   * @param {string} ext
   */
  async build(ext) {
    if (this.executed.has(ext)) return;
    customElements.define(
      `${ext.slice(1)}-loader`,
      (await import(`./${ext.slice(1)}.js`)).Loader,
    );
    this.executed.add(ext);
  }
})();

/**
 * @param {URL | Location} url
 */
const route = (url) =>
  [...SiteMap.querySelectorAll("url")]
    .filter((e) => e.getElementsByTagNameNS(namespaceUri, "routable").length)
    .reduce((prev, e) => {
      if (prev) return prev;
      const parsedUrl = new URL(e.getElementsByTagName("loc")[0].textContent);
      if (parsedUrl.origin == url.origin && parsedUrl.pathname == url.pathname)
        return {
          url: parsedUrl,
          suffix: e.getElementsByTagNameNS(namespaceUri, "suffix")[0]
            ?.textContent,
        };
      return null;
    }, null) ??
  (() => {
    throw new RouteNotFoundError(url.pathname);
  })();

/**
 * @param {URL} url
 * @param {string} suffix
 */
async function render(url, suffix) {
  await customElemBuilder.build(suffix);
  const article = document.createElement(`${suffix.slice(1)}-loader`);
  article.setAttribute("src", url.toString() + suffix);
  article.style.display = "none";
  main.appendChild(article);
  await new Promise((resolve) =>
    article.addEventListener("update", resolve, { once: true }),
  );
  main.replaceChildren(article);
  article.style.display = "";
}

try {
  const { url, suffix } = route(
    location.pathname == "/" ? new URL("/main", location) : location,
  );

  if (suffix == ".md") document.querySelector("#header-loc").innerHTML = "blog"; // TODO
  await render(url, suffix);
} catch (e) {
  if (e instanceof RouteNotFoundError) {
    document.querySelector("#header-loc").innerHTML = ";(";
    render(new URL("/render/404", location), ".html");
  } else throw e;
}
