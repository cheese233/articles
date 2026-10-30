import { expect } from "@esm-bundle/chai";
import { VFile } from "vfile";
import HtmlFactory, * as Html from "../adapters/html.ext.pages.js";
import * as JavaScript from "../adapters/js.ext.js";
import MarkdownFactory, * as Markdown from "../adapters/md.ext.pages.js";
import PagesFactory, * as Pages from "../adapters/pages.js.ext.js";

const MarkdownLoader = PagesFactory(MarkdownFactory);
const HtmlLoader = PagesFactory(HtmlFactory);

describe("adapters", () => {
  it("wraps factories into loader classes", () => {
    expect(MarkdownLoader.prototype).to.be.instanceOf(HTMLElement);
    expect(HtmlLoader.prototype).to.be.instanceOf(HTMLElement);
    expect(MarkdownLoader.meta.ext).to.equal("md");
    expect(HtmlLoader.meta.ext).to.equal("html");
    expect(Pages.meta.ext).to.equal("pages.js");
    expect(MarkdownFactory.meta.ext).to.equal("md");
    expect(HtmlFactory.meta.ext).to.equal("html");
    expect(JavaScript.parse).to.be.a("function");
    expect(JavaScript.meta.ext).to.equal("js");
  });

  it("reads YAML frontmatter", async () => {
    const file = new VFile({
      path: "hello.md",
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

    const meta = await Markdown.parse(file);

    expect(meta.title).to.equal("Hello");
    expect(meta.date).to.equal("2026-10-20");
    expect(meta.tags).to.deep.equal(["meta", "test"]);
    expect(meta.routable).to.equal(true);
    expect(meta.summary ?? "").to.match(/First paragraph/);
  });

  it("can make a markdown file a middleware", async () => {
    const file = new VFile({
      path: "404.md",
      value: "---\nroutable: false\n---\n\n# 404\n",
    });

    const meta = await Markdown.parse(file);
    expect(meta.routable).to.equal(false);
  });

  it("reads JSDoc and requires explicit @routable", async () => {
    const source = [
      "/**",
      " * # Demo",
      " * @routable",
      " * @date 2026-10-19",
      ' * @tags ["demo", "js"]',
      " */",
      "export default function () {}",
    ].join("\n");

    const file = new VFile({ path: "demo.js", value: source });
    const meta = await JavaScript.parse(file);

    expect(meta.title).to.equal("Demo");
    expect(meta.date).to.equal("2026-10-19");
    expect(meta.tags).to.deep.equal(["demo", "js"]);
    expect(meta.routable).to.equal(true);

    const page = new VFile({
      path: "plain.js",
      value: "export default function () {}",
    });
    const plain = await JavaScript.parse(page);
    expect(plain.routable).to.equal(undefined);
  });

  it("defaults pages.js to routable", async () => {
    const file = new VFile({
      path: "about.pages.js",
      value: "/**\n * # About\n */\nexport default function () {}",
    });

    const meta = await Pages.parse(file);
    expect(meta.title).to.equal("About");
    expect(meta.routable).to.equal(true);
  });

  it("reads HTML meta tags", async () => {
    const file = new VFile({
      path: "lab.html",
      value: [
        '<meta name="title" content="Lab" />',
        '<meta name="description" content="A lab." />',
        '<meta name="date" content="2026-10-21" />',
        '<meta name="tags" content="demo, html" />',
        "<h1>Lab</h1>",
      ].join("\n"),
    });

    const meta = await Html.parse(file);

    expect(meta.title).to.equal("Lab");
    expect(meta.summary).to.equal("A lab.");
    expect(meta.date).to.equal("2026-10-21");
    expect(meta.tags).to.deep.equal(["demo", "html"]);
    expect(meta.routable).to.equal(true);
  });
});
