import type { AdapterInfo } from "./types.ts";

export interface AdapterNode {
  info: AdapterInfo;
  parent: AdapterInfo | null;
  children: AdapterInfo[];
}

export interface AdapterGraph {
  byExt: Map<string, AdapterNode>;
  roots: AdapterInfo[];
  order: AdapterInfo[];
}

/**
 * Build the adapter dependency tree from filenames alone. `ext` is the
 * handled extension and `lang` is the parent adapter extension.
 */
export const buildAdapterGraph = (adapters: AdapterInfo[]): AdapterGraph => {
  const byExt = new Map<string, AdapterNode>();
  const roots: AdapterInfo[] = [];

  for (const info of adapters) {
    if (byExt.has(info.ext)) {
      throw new Error(`adapter conflict: duplicate .${info.ext} (${info.file})`);
    }
    byExt.set(info.ext, { info, parent: null, children: [] });
  }

  for (const info of adapters) {
    const node = byExt.get(info.ext);
    if (!node) throw new Error(`missing adapter node .${info.ext}`);

    if (!info.lang || info.lang == info.ext) {
      roots.push(info);
      continue;
    }

    const parent = byExt.get(info.lang);
    if (!parent) {
      throw new Error(
        `adapter .${info.ext} needs missing parent .${info.lang}`,
      );
    }

    node.parent = parent.info;
    parent.children.push(info);
  }

  const state = new Map<string, "visiting" | "done">();
  const stack: string[] = [];
  const order: AdapterInfo[] = [];

  const visit = (info: AdapterInfo) => {
    const current = state.get(info.ext);
    if (current == "done") return;

    if (current == "visiting") {
      const start = stack.indexOf(info.ext);
      const cycle = [...stack.slice(start), info.ext].join(" -> ");
      throw new Error(`adapter cycle: ${cycle}`);
    }

    state.set(info.ext, "visiting");
    stack.push(info.ext);

    const node = byExt.get(info.ext);
    if (!node) throw new Error(`missing adapter node .${info.ext}`);
    if (node.parent) visit(node.parent);

    state.set(info.ext, "done");
    stack.pop();
    order.push(info);
  };

  for (const info of adapters) visit(info);

  return { byExt, roots, order };
};

/** Resolve content extension -> parent chain, ending at the language root. */
export const adapterChain = (
  ext: string,
  graph: AdapterGraph,
): AdapterInfo[] => {
  const chain: AdapterInfo[] = [];
  const seen = new Set<string>();
  let info = graph.byExt.get(ext)?.info;

  if (!info) throw new Error(`no adapter for .${ext}`);

  while (info) {
    if (seen.has(info.ext)) {
      throw new Error(`adapter cycle at .${info.ext}`);
    }
    seen.add(info.ext);
    chain.push(info);

    const node = graph.byExt.get(info.ext);
    if (!node) throw new Error(`missing adapter node .${info.ext}`);
    info = node.parent ?? undefined;
  }

  return chain;
};
