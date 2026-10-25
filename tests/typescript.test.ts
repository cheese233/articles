import { expect } from "@esm-bundle/chai";
import { executeServerCommand } from "@web/test-runner-commands";

interface TypeScriptResult {
  count: number;
  errors: Array<{ file: string; nodes: number[] }>;
  app: {
    importsExt: boolean;
    topLevelAwait: boolean;
    noPromiseAnnotation: boolean;
  };
}

const check = async () =>
  await executeServerCommand("typescript-check") as TypeScriptResult;

describe("client TypeScript", () => {
  it("is erasable by ts-blank-space", async function () {
    this.timeout(60000);

    const result = await check();
    expect(result.count).to.be.greaterThan(0);
    expect(result.errors).to.deep.equal([]);
  });

  it("keeps render/app.ts imports and top-level await", async function () {
    this.timeout(60000);

    const result = await check();
    expect(result.app.importsExt).to.equal(true);
    expect(result.app.topLevelAwait).to.equal(true);
    expect(result.app.noPromiseAnnotation).to.equal(true);
  });
});
