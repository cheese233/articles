import { expect } from "@esm-bundle/chai";
import { executeServerCommand } from "@web/test-runner-commands";
import { VFile } from "vfile";
import * as Jsx from "../adapters/jsx.ext.pages.js";
import { parseAdapterName } from "../shared/ext.ts";
import type { Manifest } from "../shared/types.ts";
import { Fragment, h } from "../render/lib/jsx.ts";
import {
  defineLoaders,
  type LoaderElement,
} from "../render/lib/loader_shim.ts";

const adapter = (name: string) => parseAdapterName(name, `/adapters/${name}`);

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
    adapter("html.ext.pages.js"),
    adapter("jsx.ext.pages.js"),
  ],
  entries: [],
  dirs: [],
};

const rendered = (element: LoaderElement) =>
  new Promise<void>((resolve, reject) => {
    element.addEventListener("rendered", () => resolve(), { once: true });
    element.addEventListener(
      "error",
      () => reject(new Error("loader failed")),
      { once: true },
    );
  });

describe("jsx", () => {
  it("builds real dom nodes", () => {
    let clicks = 0;
    const node = h(
      "div",
      {
        className: "box",
        style: { marginTop: "4px", "--tint": "red" },
        onClick: () => clicks++,
        hidden: false,
        "data-id": 3,
      },
      "a",
      ["b", null, false, h("span", null, 1)],
    ) as HTMLElement;

    node.click();

    expect(node.className).to.equal("box");
    expect(node.style.marginTop).to.equal("4px");
    expect(node.style.getPropertyValue("--tint")).to.equal("red");
    expect(node.getAttribute("data-id")).to.equal("3");
    expect(node.hasAttribute("hidden")).to.equal(false);
    expect(node.textContent).to.equal("ab1");
    expect(clicks).to.equal(1);
  });

  it("supports fragments and components", () => {
    const Item = (props: { children?: unknown[] }) =>
      h("li", null, ...(props.children as string[]));
    const node = h(Fragment, null, h(Item, null, "x"), h(Item, null, "y"));

    expect(node).to.be.instanceOf(DocumentFragment);
    expect(node.childNodes).to.have.length(2);
    expect(node.textContent).to.equal("xy");
  });

  it("sets objects as properties on custom elements", () => {
    const entries = [{ route: "/a" }];
    const node = h("fluent-card", { entries, appearance: "filled" });

    expect((node as unknown as { entries: unknown }).entries)
      .to.equal(entries);
    expect((node as HTMLElement).getAttribute("appearance"))
      .to.equal("filled");
  });

  it("compiles jsx with the shared runtime import", async () => {
    const { code, lines } = await executeServerCommand("jsx-check") as {
      code: string;
      lines: number;
    };

    expect(code.startsWith('import * as __jsx from "/render/lib/jsx.ts";'))
      .to.equal(true);
    expect(code).to.include("__jsx.h(__jsx.Fragment");
    expect(code).to.include("__jsx.h('p'");
    // Sucrase keeps line numbers, so stack traces match the source.
    expect(lines).to.equal(3);
  });

  it("parses jsdoc metadata", async () => {
    const meta = await Jsx.parse(new VFile({
      value: "/**\n * # Page\n * @routable\n * @date 2026-10-30\n" +
        " * @tags [\"a\"]\n */\nexport default () => null;",
    }));

    expect(meta.title).to.equal("Page");
    expect(meta.routable).to.equal(true);
    expect(meta.date).to.equal("2026-10-30");
    expect(meta.tags).to.deep.equal(["a"]);
  });

  it("keeps hidden or unmarked jsx out of routing", async () => {
    const hidden = await Jsx.parse(new VFile({
      value: "/**\n * # Part\n * @routable\n * @hidden\n */\n" +
        "export default () => null;",
    }));
    const plain = await Jsx.parse(new VFile({
      value: "/** # Part */\nexport default () => null;",
    }));

    expect(hidden.routable).to.equal(false);
    expect(plain.routable).to.equal(false);
  });

  it("keeps the kipfel component hidden", async () => {
    const response = await fetch("/components/kipfel.jsx");
    const meta = await Jsx.parse(new VFile({ value: await response.text() }));

    expect(meta.title).to.equal("kipfel");
    expect(meta.routable).to.equal(false);
  });

  it("renders a jsx module through the lazy loader", async () => {
    defineLoaders(manifest);

    const element = document.createElement("jsx-loader") as LoaderElement;
    element.setAttribute("path", "/tests/fixtures/page.jsx");
    const done = rendered(element);

    document.body.append(element);
    await done;

    const shadow = element.shadowRoot;
    expect(shadow?.querySelector(".card h2")?.textContent).to.equal("hello");
    expect(shadow?.querySelectorAll("li")).to.have.length(2);

    const button = shadow?.querySelector("fluent-button") as HTMLElement;
    button.click();
    expect(element.hasAttribute("data-pressed")).to.equal(true);

    const inner = shadow?.querySelector("html-loader") as LoaderElement;
    await inner.ready;
    expect(inner.shadowRoot?.querySelector("article h1")?.textContent)
      .to.equal("inner");

    element.remove();
  });
});
