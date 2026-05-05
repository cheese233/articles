const namespaceUri = "https://codeberg.org/cheese233/articles";

globalThis._I = new Proxy(
  {
    sidebar: true,
    sidebar_header: true,
    prestyle: true,
    sidebar_loc: true,
  },
  {
    set(target, prop, value) {
      if (target[prop] == value) return true;

      switch (prop) {
        case "sidebar": {
          const sidebar = document.querySelector(".sidebar");
          if (sidebar) sidebar.style.display = value ? "" : "none";
          break;
        }
        case "sidebar_header": {
          const header = document.querySelector(".sidebar header");
          if (header) header.style.display = value ? "flex" : "none";
          break;
        }
      }
      target[prop] = value;
      return true;
    },
  },
);

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
 * @returns {{url: URL; suffix: string; includes: {include: string[]; exclude: string[]}}}
 */
const route = (url) => {
  const routedUrl = new URL(url.href);
  if (routedUrl.pathname.endsWith("/")) routedUrl.pathname += "main";

  return (
    [...SiteMap.querySelectorAll("url")]
      .filter((e) => e.getElementsByTagNameNS(namespaceUri, "routable").length)
      .reduce((prev, e) => {
        if (prev) return prev;
        const parsedUrl = new URL(e.getElementsByTagName("loc")[0].textContent);
        if (
          parsedUrl.origin == routedUrl.origin &&
          parsedUrl.pathname == routedUrl.pathname
        )
          return {
            url: parsedUrl,
            suffix: e.getElementsByTagNameNS(namespaceUri, "suffix")[0]
              ?.textContent,
            includes: JSON.parse(
              e.getElementsByTagNameNS(namespaceUri, "includes")[0]
                ?.textContent ?? '{"include": [], "exclude": []}',
            ),
          };
        return null;
      }, null) ??
    (() => {
      throw new RouteNotFoundError(routedUrl.pathname);
    })()
  );
};

async function loadMetaData(url) {
  const atom = new DOMParser().parseFromString(
    // TODO: cache
    await (await fetch("/atom.xml")).text(),
    "text/xml",
  );
  const parent = atom.querySelector(`entry:has(link[href="${url}"])`);
  return {
    title: parent.querySelector("title")?.textContent,
    summary: parent.querySelector("summary")?.textContent,
  };
}

/**
 * @param {URL} url
 * @param {string} suffix
 */
async function render(url, suffix) {
  await customElemBuilder.build(suffix);
  const article = document.createElement(`${suffix.slice(1)}-loader`);
  const loaded = new Promise((resolve) =>
    article.addEventListener("update", resolve, { once: true }),
  );
  article.setAttribute("src", url.toString() + suffix);
  article.style.display = "none";
  main.appendChild(article);
  await loaded;
  main.replaceChildren(article);
  article.style.display = "";
}

try {
  const { url, suffix, includes } = route(location);

  includes.exclude.forEach((e) => (_I[e] = false));
  includes.include.forEach((e) => (_I[e] = true));

  await render(url, suffix);
  const { title } = await loadMetaData(url);
  document.title = title;
} catch (e) {
  if (e instanceof RouteNotFoundError) {
    if (_I.sidebar_loc) document.querySelector("#header-loc").innerHTML = ";(";
    await render(new URL("/render/404", location), ".html");
  } else throw e;
}
