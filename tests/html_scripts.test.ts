import { expect } from "@esm-bundle/chai";
import { VFile } from "vfile";
import HtmlFactory from "../adapters/html.ext.pages.js";

describe("html scripts", () => {
  it("runs async and defer scripts but not plain scripts", async () => {
    const host = document.createElement("div");
    const shadow = host.attachShadow({ mode: "open" });
    const globals = window as unknown as Record<string, unknown>;
    const file = new VFile({
      path: "scripts.html",
      value: [
        "<h1>Scripts</h1>",
        "<script>window.__plainScript = true;</script>",
        '<script async type="module">',
        "  const shadow = getShadow();",
        "  window.__asyncScript = shadow instanceof ShadowRoot;",
        "</script>",
        "<script defer>window.__deferScript = true;</script>",
      ].join("\n"),
    });

    await HtmlFactory(file)(shadow);

    expect(globals.__plainScript).to.equal(undefined);
    expect(globals.__asyncScript).to.equal(true);
    expect(globals.__deferScript).to.equal(true);
    expect(shadow.querySelectorAll("script")).to.have.length(1);
    expect(shadow.querySelector("script")?.textContent).to.contain(
      "__plainScript",
    );

    delete globals.__plainScript;
    delete globals.__asyncScript;
    delete globals.__deferScript;
  });

  it("keeps two html loaders isolated", async () => {
    const globals = window as unknown as Record<string, unknown>;
    const first = document.createElement("div").attachShadow({ mode: "open" });
    const second = document.createElement("div").attachShadow({ mode: "open" });
    const page = (name: string) =>
      new VFile({
        path: `${name}.html`,
        value: [
          '<script async type="module">',
          `  window.__${name}Shadow = getShadow();`,
          "</script>",
        ].join("\n"),
      });

    await Promise.all([
      HtmlFactory(page("first"))(first),
      HtmlFactory(page("second"))(second),
    ]);

    expect(globals.__firstShadow).to.equal(first);
    expect(globals.__secondShadow).to.equal(second);

    delete globals.__firstShadow;
    delete globals.__secondShadow;
  });
});
