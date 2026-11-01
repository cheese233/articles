import type { EntryMeta, Manifest } from "../../shared/types.ts";

const contentType = (response: Response) =>
  (response.headers.get("content-type") ?? "")
    .split(";")[0]
    .trim()
    .toLowerCase();

const json = async <T>(url: string): Promise<T | null> => {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-cache",
  });

  if (!response.ok) return null;
  if (contentType(response) != "application/json") return null;

  return await response.json() as T;
};

export const fetchManifest = async () => {
  const manifest = await json<Manifest>("/meta/index.json");
  if (!manifest)
    throw new Error("metadata not found: run `npm run build` first");
  if (manifest.v != 1)
    throw new Error(`unsupported metadata version: ${manifest.v}`);
  return manifest;
};

/**
 * `stem` is already URL-encoded, without a leading slash.
 */
export const fetchEntry = (stem: string) =>
  json<EntryMeta>(`/meta/${stem}.json`);

const javascriptTypes = ["text/javascript", "application/javascript"];

// Content types each extension may arrive with; anything else is the shell.
const acceptedTypes = new Map<string, string[]>([
  ["js", javascriptTypes],
  ["pages.js", javascriptTypes],
  ["jsx", ["text/jsx", ...javascriptTypes]],
  ["md", ["text/markdown", "text/plain"]],
  ["json", ["application/json", "text/plain"]],
  ["html", ["text/html"]],
]);

const accepted = (ext: string, type: string) =>
  acceptedTypes.get(ext)?.includes(type) ?? false;

/**
 * Cloudflare Pages answers a missing file with the SPA shell
 * (200 + text/html), so the content-type check is part of the 404 decision.
 */
export const fetchSource = async (file: string, ext: string) => {
  const response = await fetch(file, { cache: "no-cache" });
  if (!response.ok) throw new NotFoundError(file);
  if (!accepted(ext, contentType(response))) throw new NotFoundError(file);

  return await response.text();
};

export class NotFoundError extends Error {
  constructor(path: string) {
    super(`path not found: ${path}`);
    this.name = "NotFoundError";
  }
}
