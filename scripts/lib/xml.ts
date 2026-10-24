import XMLBuilder from "fast-xml-builder";

const builder = new XMLBuilder({
  ignoreAttributes: false,
  suppressEmptyNode: true,
  preserveOrder: true,
  cdataPropName: ":CDATA",
});

const declaration = {
  "?xml": [{ "#text": "" }],
  ":@": { "@_version": "1.0", "@_encoding": "UTF-8" },
};

export const xml = (root: Record<string, unknown>) =>
  builder.build([declaration, root]) + "\n";

export const cdata = (content: string) => [
  { ":CDATA": [{ "#text": content }] },
];
