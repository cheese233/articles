import type { SiteData } from "../../shared/types.ts";
import { writeText } from "../lib/fs.ts";
import { paths } from "../lib/paths.ts";
import { xml } from "../lib/xml.ts";

export default async function (data: SiteData) {
  const body = xml({
    ":@": { "@_xmlns": "http://www.sitemaps.org/schemas/sitemap/0.9" },
    urlset: data.entries.map((entry) => ({
      url: [
        {
          loc: [{ "#text": `${data.site.url}${entry.route}` }],
        },
        {
          lastmod: [{ "#text": entry.updated }],
        },
      ],
    })),
  });

  await writeText(`${paths.root}/sitemap.xml`, body);
}
