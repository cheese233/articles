import { expect } from "@esm-bundle/chai";
import {
  findDirectoryAdapter,
  matchFileAdapter,
  parseAdapterName,
  stripExt,
} from "../shared/ext.ts";

const adapters = [
  parseAdapterName("md.ext.pages.js", "/adapters/md.ext.pages.js"),
  parseAdapterName("js.ext.js", "/adapters/js.ext.js"),
  parseAdapterName("pages.js.ext.js", "/adapters/pages.js.ext.js"),
  parseAdapterName("[...path].ext.pages.js", "/adapters/[...path].ext.pages.js"),
  parseAdapterName(
    "posts.[...path].ext.pages.js",
    "/adapters/posts.[...path].ext.pages.js",
  ),
  parseAdapterName("[slug].ext.pages.js", "/adapters/[slug].ext.pages.js"),
  parseAdapterName(
    "posts.[slug].ext.pages.js",
    "/adapters/posts.[slug].ext.pages.js",
  ),
];

describe("adapter names", () => {
  it("parses compound adapter names", () => {
    const info = parseAdapterName(
      "pages.js.ext.js",
      "/adapters/pages.js.ext.js",
    );

    expect(info.ext).to.equal("pages.js");
    expect(info.lang).to.equal("js");
    expect(info.directory).to.equal(false);
    expect(info.prefix).to.equal("");
    expect(info.pattern).to.equal("");

    const markdown = parseAdapterName(
      "md.ext.pages.js",
      "/adapters/md.ext.pages.js",
    );
    expect(markdown.ext).to.equal("md");
    expect(markdown.lang).to.equal("pages.js");
  });

  it("rejects names without exactly one .ext. marker", () => {
    expect(() => parseAdapterName("md.js", "/adapters/md.js")).to.throw();
    expect(() => parseAdapterName("ext.js", "/adapters/ext.js")).to.throw();
  });

  it("prefers the longest matching extension", () => {
    const info = matchFileAdapter("/about.pages.js", adapters);
    expect(info?.ext).to.equal("pages.js");

    const markdown = matchFileAdapter("/hello.md", adapters);
    expect(markdown?.ext).to.equal("md");

    expect(matchFileAdapter("/hello.ts", adapters)).to.equal(null);
  });

  it("stripExt removes the whole compound extension", () => {
    expect(stripExt("posts/hello.md", "md")).to.equal("posts/hello");
    expect(stripExt("about.pages.js", "pages.js")).to.equal("about");
  });

  it("directory adapters use Astro-style globs", () => {
    const root = findDirectoryAdapter("/", adapters);
    expect(root?.ext).to.equal("[...path]");

    const posts = findDirectoryAdapter("/posts/", adapters);
    expect(posts?.ext).to.equal("posts.[...path]");

    const nested = findDirectoryAdapter("/posts/2026/", adapters);
    expect(nested?.ext).to.equal("posts.[slug]");

    const deep = findDirectoryAdapter("/posts/2026/03/", adapters);
    expect(deep?.ext).to.equal("posts.[...path]");

    const one = findDirectoryAdapter("/about/", adapters);
    expect(one?.ext).to.equal("[slug]");
  });
});
