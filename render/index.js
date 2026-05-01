import * as kaomoji from "./kaomoji.js";

const namespaceUri = "https://codeberg.org/cheese233/articles";

const requireOnce = (fn) => {
  let state = null;

  return (...args) => {
    if (!state) {
      state = (async () => {
        try {
          return await fn(...args);
        } catch (error) {
          state = null;
          throw error;
        }
      })();
    }
    return state;
  };
};

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
  switch (suffix) {
    case ".html":
      main.innerHTML = await (await fetch(url.toString() + ".html")).text();
      break;
    case ".md": {
      await requireOnce(async () => {
        customElements.define(
          "zero-md",
          await (await import("./markdown.js")).ZeroMd(),
        );
      })();

      const article = document.createElement("zero-md");
      article.setAttribute("src", url.toString() + ".md");

      article.style.display = "none";
      main.appendChild(article);
      await new Promise((resolve) =>
        article.addEventListener("zero-md-rendered", resolve, { once: true }),
      );
      main.replaceChildren(article);
      article.style.display = "";

      break;
    }
    case ".js": {
      await import(url.pathname + ".js").then((i) => i.default(main));
      break;
    }
    default:
      throw new RouteNotFoundError(url.pathname + suffix);
  }
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
