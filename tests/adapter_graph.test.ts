import { expect } from "@esm-bundle/chai";
import type { AdapterInfo } from "../shared/types.ts";
import { adapterChain, buildAdapterGraph } from "../shared/adapter_graph.ts";
import { parseAdapterName } from "../shared/ext.ts";

const info = (name: string): AdapterInfo =>
  parseAdapterName(name, `/adapters/${name}`);

const valid = [
  info("js.ext.js"),
  info("pages.js.ext.js"),
  info("md.ext.pages.js"),
  info("html.ext.pages.js"),
  info("[...path].ext.pages.js"),
];

describe("adapter graph", () => {
  it("builds the filename dependency chain", () => {
    const graph = buildAdapterGraph(valid);
    const chain = adapterChain("md", graph);

    expect(chain.map((adapter) => adapter.ext)).to.deep.equal([
      "md",
      "pages.js",
      "js",
    ]);
    expect(graph.roots.map((adapter) => adapter.ext)).to.deep.equal(["js"]);
  });

  it("accepts the js self-loop as the language root", () => {
    const graph = buildAdapterGraph(valid);
    expect(graph.byExt.get("js")?.parent).to.equal(null);
    expect(adapterChain("pages.js", graph).map((item) => item.ext)).to.deep.equal(
      ["pages.js", "js"],
    );
  });

  it("rejects duplicate extensions", () => {
    expect(() =>
      buildAdapterGraph([info("md.ext.js"), info("md.ext.pages.js")])
    ).to.throw(/duplicate \.md/);
  });

  it("rejects cycles", () => {
    expect(() =>
      buildAdapterGraph([info("a.ext.b"), info("b.ext.a")])
    ).to.throw(/adapter cycle/);
  });

  it("rejects missing parents", () => {
    expect(() => buildAdapterGraph([info("md.ext.nope")])).to.throw(
      /missing parent \.nope/,
    );
  });
});
