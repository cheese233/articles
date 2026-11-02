import { expect } from "@esm-bundle/chai";
import { VFile } from "vfile";
import { loaderTag, parseAdapterName } from "../shared/ext.ts";
import type { Manifest } from "../shared/types.ts";
import {
  defineLoaders,
  type AdapterRegistry,
  type LoaderElement,
} from "../render/lib/loader_shim.ts";

const adapter = (name: string, dir = "/adapters") =>
  parseAdapterName(name, `${dir}/${name}`);

const manifest: Manifest = {
  v: 1,
  site: {
    url: "https://example.test",
    title: "test",
    author: "tester",
    description: "",
    language: "en",
  },
  adapters: [
    adapter("js.ext.js"),
    adapter("pages.js.ext.js"),
    adapter("md.ext.pages.js"),
    adapter("html.ext.pages.js"),
    adapter("probe.ext.pages.js", "/tests/fixtures"),
  ],
  entries: [],
  dirs: [],
};

const probe = window as unknown as Record<string, unknown>;

const rendered = (element: LoaderElement) =>
  new Promise<void>((resolve, reject) => {
    element.addEventListener("rendered", () => resolve(), { once: true });
    element.addEventListener(
      "error",
      () => reject(new Error("loader failed")),
      { once: true },
    );
  });

describe("lazy loader shim", () => {
  after(() => {
    delete probe.__probeImports;
  });

  it("derives tags from adapter extensions", () => {
    expect(loaderTag("md")).to.equal("md-loader");
    expect(loaderTag("jsx")).to.equal("jsx-loader");
    expect(loaderTag("pages.js")).to.equal("pages-js-loader");
    expect(loaderTag("[...path]")).to.equal("directory-loader");
    expect(loaderTag("posts.[slug]")).to.equal("posts-segment-loader");
  });

  let adapters: AdapterRegistry;

  it("defines loaders without importing the adapter", () => {
    adapters = defineLoaders(manifest);
    const tags = Object.values(adapters).map((adapter) => adapter?.tag);

    expect(tags).to.include.members([
      "md-loader",
      "pages-js-loader",
      "probe-loader",
    ]);
    expect(tags).to.not.include("js-loader");
    expect("js" in adapters).to.equal(false);
    expect(customElements.get("probe-loader")).to.be.a("function");
    expect(probe.__probeImports).to.equal(undefined);

    const element = document.createElement("probe-loader");
    expect(element.shadowRoot).to.be.instanceOf(ShadowRoot);
    expect(probe.__probeImports).to.equal(undefined);
  });

  it("uses one shim class for every adapter", () => {
    const base = (tag: string) =>
      Object.getPrototypeOf(customElements.get(tag));

    expect(base("probe-loader")).to.equal(base("md-loader"));
    expect(base("md-loader")).to.equal(base("html-loader"));
    expect(base("html-loader")).to.equal(base("pages-js-loader"));
  });

  it("is a read-only registry proxy", () => {
    const probeAdapter = adapters.probe;
    const writable = adapters as unknown as Record<string, unknown>;

    expect(probeAdapter?.ext).to.equal("probe");
    expect(probeAdapter?.loaded).to.equal(false);
    expect(adapters.missing).to.equal(undefined);
    expect(() => {
      "use strict";
      writable.probe = null;
    }).to.throw(TypeError);
    expect(adapters.probe).to.equal(probeAdapter);
    // Property reads on the lazy proxy never import the chain.
    expect(probe.__probeImports).to.equal(undefined);
  });

  it("imports the adapter chain when connected", async () => {
    const element = document.createElement("probe-loader") as LoaderElement;
    element.file = new VFile({ path: "/probe", value: "<p>hello</p>" });
    const done = rendered(element);

    document.body.append(element);
    await done;

    expect(probe.__probeImports).to.equal(1);
    expect(adapters.probe?.loaded).to.equal(true);
    expect(element.adapters).to.equal(adapters);
    expect(element.route).to.equal("/probe");
    expect(element.entries).to.equal(manifest.entries);
    expect(element.shadowRoot?.querySelector(".probe p")?.textContent)
      .to.equal("hello");
    expect(
      element.shadowRoot?.querySelectorAll('link[rel="stylesheet"]'),
    ).to.have.length(2);

    element.remove();
  });

  it("renders loaders nested inside content", async () => {
    const element = document.createElement("probe-loader") as LoaderElement;
    element.file = new VFile({
      path: "/outer",
      value: '<html-loader path="/tests/fixtures/inner.html"></html-loader>',
    });
    const done = rendered(element);

    document.body.append(element);
    await done;

    const inner = element.shadowRoot?.querySelector(
      "html-loader",
    ) as LoaderElement | null;
    expect(inner).to.not.equal(null);
    await inner?.ready;

    expect(inner?.shadowRoot?.querySelector("article h1")?.textContent)
      .to.equal("inner");
    expect(probe.__probeImports).to.equal(1);

    element.remove();
  });

  it("mounts through the registry without an element", async () => {
    const host = document.createElement("div");
    const shadow = host.attachShadow({ mode: "open" });
    const file = new VFile({ path: "/direct", value: "<p>direct</p>" });

    await adapters.probe?.mount(file, shadow);

    expect(shadow.querySelector(".probe p")?.textContent).to.equal("direct");
    // Same compiled chain as the element above.
    expect(probe.__probeImports).to.equal(1);
  });

  it("dispatches error without a path", async () => {
    const element = document.createElement("md-loader") as LoaderElement;
    const failed = new Promise<void>((resolve) => {
      element.addEventListener("error", () => resolve(), { once: true });
    });

    document.body.append(element);
    await failed;
    element.remove();
  });
});
