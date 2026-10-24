import type { SiteData } from "../../shared/types.ts";
import { writeJson } from "../lib/fs.ts";
import { paths } from "../lib/paths.ts";

export default async function (data: SiteData) {
  const { site, entries } = data;

  const feed = {
    version: "https://jsonfeed.org/version/1.1",
    title: site.title,
    home_page_url: `${site.url}/`,
    feed_url: `${site.url}/feed.json`,
    description: site.description,
    language: site.language,
    authors: [{ name: site.author }],
    items: entries.map((entry) => ({
      id: `${site.url}${entry.route}`,
      url: `${site.url}${entry.route}`,
      title: entry.title,
      content_text: entry.summary,
      summary: entry.summary,
      date_published: entry.date,
      date_modified: entry.updated,
      tags: entry.tags,
      authors: [{ name: entry.author }],
    })),
  };

  await writeJson(`${paths.root}/feed.json`, feed);
}
