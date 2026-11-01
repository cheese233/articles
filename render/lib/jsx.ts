/**
 * Tiny JSX factory for `.jsx` content. The Service Worker compiles JSX with
 * the classic runtime into `h(type, props, ...children)` calls that build
 * real DOM nodes; there is no virtual DOM and no re-render.
 */

export type Child =
  | Node
  | string
  | number
  | boolean
  | null
  | undefined
  | Child[];

export interface Props {
  [name: string]: unknown;
  children?: Child[];
}

export type Component = (props: Props) => Node;

const isEvent = (name: string, value: unknown) =>
  name.startsWith("on") && name.length > 2 && typeof value == "function";

const kebab = (name: string) =>
  name.startsWith("--")
    ? name
    : name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

const setStyle = (element: HTMLElement, value: unknown) => {
  if (typeof value == "string") {
    element.setAttribute("style", value);
    return;
  }
  if (!value || typeof value != "object") return;

  for (const [name, item] of Object.entries(value)) {
    if (item == null || item === false) continue;
    element.style.setProperty(kebab(name), String(item));
  }
};

const setProp = (element: HTMLElement, name: string, value: unknown) => {
  if (name == "children" || name == "key") return;

  if (name == "ref") {
    if (typeof value == "function") value(element);
    return;
  }
  if (name == "className" || name == "class") {
    if (value != null) element.setAttribute("class", String(value));
    return;
  }
  if (name == "style") {
    setStyle(element, value);
    return;
  }
  if (isEvent(name, value)) {
    element.addEventListener(
      name.slice(2).toLowerCase(),
      value as EventListener,
    );
    return;
  }

  // Objects, arrays and non-string values on known properties (for example
  // `entries` on a loader or `checked` on an input) are set as properties;
  // everything else becomes an attribute so custom elements see it.
  const isObject = value != null && typeof value == "object";
  if (isObject || (name in element && typeof value != "string")) {
    (element as unknown as Record<string, unknown>)[name] = value;
    return;
  }

  if (value == null || value === false) return;
  element.setAttribute(name, value === true ? "" : String(value));
};

/** Append children, flattening arrays and skipping empty values. */
export const append = (parent: Node, children: Child[]) => {
  for (const child of children) {
    if (Array.isArray(child)) {
      append(parent, child);
    } else if (child instanceof Node) {
      parent.appendChild(child);
    } else if (child != null && typeof child != "boolean") {
      parent.appendChild(document.createTextNode(String(child)));
    }
  }
};

export const Fragment = (props: Props): Node => {
  const fragment = document.createDocumentFragment();
  append(fragment, props.children ?? []);
  return fragment;
};

export const h = (
  type: string | Component,
  props: Props | null,
  ...children: Child[]
): Node => {
  if (typeof type == "function") {
    return type({ ...props, children });
  }

  const element = document.createElement(type);
  for (const [name, value] of Object.entries(props ?? {})) {
    setProp(element, name, value);
  }

  append(element, children);
  return element;
};
