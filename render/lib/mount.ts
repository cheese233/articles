import type { VFile } from "vfile";
import type { EntryMeta } from "../../shared/types.ts";
import {
  errorEvent,
  renderedEvent,
  type LazyAdapter,
  type LoaderElement,
} from "./loader_shim.ts";

/**
 * Mounting a loader: the router and the directory adapter both turn a route
 * into a real `<ext>-loader>` element here. The element owns its shadow root,
 * styles and adapter chain; this module only creates it, points it at a file
 * and waits for the first render.
 */

/** Longest a single loader may take before the shell gives up on it. */
const renderTimeout = 15000;

export interface MountOptions {
  /** Source already read; otherwise the element fetches `path` itself. */
  file?: VFile;
  path?: string;
  route?: string;
  entry?: EntryMeta | null;
}

/**
 * Create the adapter's loader element for `path`, append it to `target`, and
 * resolve with it once it dispatched `rendered` (reject on `error`, or when
 * the render takes longer than `renderTimeout`).
 */
export const mountElement = async (
  adapter: LazyAdapter,
  target: HTMLElement | ShadowRoot,
  { file, path, route, entry }: MountOptions = {},
): Promise<LoaderElement> => {
  const element = document.createElement(adapter.tag) as LoaderElement;
  const label = path ?? file?.path ?? adapter.tag;

  if (file) element.file = file;
  if (path) element.setAttribute("path", path);
  if (route) element.route = route;
  if (entry !== undefined) element.entry = entry;

  const rendered = new Promise<LoaderElement>((resolve, reject) => {
    element.addEventListener(renderedEvent, () => resolve(element), {
      once: true,
    });
    element.addEventListener(
      errorEvent,
      () => reject(new Error(`failed to render ${label}`)),
      { once: true },
    );
  });

  let timer = 0;
  const expired = new Promise<never>((_, reject) => {
    timer = window.setTimeout(
      () => reject(new Error(`render timeout: ${label}`)),
      renderTimeout,
    );
  });

  try {
    target.append(element);
    return await Promise.race([rendered, expired]);
  } finally {
    window.clearTimeout(timer);
  }
};
