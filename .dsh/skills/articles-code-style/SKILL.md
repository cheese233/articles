---
name: articles-code-style
description: Enforce the articles repository's code style and architecture when editing, adding, or reviewing files. Use for TypeScript, JavaScript, adapters, renderer code, build scripts, tests, CSS, HTML, JSON, or documentation in this project.
whenToUse: Load before changing any file in this repository, especially when adding an adapter, page, dependency, client module, build step, or test; also load when reviewing a diff for style or architectural drift.
---

# articles code style

This skill is the short, enforceable contract for this repository. `README.md` is the design
source; the nearest existing file is the formatting source. If a README snippet and the current
code disagree, follow the current code and do not silently change the architecture.

## Read before editing

- `README.md` — page/adapter pipeline, client TypeScript execution, CI, deployment.
- `package.json`, `tsconfig.json`, `.forgejo/workflows/deploy.yml` — actual build and checks.
- The nearest file of the same kind; imitate its imports, naming, comments, and spacing.
- Do not introduce a formatter, linter, framework, or dependency just to enforce this skill.

## Non-negotiable architecture

- Application code is **never bundled**. Only `node_modules` packages are bundled into
  `vendor/`; `render/*.ts`, `shared/*.ts`, and `adapters/*.js` stay source files.
- Client TypeScript is executed by `ts-blank-space` in a Service Worker. It must remain
  erasable: no enums, runtime namespaces, parameter properties, decorators, or other
  non-erasable syntax. `npm test` checks this.
- The SPA fetches source, mounts an adapter Web Component, and renders in the browser. The CI
  generates metadata only; it never renders final pages.
- Adapters form a chain; a child adapter must extend its parent class. The runtime loads the
  parent first and verifies `Adapter.prototype instanceof Parent`.
- `js.ext.js` is the root `WebElements` and has no parent. `pages.js.ext.js` extends
  `WebElements`; `md.ext.pages.js`, `html.ext.pages.js`, and `[...].ext.pages.js` extend
  `PagesAdapter`.
- Every adapter has a static `meta` with `ext` and `lang`; use `directory: true` only for a
  `[...]` directory adapter. Do not invent fields.
- The constructor receives a `vfile`. `parse()` reads metadata only and must not touch the DOM.
  `connectedCallback()` is the only render lifecycle; there is no `module()` / `render()`
  split.
- A page adapter dispatches `rendered` on success and `error` on failure. Do not swallow the
  caught error; log it with `console.error(error)` and notify the runtime.
- `routable` is an adapter decision: no `routable` means the file is middleware and must not
  enter the route table or feeds. `.pages.js` is routable by default.
- Do not add generated output to Git: `vendor/`, `dist/`, `render/index.html`, `sw.js`,
  `meta/`, `sitemap.xml`, `atom.xml`, `feed.json`, `robots.txt` remain generated.
- Do not reintroduce esbuild for the site. `wrangler` may bring its own transitive esbuild;
  the repository's own build uses Rollup.

## Formatting

| Kind | Rule |
| --- | --- |
| TypeScript, JavaScript, JSON | 2 spaces, double quotes, semicolons, trailing commas in multiline literals/params |
| CSS, HTML | 4 spaces, double quotes, lowercase tags/attributes, self-closing void elements |
| Wrapping | Keep near 80 columns; break long calls, attributes, and unions before they sprawl |
| Files | `snake_case.ts` / `snake_case.js`; adapter filenames are fixed by the extension contract |
| Whitespace | No tabs, no trailing spaces, one blank line between logical blocks |
| Diffs | Never reformat unrelated code; do not normalize equality or quote style in a drive-by change |

The codebase deliberately uses `==` / `!=` for comparisons against literals and null in many
places (`chunk.type != "chunk"`, `module.renderedLength == 0`, `title != site`). Match the
surrounding file; do not mass-rewrite those to `===` / `!==` in an unrelated change. Never use
loose equality for objects or values that can coerce unexpectedly.

### TypeScript

- Use `import type` for type-only imports; `verbatimModuleSyntax` is enabled.
- Relative TypeScript imports include the extension: `../shared/types.ts`.
- Node builtins use the `node:` prefix: `node:fs/promises`, `node:path`, `node:crypto`.
- Prefer `interface` for object shapes and exported contracts. Use `type` only for unions or
  aliases where an interface is wrong.
- Use `const` and `let`, never `var`. Prefer early returns over deep nesting.
- No `satisfies`, no `as any`, no `#private`, no enums, no namespaces, no parameter
  properties, no decorators. A narrow `as unknown as` is acceptable only at a real
  third-party type boundary (see `scripts/lib/vendor_bundle.ts`), with a surrounding reason.
- Export named helpers. Reserve `export default` for adapter classes, page components, and
  CLI entry points such as `scripts/gen/*.ts`.
- Do not add `// @ts-ignore` / `// @ts-nocheck` to silence a real type problem.
- Error messages are short, lowercase, and contextual: `throw new Error("missing #main")`.

### JavaScript and adapters

- `.js` files are checked by `tsc` with `checkJs`; type them with JSDoc.
- Use `/** @type {...} */` for fields/statics, `@param` / `@returns` for functions, and
  `@typedef` for local shapes. Import shared types from `../shared/types.ts` in JSDoc.
- Freeze adapter metadata:

```js
/** @type {import("../shared/types.ts").AdapterStatics} */
const meta = Object.freeze({
  ext: "md",
  lang: "pages.js",
});

export default class MarkdownAdapter extends PagesAdapter {
  static meta = meta;
}
```

- `js.ext.js` default-exports `WebElements`; child adapters import it as a default import
  (`import WebElements from "./js.ext.js";`). Do not switch this back to a named import
  without changing the runtime and all adapters.
