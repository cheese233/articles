// TypeScript only checks JSX through a global `JSX` namespace; this is the
// type-level hook for `render/lib/jsx.ts`, not runtime code.
import type { Child } from "./jsx.ts";

declare global {
  namespace JSX {
    type Element = Node;

    interface ElementChildrenAttribute {
      children: {};
    }

    interface IntrinsicElements {
      [tag: string]: Record<string, unknown> & { children?: Child };
    }
  }
}
