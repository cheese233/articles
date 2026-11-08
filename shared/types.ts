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

/**
 * A directory's `main.<ext>`: rendered whenever that directory is requested,
 * never routed on its own (`@routable` stays off).
 */
export interface MainFile {
  /** Directory route with a trailing slash: `/` or `/posts/`. */
  dir: string;
  ext: string;
  file: string;
  /** Page footer for the directory, from the file's `@footer`. */
  footer: string;
}

export interface Manifest {
  v: number;
  site: SiteConfig;
  adapters: AdapterInfo[];
  entries: ManifestEntry[];
  mains: MainFile[];
  dirs: string[];
}

export interface SiteData {
  site: SiteConfig;
  entries: EntryMeta[];
}

export interface EntryMeta extends ManifestEntry {
  v: number;
  summary: string;
  /**
   * Text for the right end of the site footer. Lines split on `\n`;
   * `[label](https://...)` becomes a link. Empty when the source sets none.
   */
  footer: string;
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
  footer?: string;
}

export interface AdapterContext {
  site: SiteConfig;
  entries: ManifestEntry[];
  route: string;
  entry: EntryMeta | null;
}
