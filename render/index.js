import * as kaomoji from "./kaomoji.js";

const cdn = (path) => "https://esm.sh/" + path;

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
  const { url, suffix } = route(location);
  switch (suffix) {
    case "html":
      main.innerHTML = await (await fetch(url.pathname + ".html")).text();
      break;
    case "md":
      document.querySelector("#header-loc").innerHTML = "blog";
      await requireOnce(async () => {
        const { default: ZeroMd, STYLES } = await import(
          cdn("gh/cheese233/zero-md@b69b20d/src/lib/index.js")
        );
        customElements.define(
          "zero-md",
          class extends ZeroMd {
            async load() {
              const load = async (
                /** @type {string} */ url,
                name = "default",
              ) => (await import(url))[name];
              await super.load({
                marked: async () => {
                  const Marked = await load(cdn("marked@15"), "Marked");
                  return new Marked({ async: true });
                },
                markedBaseUrl: () => load(cdn("marked-base-url@1"), "baseUrl"),
                markedHighlight: () =>
                  load(cdn("marked-highlight@2"), "markedHighlight"),
                markedGfmHeadingId: () =>
                  load(cdn("marked-gfm-heading-id@4"), "gfmHeadingId"),
                markedAlert: () => load(cdn("marked-alert@2")),
                hljs: () =>
                  load(cdn("@highlightjs/cdn-assets@11/highlight.js")),
                mermaid: () => load(cdn("mermaid@11")),
                katex: () => load(cdn("katex@0")),
              });
              this.template = {
                ...STYLES,
                // TODO: replace all cdns with `cdn`
                MARKDOWN: `<style>${await (await fetch("/render/fluent-ui-md.css")).text()}</style>`,
              }.preset();
              this.setAttribute("no-shadow", "");
              this.marked.use(
                (await import("./fluentify-marked.js")).default(this.marked),
                (await import(cdn("marked-footnote"))).default(),
              );
            }
          },
        );
      })();

      let article = document.createElement("zero-md");
      article.setAttribute("src", url + ".md");
      main.replaceChildren(article);
      break;
  }
} catch (e) {
  if (e instanceof RouteNotFoundError) {
    document.querySelector("#header-loc").innerHTML = ";(";
    main.innerHTML = await (await fetch("/render/404.html")).text();
  } else throw e;
}
