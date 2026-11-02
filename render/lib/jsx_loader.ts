import { compileJsx } from "../../shared/jsx.js";

/**
 * In-page JSX module loader. A `.jsx` file is fetched as text, compiled with
 * sucrase and imported from a blob URL, so it needs no Service Worker.
 *
 * Blob URLs cannot resolve path specifiers (their path is opaque), so every
 * `/`, `./` and `../` import is rewritten to an absolute URL first; `.jsx`
 * dependencies go through this loader recursively. Bare specifiers stay as
 * they are and resolve through the page's import map.
 */

/** Absolute source URL -> blob URL of its compiled module. */
const modules = new Map<string, Promise<string>>();

const isPath = (specifier: string) => /^\.{0,2}\//.test(specifier);

const contentType = (response: Response) =>
  (response.headers.get("content-type") ?? "").split(";")[0]?.trim() ?? "";

interface Sucrase {
  transform: Parameters<typeof compileJsx>[0];
  // Only the test stub exports it, to run the transform ahead of time.
  prepare?: (source: string, options: unknown) => Promise<void>;
}

const tools = async () => {
  const [sucrase, lexer] = await Promise.all([
    import("sucrase") as Promise<Sucrase>,
    import("es-module-lexer"),
  ]);
  await lexer.init;
  return { sucrase, parse: lexer.parse };
};

const compile = async (sucrase: Sucrase, source: string) => {
  if (sucrase.prepare) {
    // Capture the options compileJsx passes, then run them for real.
    let options: unknown;
    compileJsx((_, given) => {
      options = given;
      return { code: "" };
    }, source);
    await sucrase.prepare(source, options);
  }
  return compileJsx(sucrase.transform, source);
};

const fetchText = async (href: string) => {
  const response = await fetch(href, { cache: "no-cache" });
  // Cloudflare Pages answers missing files with the SPA shell.
  if (!response.ok || contentType(response) == "text/html")
    throw new Error(`jsx module not found: ${href}`);
  return await response.text();
};

const build = async (
  href: string,
  chain: string[],
  source?: string,
): Promise<string> => {
  const { sucrase, parse } = await tools();
  const code = await compile(sucrase, source ?? await fetchText(href));
  const [imports] = parse(code);

  let output = "";
  let last = 0;

  for (const item of imports) {
    const specifier = item.specifier;
    if (!specifier || !isPath(specifier)) continue;

    const target = new URL(specifier, href).href;
    const url = target.endsWith(".jsx")
      ? await jsxModuleUrl(target, chain)
      : target;

    // Static ranges cover the bare string, dynamic ones include quotes.
    const replacement = item.type == "dynamic" ? JSON.stringify(url) : url;
    output += code.slice(last, item.start) + replacement;
    last = item.end;
  }

  output += `${code.slice(last)}\n//# sourceURL=${href}\n`;
  return URL.createObjectURL(new Blob([output], { type: "text/javascript" }));
};

/**
 * Blob URL of the compiled module; each source is compiled once.
 * @param chain import path that led here, used to report cycles
 * @param source already fetched text, to skip a second request
 */
export const jsxModuleUrl = (
  url: string,
  chain: string[] = [],
  source?: string,
) => {
  const href = new URL(url, location.href).href;
  if (chain.includes(href)) {
    throw new Error(`jsx import cycle: ${[...chain, href].join(" -> ")}`);
  }

  let pending = modules.get(href);
  if (!pending) {
    pending = build(href, [...chain, href], source);
    modules.set(href, pending);
    // A failed compile must not poison later attempts.
    pending.catch(() => modules.delete(href));
  }
  return pending;
};

export const importJsx = async (url: string, source?: string) =>
  await import(await jsxModuleUrl(url, [], source));
