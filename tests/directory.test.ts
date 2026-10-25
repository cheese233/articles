import { expect } from "@esm-bundle/chai";
import { findMainEntry, isMainEntry } from "../shared/directory.ts";
import type { ManifestEntry } from "../shared/types.ts";

const entry = (file: string, route: string): ManifestEntry => ({
  stem: route.replace(/^\//, ""),
  route,
  ext: file.split(".").slice(1).join("."),
  file,
  title: route,
  date: "",
  updated: "",
  author: "",
  tags: [],
});

describe("directory main", () => {
  it("finds main in a directory", () => {
    const entries = [
      entry("/posts/a.md", "/posts/a"),
      entry("/posts/main.md", "/posts/main"),
    ];

    expect(findMainEntry("/posts/", entries)?.file).to.equal("/posts/main.md");
    expect(findMainEntry("/posts", entries)?.file).to.equal("/posts/main.md");
  });

  it("finds root main and ignores nested main files", () => {
    const entries = [
      entry("/main.md", "/main"),
      entry("/posts/main.md", "/posts/main"),
    ];

    expect(findMainEntry("/", entries)?.file).to.equal("/main.md");
    expect(findMainEntry("/posts/", entries)?.file).to.equal("/posts/main.md");
  });

  it("returns null when the directory has no main", () => {
    const entries = [entry("/posts/a.md", "/posts/a")];
    expect(findMainEntry("/posts/", entries)).to.equal(null);
  });

  it("recognizes main entries for listing filters", () => {
    expect(isMainEntry("/main.md")).to.equal(true);
    expect(isMainEntry("/posts/main.md")).to.equal(true);
    expect(isMainEntry("/posts/not-main.md")).to.equal(false);
    expect(isMainEntry("/posts/main.md/extra")).to.equal(false);
  });
});
