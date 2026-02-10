const load = async (
  /** @type {string} */ url,
  name = "default",
) => (await import(url))[name];

const cdn = (path) => "https://esm.sh/" + path;

const extension = {
  markedBaseUrl: () => load(cdn("marked-base-url@1"), "baseUrl"),
  markedShiki: () => load(cdn("marked-shiki@1")),
  shiki: () => import(cdn("shiki@1")),
  markedGfmHeadingId: () =>
    load(cdn("marked-gfm-heading-id@4"), "gfmHeadingId"),
  markedAlert: () => load(cdn("marked-alert@2")),
  mermaid: () => load(cdn("mermaid@11")),
  katex: () => load(cdn("katex@0")),
};

const basePath = "gh/cheese233/zero-md@0f86dd1/src/lib/";

const { STYLES } = await import(
  cdn(basePath + "presets.js")
);

const { ZeroMdMixin } = await import(cdn(basePath + "zero-md-mixin.js"));

export const BundleZeroMdMixin = (Base = class {}) =>
  class extends ZeroMdMixin(Base) {
    async load(frontmatter = false) {
      this.frontmatter = frontmatter;
      await super.load({
        marked: async () => {
          const Marked = await load(cdn("marked@15"), "Marked");
          return new Marked({ async: true });
        },
        ...extension,
      });
      this.template = {
        ...STYLES,
        KATEX: `<link rel="stylesheet" href="${
          cdn("katex@0/dist/katex.min.css")
        }"/>`,
        MARKDOWN: `<link rel="stylesheet" href="/render/fluent-ui-md.css"/>`,
      }.preset();
      if (this.setAttribute) this.setAttribute("no-shadow", "");
      this.marked.use(
        (await import("./fluentify-marked.js")).default(this.marked),
        (await import(cdn("marked-footnote"))).default(),
      );
    }
    async parse(options) {
      if (!this.frontmatter) {
        options.text = options.text.replace(
          /^---[\s\S]*?---\s*/m,
          "",
        );
      }
      return await super.parse(options);
    }
  };

export const ZeroMd = async () => {
  const { default: ZeroMdBase } = await import(
    cdn(basePath + "zero-md-base.js")
  );
  return BundleZeroMdMixin(ZeroMdBase);
};

export const Marked = async () => {
  const ZeroMd = new (BundleZeroMdMixin())();
  await ZeroMd.load();
  return ZeroMd.marked;
};
