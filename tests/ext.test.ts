import assert from "node:assert/strict";
import { test } from "node:test";
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
  parseAdapterName("[...].ext.pages.js", "/adapters/[...].ext.pages.js"),
  parseAdapterName(
    "posts.[...].ext.pages.js",
    "/adapters/posts.[...].ext.pages.js",
  ),
];

test("parses compound adapter names", () => {
  const info = parseAdapterName(
    "pages.js.ext.js",
    "/adapters/pages.js.ext.js",
  );

  assert.equal(info.ext, "pages.js");
  assert.equal(info.lang, "js");
  assert.equal(info.directory, false);
  assert.equal(info.prefix, "");

  const markdown = parseAdapterName(
    "md.ext.pages.js",
    "/adapters/md.ext.pages.js",
  );
  assert.equal(markdown.ext, "md");
  assert.equal(markdown.lang, "pages.js");
});

test("rejects names without exactly one .ext. marker", () => {
  assert.throws(() => parseAdapterName("md.js", "/adapters/md.js"));
  assert.throws(() => parseAdapterName("ext.js", "/adapters/ext.js"));
});

test("prefers the longest matching extension", () => {
  const info = matchFileAdapter("/content/about.pages.js", adapters);
  assert.equal(info?.ext, "pages.js");

  const markdown = matchFileAdapter("/content/hello.md", adapters);
  assert.equal(markdown?.ext, "md");

  assert.equal(matchFileAdapter("/content/hello.ts", adapters), null);
});

test("stripExt removes the whole compound extension", () => {
  assert.equal(stripExt("posts/hello.md", "md"), "posts/hello");
  assert.equal(stripExt("about.pages.js", "pages.js"), "about");
});

test("directory adapters understand [...] and prefixed [...]", () => {
  const root = findDirectoryAdapter("/", adapters);
  assert.equal(root?.ext, "[...]");

  const posts = findDirectoryAdapter("/posts/", adapters);
  assert.equal(posts?.ext, "posts.[...]");

  const nested = findDirectoryAdapter("/posts/2026/", adapters);
  assert.equal(nested?.ext, "posts.[...]");
});
