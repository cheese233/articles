import { expect } from "@esm-bundle/chai";
import { findMain, isMainEntry } from "../shared/directory.ts";
import type { MainFile } from "../shared/types.ts";

const main = (dir: string, ext: string): MainFile => ({
  dir,
  ext,
  file: `${dir}main.${ext}`,
  footer: "",
});

describe("directory main", () => {
  it("finds the main file of a directory", () => {
    const mains = [main("/posts/", "md"), main("/", "jsx")];

    expect(findMain("/", mains)?.file).to.equal("/main.jsx");
    expect(findMain("/posts/", mains)?.file).to.equal("/posts/main.md");
    expect(findMain("/posts", mains)?.file).to.equal("/posts/main.md");
  });

  it("returns null when the directory has no main", () => {
    expect(findMain("/", [main("/posts/", "md")])).to.equal(null);
    expect(findMain("/posts/", [])).to.equal(null);
  });

  it("carries the directory footer", () => {
    const mains = [{ ...main("/", "jsx"), footer: "credit" }];
    expect(findMain("/", mains)?.footer).to.equal("credit");
  });

  it("recognizes main entries for listing filters", () => {
    expect(isMainEntry("/main.md")).to.equal(true);
    expect(isMainEntry("/posts/main.md")).to.equal(true);
    expect(isMainEntry("/posts/not-main.md")).to.equal(false);
    expect(isMainEntry("/posts/main.md/extra")).to.equal(false);
  });
});
