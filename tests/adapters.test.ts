// Must stay first: the js adapter defines a WebElements host class.
import "../scripts/lib/dom.ts";
import assert from "node:assert/strict";
import { test } from "node:test";
import { VFile } from "vfile";
import * as HtmlAdapter from "../adapters/html.ext.pages.js";
import * as JavaScriptAdapter from "../adapters/js.ext.js";
import * as MarkdownAdapter from "../adapters/md.ext.pages.js";
import WebElements from "../adapters/pages.js.ext.js";
import * as Pages from "../adapters/pages.js.ext.js";

test("adapter modules expose meta, parse, and a render function", () => {
  const adapters = {
    js: JavaScriptAdapter,
    pages: Pages,
    md: MarkdownAdapter,
    html: HtmlAdapter,
  };

  for (const adapter of Object.values(adapters)) {
    assert.equal(typeof adapter.default, "function");
    assert.equal(typeof adapter.parse, "function");
    assert.ok(adapter.meta);
  }

  assert.ok(WebElements.prototype instanceof HTMLElement);
  assert.ok(!(JavaScriptAdapter.default.prototype instanceof HTMLElement));
  assert.equal(JavaScriptAdapter.meta.ext, "js");
  assert.equal(Pages.meta.ext, "pages.js");
  assert.equal(MarkdownAdapter.meta.lang, "pages.js");
  assert.equal(HtmlAdapter.meta.lang, "pages.js");
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

  const meta = await MarkdownAdapter.parse(file);

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

  const meta = await MarkdownAdapter.parse(file);
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
  const meta = await JavaScriptAdapter.parse(file);

  assert.equal(meta.title, "Demo");
  assert.equal(meta.date, "2026-10-19");
  assert.deepEqual(meta.tags, ["demo", "js"]);
  assert.equal(meta.routable, true);

  const page = new VFile({
    path: "content/plain.js",
    value: "export default function () {}",
  });
  const plain = await JavaScriptAdapter.parse(page);
  assert.equal(plain.routable, undefined);
});

test("pages.js defaults to routable", async () => {
  const file = new VFile({
    path: "content/about.pages.js",
    value: "/**\n * # About\n */\nexport default function () {}",
  });

  const meta = await Pages.parse(file);
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

  const meta = await HtmlAdapter.parse(file);

  assert.equal(meta.title, "Lab");
  assert.equal(meta.summary, "A lab.");
  assert.equal(meta.date, "2026-10-21");
  assert.deepEqual(meta.tags, ["demo", "html"]);
  assert.equal(meta.routable, true);
});
