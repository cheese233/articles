import { mkdir, readFile, rm, stat } from "node:fs/promises";
import * as path from "node:path";
import { matchFileAdapter, stripExt } from "../../shared/ext.ts";
import { linkTimeline, sortEntries } from "../../shared/order.ts";
import type {
  AdapterInfo,
  EntryMeta,
  Manifest,
  ManifestEntry,
  ParsedMeta,
  SiteData,
  Variant,
} from "../../shared/types.ts";
import { listAdapters, parseFile } from "../lib/adapters.ts";
import { config } from "../lib/config.ts";
import { walk, writeJson } from "../lib/fs.ts";
import { commitTime } from "../lib/git.ts";
import { encodePath, paths } from "../lib/paths.ts";
import buildAtom from "./feed_atom.ts";
import buildJsonFeed from "./feed_json.ts";
import buildRobots from "./robots.ts";
import buildSitemap from "./sitemap_xml.ts";

interface SourceRecord {
  info: AdapterInfo;
  stem: string;
  route: string;
  file: string;
  title: string;
  date: string;
  updated: string;
  author: string;
  tags: string[];
  summary: string;
  routable: boolean;
}

let warned = false;

const normalizeDate = (value: string, rel: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime()))
    throw new Error(`invalid date "${value}" in ${rel}`);
  return date.toISOString();
};

const normalizeTags = (tags: ParsedMeta["tags"]) =>
  (tags ?? []).map((tag) => String(tag).trim()).filter(Boolean);

const parentDirs = (route: string) => {
  const parts = route.split("/").filter(Boolean);
  const dirs = ["/"];
  let prefix = "";

  for (let index = 0; index < parts.length - 1; index++) {
    prefix += `/${parts[index]}`;
    dirs.push(`${prefix}/`);
  }

  return dirs;
};

const mtime = async (file: string, rel: string) => {
  if (!warned) {
    console.warn(
      `warning: ${rel} has no date, git history, or SOURCE_DATE_EPOCH; ` +
        "using file mtime (not reproducible across machines)",
    );
    warned = true;
  }
  return (await stat(file)).mtime.toISOString();
};

const resolveTimes = async (
  full: string,
  rel: string,
  meta: ParsedMeta,
) => {
  const committed = await commitTime(paths.root, `content/${rel}`);

  const fallback = async () => {
    if (committed) return committed;
    const epoch = process.env.SOURCE_DATE_EPOCH;
    if (epoch) return new Date(Number(epoch) * 1000).toISOString();
    return await mtime(full, rel);
  };

  const date = meta.date
    ? normalizeDate(meta.date, rel)
    : await fallback();
  const updated = meta.updated
    ? normalizeDate(meta.updated, rel)
    : committed ?? date;

  return { date, updated };
};

export default async function (): Promise<SiteData> {
  const adapters = await listAdapters();
  const groups = new Map<string, SourceRecord[]>();

  for await (const file of walk(paths.content)) {
    const info = matchFileAdapter(file.path, adapters);
    if (!info)
      throw new Error(`no adapter for content file: ${file.path}`);

    const source = await readFile(file.full, "utf8");
    const meta = await parseFile(info, file.path, source);
    const stem = stripExt(file.path, info.ext);
    const routable = meta.routable === true;
    const title = (meta.title ?? "").trim();

    if (routable && !title)
      throw new Error(`routable file has no title: ${file.path}`);

    const times = routable
      ? await resolveTimes(file.full, file.path, meta)
      : { date: "", updated: "" };

    const record: SourceRecord = {
      info,
      stem,
      route: encodePath(`/${stem}`),
      file: encodePath(`/content/${file.path}`),
      title,
      date: times.date,
      updated: times.updated,
      author: (meta.author ?? config.author).trim(),
      tags: normalizeTags(meta.tags),
      summary: (meta.summary ?? "").trim(),
      routable,
    };

    const bucket = groups.get(stem) ?? [];
    bucket.push(record);
    groups.set(stem, bucket);
  }

  const entries: EntryMeta[] = [];
  const dirs = new Set<string>(["/"]);

  for (const [stem, records] of groups) {
    const routable = records.filter((record) => record.routable);

    if (routable.length > 1)
      throw new Error(
        `multiple routable variants for ${stem}: ` +
          routable.map((record) => record.info.ext).join(", "),
      );
    if (!routable.length) continue;

    const canonical = routable[0];
    for (const dir of parentDirs(canonical.route)) dirs.add(dir);

    const variants: Variant[] = records
      .map((record) => ({
        ext: record.info.ext,
        file: record.file,
        routable: record.routable,
      }))
      .sort((a, b) => (a.ext < b.ext ? -1 : a.ext > b.ext ? 1 : 0));

    entries.push({
      v: 1,
      stem,
      route: canonical.route,
      ext: canonical.info.ext,
      file: canonical.file,
      title: canonical.title,
      date: canonical.date,
      updated: canonical.updated,
      author: canonical.author,
      tags: canonical.tags,
      summary: canonical.summary,
      variants,
      prev: null,
      next: null,
    });
  }

  const sorted = sortEntries(entries);
  const timeline = linkTimeline(sorted);

  for (const entry of sorted) {
    const link = timeline.get(entry.route);
    if (!link) throw new Error(`timeline is missing ${entry.route}`);
    entry.prev = link.prev;
    entry.next = link.next;
  }

  const manifestEntries: ManifestEntry[] = sorted.map((entry) => ({
    stem: entry.stem,
    route: entry.route,
    ext: entry.ext,
    file: entry.file,
    title: entry.title,
    date: entry.date,
    updated: entry.updated,
    author: entry.author,
    tags: entry.tags,
  }));

  const manifest: Manifest = {
    v: 1,
    site: config,
    adapters: adapters.map((adapter) => ({
      ...adapter,
      file: encodePath(adapter.file),
    })),
    entries: manifestEntries,
    dirs: [...dirs].sort(),
  };

  await rm(paths.meta, { recursive: true, force: true });
  await mkdir(paths.meta, { recursive: true });
  await writeJson(path.join(paths.meta, "index.json"), manifest);

  for (const entry of sorted) {
    await writeJson(
      path.join(paths.meta, `${entry.stem}.json`),
      entry,
    );
  }

  const data: SiteData = { site: config, entries: sorted };

  await buildSitemap(data);
  await buildAtom(data);
  await buildJsonFeed(data);
  await buildRobots(data);

  return data;
}
