// Must stay first: adapter classes extend HTMLElement.
import "../scripts/lib/dom.ts";
import assert from "node:assert/strict";
import { test } from "node:test";
import { VFile } from "vfile";
import HtmlFactory from "../adapters/html.ext.pages.js";
import JavaScriptLoader, * as JavaScript from "../adapters/js.ext.js";
import MarkdownFactory from "../adapters/md.ext.pages.js";
import WebElements from "../adapters/pages.js.ext.js";

const MarkdownAdapter = MarkdownFactory(WebElements);
const HtmlAdapter = HtmlFactory(WebElements);

test("adapter factories return WebElements classes", () => {
  assert.ok(WebElements.prototype instanceof HTMLElement);
  assert.ok(MarkdownAdapter.prototype instanceof WebElements);
  assert.ok(HtmlAdapter.prototype instanceof WebElements);
  assert.ok(!(JavaScriptLoader.prototype instanceof HTMLElement));
  assert.equal(WebElements.meta.ext, "pages.js");
  assert.equal(MarkdownAdapter.meta.lang, "pages.js");
  assert.equal(HtmlAdapter.meta.lang, "pages.js");
  assert.equal(JavaScript.meta.ext, "js");
});

test("markdown adapter reads YAML frontmatter", async () => {
  const file = new VFile({
    path: "content/hello.md",
    value: [
      "---",
      "title: Hello",
      "date: 2026-10-20",
      "tags: [meta, test]",
      "---",
      "",
      "# Hello",
      "",
      "First paragraph.",
    ].join("\n"),
  });

  const meta = await new MarkdownAdapter(file).parse();

  assert.equal(meta.title, "Hello");
  assert.equal(meta.date, "2026-10-20");
  assert.deepEqual(meta.tags, ["meta", "test"]);
  assert.equal(meta.routable, true);
  assert.match(meta.summary ?? "", /First paragraph/);
});

test("markdown frontmatter can make a file a middleware", async () => {
  const file = new VFile({
    path: "content/404.md",
    value: "---\nroutable: false\n---\n\n# 404\n",
  });

  const meta = await new MarkdownAdapter(file).parse();
  assert.equal(meta.routable, false);
});

test("js adapter reads JSDoc and requires explicit @routable", async () => {
  const source = [
    "/**",
    " * # Demo",
    " * @routable",
    " * @date 2026-10-19",
    ' * @tags ["demo", "js"]',
    " */",
    "export default function () {}",
  ].join("\n");

  const file = new VFile({ path: "content/demo.js", value: source });
  const meta = await JavaScript.parse(file);

  assert.equal(meta.title, "Demo");
  assert.equal(meta.date, "2026-10-19");
  assert.deepEqual(meta.tags, ["demo", "js"]);
  assert.equal(meta.routable, true);

  const page = new VFile({
    path: "content/plain.js",
    value: "export default function () {}",
  });
  const plain = await JavaScript.parse(page);
  assert.equal(plain.routable, undefined);
});

test("pages.js defaults to routable", async () => {
  const file = new VFile({
    path: "content/about.pages.js",
    value: "/**\n * # About\n */\nexport default function () {}",
  });

  const meta = await new WebElements(file).parse();
  assert.equal(meta.title, "About");
  assert.equal(meta.routable, true);
});

test("html adapter reads meta tags", async () => {
  const file = new VFile({
    path: "content/lab.html",
    value: [
      '<meta name="title" content="Lab" />',
      '<meta name="description" content="A lab." />',
      '<meta name="date" content="2026-10-21" />',
      '<meta name="tags" content="demo, html" />',
      "<h1>Lab</h1>",
    ].join("\n"),
  });

  const meta = await new HtmlAdapter(file).parse();

  assert.equal(meta.title, "Lab");
  assert.equal(meta.summary, "A lab.");
  assert.equal(meta.date, "2026-10-21");
  assert.deepEqual(meta.tags, ["demo", "html"]);
  assert.equal(meta.routable, true);
});