- Keep adapter class names descriptive (`MarkdownAdapter`, `HtmlAdapter`, `DirectoryAdapter`,
  `PagesAdapter`). Keep the filename contract exact; do not rename adapters casually.

### Adapter filename contract

| File | Handles | Parent |
| --- | --- | --- |
| `js.ext.js` | `.js` | none; direct import |
| `pages.js.ext.js` | `.pages.js` | `js.ext.js` |
| `md.ext.pages.js` | `.md` | `pages.js.ext.js` |
| `html.ext.pages.js` | `.html` | `pages.js.ext.js` |
| `[...].ext.pages.js` | directory | `pages.js.ext.js` |

`[...]` denotes a directory adapter. A prefix such as `posts.[...]` narrows it to that
directory. Keep `meta.ext`, `meta.lang`, and `meta.directory` consistent with the filename and
the runtime's lookup.

### Client runtime

- The shell loads `render/boot.js`, which registers `sw.js`, waits for it to control the page,
  then imports `./app.ts`. Do not bypass the Service Worker; the app intentionally has no
  pre-bundled fallback.
- The Service Worker transforms non-navigate `.ts` responses. Relative imports stay relative;
  bare imports resolve through the generated import map.
- `render/index.html` is generated from `render/index.template.html`; edit the template, not
  the generated shell.
- `sw.template.js` is source; `sw.js` is generated. A bare `ts-blank-space` import in the
  template is expected and is rewritten to the hashed vendor URL at build time.
- Service Worker features require `localhost` or HTTPS. When testing a client change, use
  `npm run dev` and a real browser, not just `curl`.

### Vendor and dependencies

- Vendor discovery is automatic: `scripts/lib/imports.ts` blanks types with `ts-blank-space`
  and reads imports with `es-module-lexer`. Never add a hardcoded package list in
  `scripts/gen/vendor.ts` or `scripts/lib/vendor_bundle.ts`.
- Node-side or build-only packages do not belong in `vendor/` unless a browser source
  imports them. Adding a dependency means importing it from client code (or the service
  worker template), then running `npm test` and `npm run build`.
- Rollup resolves `vendor:<specifier>` through the plugin and rejects any module outside
  `node_modules`. Do not add a fallback that bundles project code into `vendor/`.
- Rollup code-splits shared dependencies into `vendor/chunks/`. `npm test` verifies that every
  non-empty module appears in exactly one chunk. If you change the vendor graph, keep that
  test green; do not weaken it to make a duplicate build pass.
- Generated `vendor/`, hashed chunk names, and the import map must stay deterministic.

### Metadata and determinism

- `parse()` is CI-only metadata extraction; it must work without a DOM.
- Dates come from frontmatter, then git history, then `SOURCE_DATE_EPOCH`, then a warned
  mtime fallback. Do not use `Date.now()` or random values in metadata generation.
- Sort entries deterministically (date desc, then route) and keep feed/sitemap ordering stable.
- For changes that affect generated metadata, run `npm run build` twice and compare outputs.

### CSS, HTML, Markdown

- CSS uses 4 spaces, kebab-case classes, `--custom-properties`, and plain modern CSS. No
  preprocessor or utility framework.
- HTML uses 4 spaces, double-quoted attributes, semantic elements, and one attribute per line
  when a tag is long. Keep the existing `aria-*` and `data-*` naming.
- `README.md` and `content/` are Chinese; code comments and JSDoc are English. Keep that split.
- Content filenames and routes follow `snake_case` / lowercase kebab-case as already present;
  do not rename published routes without a redirect decision.

## Testing and verification

Run, in this order, before claiming a code change is complete:

```sh
npx tsc --noEmit
npm test
npm run build
```

- `npm test` uses `node:test` and `node:assert/strict`; add focused tests instead of a new
  framework. Vendor tests must use `write: false` and must not mutate `vendor/`.
- For UI or adapter changes, also run `npm run dev` and check the route, a markdown page, a
  `.pages.js` page, the directory listing, and 404.
- For build, metadata, or vendor changes, build twice and compare the tree (determinism).
- Finish with `git status --short`; generated output must not be staged.

## Review checklist

- [ ] File name, indentation (2 or 4), double quotes, semicolons, trailing commas.
- [ ] Import types separated with `import type`; relative `.ts` imports include `.ts`.
- [ ] No non-erasable TypeScript; no `as any` / `satisfies` / `#private` / enums.
- [ ] Adapter extends the correct parent, has static `meta`, constructor `vfile`, `parse()` only
      metadata, and `connectedCallback()` as the only render path.
- [ ] No `module()` / `render()` split, no CI page rendering, no hardcoded vendor list.
- [ ] Only node_modules are vendored; application source remains unbundled.
- [ ] Deterministic output; generated files are not committed.
- [ ] `tsc`, `test`, `build` pass; browser smoke test done for client changes.

## Good and bad anchors

Good:

```ts
import type { EntryMeta } from "../shared/types.ts";

export const newestFirst = (entries: EntryMeta[]) =>
  [...entries].sort((a, b) => b.date.localeCompare(a.date));
```

```js
export default class DirectoryAdapter extends PagesAdapter {
  static meta = meta;
}
```

Bad:

```ts
const data = JSON.parse(raw) as any; // banned escape hatch
enum Mode { List, Page }           // not erasable
```

```js
export default class extends HTMLElement {
  static meta = { ext: "md" }; // no parent, no lang, no shared WebElements
}
```

```ts
async module() {}  // wrong lifecycle
async render() {} // wrong lifecycle; use connectedCallback()
```

Also wrong: bundling `render/app.ts`, adding a central vendor package array, committing
`vendor/` or `render/index.html`, introducing `Date.now()` into metadata, or changing the
adapter chain to a loader registry.
