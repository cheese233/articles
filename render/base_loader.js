export class Loader extends HTMLElement {
  /** @type {ShadowRoot} */
  shadow;
  observer;

  constructor() {
    super();
    this.observer = new MutationObserver(async (mut) => {
      if (
        mut.some((m) => m.type === "childList" || m.type === "characterData") &&
        !this.hasAttribute("src")
      )
        await this.update(this.innerHTML);
    });
  }

  async connectedCallback() {
    if (this.shadow) return;

    this.shadow = this.attachShadow({ mode: "open" });

    if (this.hasAttribute("src"))
      await this.attributeChangedCallback("src", null, this.getAttribute("src"));
    else await this.update(this.innerHTML);

    this.observer.observe(this, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  async attributeChangedCallback(name, _, val) {
    if (!this.shadow) return;
    if (name == "src")
      await this.update(await fetch(val).then((f) => f.text()));
  }

  /**
   * @param {string} _content
   */
  update(_content) {
    this.dispatchEvent(new Event("update"));
    throw new Error("not implemented");
  }

  disconnectedCallback() {
    this.observer.disconnect();
  }

  static get observedAttributes() {
    return ["src"];
  }
}
