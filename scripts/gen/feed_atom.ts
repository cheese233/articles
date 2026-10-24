import type { SiteData } from "../../shared/types.ts";
import { writeText } from "../lib/fs.ts";
import { paths } from "../lib/paths.ts";
import { cdata, xml } from "../lib/xml.ts";

const epoch = "1970-01-01T00:00:00.000Z";

export default async function (data: SiteData) {
  const { site, entries } = data;
  const updated = entries.reduce(
    (latest, entry) => (entry.updated > latest ? entry.updated : latest),
    epoch,
  );

  const body = xml({
    ":@": { "@_xmlns": "http://www.w3.org/2005/Atom" },
    feed: [
      { id: [{ "#text": `${site.url}/` }] },
      { title: [{ "#text": site.title }] },
      { updated: [{ "#text": updated }] },
      { author: [{ name: [{ "#text": site.author }] }] },
      {
        ":@": { "@_href": `${site.url}/`, "@_rel": "alternate" },
        link: [],
      },
      {
        ":@": { "@_href": `${site.url}/atom.xml`, "@_rel": "self" },
        link: [],
      },
      ...entries.map((entry) => ({
        entry: [
          { title: [{ "#text": entry.title }] },
          { id: [{ "#text": `${site.url}${entry.route}` }] },
          {
            ":@": {
              "@_href": `${site.url}${entry.route}`,
              "@_rel": "alternate",
            },
            link: [],
          },
          {
            ":@": {
              "@_href": `${site.url}${entry.file}`,
              "@_rel": "via",
            },
            link: [],
          },
          { updated: [{ "#text": entry.updated }] },
          { published: [{ "#text": entry.date }] },
          { author: [{ name: [{ "#text": entry.author }] }] },
          { summary: cdata(entry.summary) },
        ],
      })),
    ],
  });

  await writeText(`${paths.root}/atom.xml`, body);
}
