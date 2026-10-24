---
name: articles-code-style
description: Apply this repository's code formatting and TypeScript, JavaScript, CSS, HTML, JSON, and test style when writing or reviewing files. Use for any code-style question or diff review in this project.
whenToUse: Load before writing, editing, or reviewing code in this repository. Use it for formatting, naming, imports, JSDoc, and test style; use README.md for architecture and behavior.
---

# articles code style

This skill covers code style only. Use `README.md` for architecture and behavior. When a rule
here and the surrounding code disagree, follow the surrounding code unless the user asks for a
cleanup.

## Formatting

| Kind | Rule |
| --- | --- |
| TypeScript, JavaScript, JSON | 2 spaces, double quotes, semicolons, trailing commas in multiline literals/parameters |
| CSS, HTML | 4 spaces, double quotes, lowercase tags/attributes, self-closing void elements |
| Wrapping | Keep near 80 columns; break long calls, unions, and attributes before they sprawl |
| Files | `snake_case.ts` / `snake_case.js`; lowercase, no spaces |
| Whitespace | No tabs, no trailing whitespace, one blank line between logical blocks |
| Diffs | Never reformat unrelated code; do not normalize equality or quote style in a drive-by change |

The codebase commonly uses `==` / `!=` for comparisons against literals and null
(`chunk.type != "chunk"`, `module.renderedLength == 0`, `title != site`). Match the surrounding
file; do not mass-rewrite those to `===` / `!==` in an unrelated change. Never use loose
equality for objects.

## TypeScript

- Use `import type` for type-only imports.
- Relative TypeScript imports include the extension: `../shared/types.ts`.
- Node builtins use the `node:` prefix: `node:fs/promises`, `node:path`.
- Prefer `interface` for object shapes and exported contracts. Use `type` only for unions or
  aliases where an interface is wrong.
- Use `const` and `let`, never `var`. Prefer early returns over deep nesting.
- No `satisfies`, no `as any`, no `#private`, no enums, no namespaces, no parameter
  properties, no decorators. A narrow `as unknown as` is acceptable only at a real third-party
  type boundary, with a reason nearby.
- Client TypeScript must remain erasable by `ts-blank-space`; do not add syntax that requires
  a transform.
- Use explicit return types only where inference is unclear or the boundary is public.
- Do not add `// @ts-ignore` or `// @ts-nocheck` to silence a real type problem.

## JavaScript and JSDoc

- `.js` files are checked by `tsc` with `checkJs`; type them with JSDoc.
- Use `/** @type {...} */` for fields and constants, `@param` / `@returns` for functions, and
  `@typedef` for local shapes.
- Import shared types from `../shared/types.ts` inside JSDoc when needed.
- Keep JSDoc comments in English; keep user-facing README and content Chinese.
- Arrow functions for small local helpers; named function/class declarations for public or
  recursive modules.
- Avoid line-wide casts. Prefer a narrow JSDoc cast at the exact expression that needs it.

## Naming and comments

- Classes, interfaces, and type names: `PascalCase`.
- Functions, variables, fields: `camelCase`. Module constants: `camelCase`, not `UPPER_CASE`.
- CSS classes: `kebab-case`; custom properties: `--kebab-case`.
- Boolean names start with `is` / `has` / `can` when the meaning benefits.
- Comments explain why, not what. Wrap near 80 columns and use `//` with a space.
- Error messages are short, lowercase, and contextual: `throw new Error("missing #main")`.
- Do not leave commented-out code or debug logging in a final diff.

## CSS and HTML

- Plain modern CSS; no preprocessor, utility framework, or inline style blocks.
- One selector per rule; group related custom properties at the top of a component block.
- Use semantic HTML and existing `aria-*` / `data-*` naming.
- Double-quoted attributes. Put one attribute per line when a tag is long.
- Void elements self-close: `<meta ... />`, `<link ... />`, `<img ... />`.
- Avoid `!important` unless overriding a third-party rule; document the reason.

## Tests

- Use `node:test` and `node:assert/strict`; do not add a test framework.
- Test names are lowercase sentences describing behavior.
- Prefer focused assertions over snapshots.
- Tests must not depend on wall-clock time, randomness, or network access.
- Tests should not mutate the repository; use in-memory data and temporary paths.

## Review checklist

- [ ] Indentation is 2 spaces for TS/JS/JSON, 4 for CSS/HTML.
- [ ] Double quotes and semicolons; trailing commas in multiline literals.
- [ ] `import type` for types; relative `.ts` imports include `.ts`; `node:` builtins.
- [ ] No `satisfies`, `as any`, `#private`, enums, namespaces, or non-erasable client syntax.
- [ ] Names follow the conventions above; no unrelated reformatting.
- [ ] Comments are English, concise, and explain intent.
- [ ] CSS/HTML use 4 spaces and semantic markup.
- [ ] Tests use `node:test` / `node:assert/strict` and are deterministic.

## Examples

Good:

```ts
import type { EntryMeta } from "../shared/types.ts";

export const newestFirst = (entries: EntryMeta[]) =>
  [...entries].sort((a, b) => b.date.localeCompare(a.date));
```

```js
/** @type {Map<string, string>} */
const tags = new Map();

/** @param {string} value @returns {string} */
export const normalize = (value) => value.trim();
```

Bad:

```ts
const data = JSON.parse(raw) as any; // banned escape hatch
enum Mode { List, Page }           // not erasable
```

```css
.card { color:red } /* wrong indentation and spacing */
```

```html
<div class=card><p>text</div> <!-- unquoted attribute, unclosed tags -->
```
