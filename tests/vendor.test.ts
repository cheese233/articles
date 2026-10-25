import { expect } from "@esm-bundle/chai";
import { executeServerCommand } from "@web/test-runner-commands";

interface VendorResult {
  specifiers: string[];
  modules: number;
  duplicates: string[];
}

const check = async () =>
  await executeServerCommand("vendor-check") as VendorResult;

describe("vendor", () => {
  it("discovers browser dependencies from source imports", async function () {
    this.timeout(60000);

    const { specifiers } = await check();
    expect(specifiers).to.include("vfile");
    expect(specifiers).to.include("yaml");
    expect(specifiers).to.include("unified");
    expect(specifiers).to.include("ts-blank-space");

    expect(specifiers).to.not.include("typescript");
    expect(specifiers).to.not.include("fast-xml-builder");
    expect(specifiers).to.not.include("fs");
    expect(specifiers).to.not.include("node:fs");
    expect(specifiers).to.not.include("../render/markdown_deps.ts");
  });

  it("keeps every module in one chunk", async function () {
    this.timeout(60000);

    const result = await check();
    expect(result.modules).to.be.greaterThan(0);
    expect(result.duplicates).to.deep.equal([]);
  });
});
