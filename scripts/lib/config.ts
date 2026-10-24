import { readFile } from "node:fs/promises";
import type { SiteConfig } from "../../shared/types.ts";
import { paths } from "./paths.ts";

const file = JSON.parse(
  await readFile(`${paths.root}/site.json`, "utf8"),
) as SiteConfig;

const env = process.env;

const pick = (value: string | undefined, fallback: string) =>
  value?.trim() ? value.trim() : fallback.trim();

const url = pick(env.SITE_URL, file.url).replace(/\/+$/, "");

try {
  new URL(url);
} catch {
  throw new Error(`site.json: invalid url: ${url}`);
}

export const config: SiteConfig = {
  url,
  title: pick(env.SITE_TITLE, file.title),
  author: pick(env.SITE_AUTHOR, file.author),
  description: pick(env.SITE_DESCRIPTION, file.description),
  language: pick(env.SITE_LANGUAGE, file.language),
};
