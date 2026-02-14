import * as kaomoji from "./kaomoji.js";

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
function route(url) {
  const routes = [...SiteMap.querySelectorAll("url")]
    .filter((e) => e.getElementsByTagName("meta:routable").length)
    .map((e) => {
      return {
        url: new URL(e.getElementsByTagName("loc")[0].textContent),
        suffix: e.getElementsByTagName("meta:suffix")[0]?.textContent ?? "html",
      };
    })
    .filter((e) => e.url.origin == url.origin);
  for (const e of routes) if (e.url.pathname == url.pathname) return e;
  throw new RouteNotFoundError(url.pathname);
}

try {
  const { url, suffix } = route(
    (location.pathname == "/") ? new URL("/main", location.origin) : location,
  );
  switch (suffix) {
    case "html":
      main.innerHTML = await (await fetch(url.pathname + ".html")).text();
      break;
    case "md": {
      document.querySelector("#header-loc").innerHTML = "blog";
      await requireOnce(async () => {
        customElements.define(
          "zero-md",
          await (await import("./markdown.js")).ZeroMd(),
        );
      })();

      const article = document.createElement("zero-md");
      article.setAttribute("src", url + ".md");
      main.replaceChildren(article);
      break;
    }
  }
} catch (e) {
  if (e instanceof RouteNotFoundError) {
    document.querySelector("#header-loc").innerHTML = ";(";
    main.innerHTML = await (await fetch("/render/404.html")).text();
  } else throw e;
}
