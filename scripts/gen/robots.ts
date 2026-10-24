import type { SiteData } from "../../shared/types.ts";
import { writeText } from "../lib/fs.ts";
import { paths } from "../lib/paths.ts";

export default async function (data: SiteData) {
  const body = [
    "User-agent: *",
    "Allow: /",
    "",
    `Sitemap: ${data.site.url}/sitemap.xml`,
    "",
  ].join("\n");

  await writeText(`${paths.root}/robots.txt`, body);
}
