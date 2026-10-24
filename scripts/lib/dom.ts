/**
 * Node metadata generation imports adapters that extend HTMLElement. Node has
 * no DOM, so install just enough for class definition and registration;
 * `parse()` never touches these objects.
 */
if (!globalThis.HTMLElement) {
  globalThis.HTMLElement = class {} as typeof HTMLElement;
}

if (!globalThis.customElements) {
  globalThis.customElements = {
    define() {},
    get() {
      return undefined;
    },
  } as unknown as CustomElementRegistry;
}
