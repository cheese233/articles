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
        suffix: e.getElementsByTagName("meta:suffix")[0]?.textContent,
        entrypoint: e.getElementsByTagName("meta:entrypoint")[0]?.textContent,
      };
    })
    .filter((e) => e.url.origin == url.origin);
  for (const e of routes) if (e.url.pathname == url.pathname) return e;
  throw new RouteNotFoundError(url.pathname);
}

/**
 * @param {URL} url
 * @param {string} suffix
 * @param {string} [entrypoint]
 */
async function render(url, suffix, entrypoint) {
  switch (suffix) {
    case "html":
      main.innerHTML = await (await fetch(url.toString() + ".html")).text();
      break;
    case "md": {
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
        article.addEventListener("zero-md-rendered", resolve, { once: true })
      );
      main.replaceChildren(article);
      article.style.display = "";

      break;
    }
    case "js": {
      await (await import(url.pathname + ".js"))[entrypoint](main);
      break;
    }
    default:
      throw new RouteNotFoundError(url.pathname + "." + suffix);
  }
}

try {
  const { url, suffix, entrypoint } = route(
    (location.pathname == "/") ? new URL("/main", location) : location,
  );

  if (suffix == "md") document.querySelector("#header-loc").innerHTML = "blog";
  render(url, suffix, entrypoint);
} catch (e) {
  if (e instanceof RouteNotFoundError) {
    document.querySelector("#header-loc").innerHTML = ";(";
    render(new URL("/render/404", location), "html");
  } else throw e;
}
