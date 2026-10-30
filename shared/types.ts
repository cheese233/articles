import type { VFile } from "vfile";

export interface SiteConfig {
  url: string;
  title: string;
  author: string;
  description: string;
  language: string;
}

export interface AdapterInfo {
  ext: string;
  lang: string;
  file: string;
  directory: boolean;
  prefix: string;
  pattern: string;
}

export interface AdapterIndex {
  v: number;
  adapters: AdapterInfo[];
}

export interface Variant {
  ext: string;
  file: string;
  routable: boolean;
}

export interface TimelineLink {
  route: string;
  title: string;
  date: string;
}

export interface ManifestEntry {
  stem: string;
  route: string;
  ext: string;
  file: string;
  title: string;
  date: string;
  updated: string;
  author: string;
  tags: string[];
}

export interface Manifest {
  v: number;
  site: SiteConfig;
  adapters: AdapterInfo[];
  entries: ManifestEntry[];
  dirs: string[];
}

export interface SiteData {
  site: SiteConfig;
  entries: EntryMeta[];
}

export interface EntryMeta extends ManifestEntry {
  v: number;
  summary: string;
  variants: Variant[];
  prev: TimelineLink | null;
  next: TimelineLink | null;
}

export interface ParsedMeta {
  title?: string;
  date?: string;
  updated?: string;
  author?: string;
  tags?: string[];
  routable?: boolean;
  summary?: string;
}

export interface AdapterStatics {
  ext: string;
  lang: string;
  directory?: boolean;
  priority?: number;
  kind?: "handler" | "content";
}

export interface AdapterContext {
  site: SiteConfig;
  entries: ManifestEntry[];
  route: string;
  entry: EntryMeta | null;
}

/**
 * An adapter module: named `meta` / `parse` plus a default render function.
 * The render function receives the source file, the page ShadowRoot, and the
 * current site context. It returns when rendering is complete.
 */
export interface AdapterModule {
  meta: AdapterStatics;
  parse: (file: VFile) => Promise<ParsedMeta> | ParsedMeta;
  default: (
    file: VFile,
    shadow: ShadowRoot,
    context: AdapterContext,
  ) => void | Promise<void>;
}
