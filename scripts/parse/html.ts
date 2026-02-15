import { DOMParser } from "jsr:@b-fuze/deno-dom@0";

const parse = (text: string) => {
  const tokens = new DOMParser().parseFromString(text, "text/html");

  const title = tokens.querySelector('meta[property="og:title"]')
    ?.getAttribute("content") ||
    tokens.querySelector("title")?.textContent;

  const summary = (tokens.querySelector('meta[property="og:description"]') ??
    tokens.querySelector('meta[name="description"]'))
    ?.getAttribute("content") ?? "";

  const author = (tokens.querySelector('meta[name="author"]') ??
    tokens.querySelector('meta[property="article:author"]'))
    ?.getAttribute("content") ?? undefined;

  return { meta: { title, author }, summary };
};

export default parse;
