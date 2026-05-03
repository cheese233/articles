import { Loader as BaseLoader } from "./base_loader.js";

export class Loader extends BaseLoader {
  async attributeChangedCallback(name, _, val) {
    if (name == "src") await this.update(undefined, val);
  }
  /**
   * @param {string | undefined} content
   * @param {string | undefined} src
   */
  async update(content, src) {
    if (!src)
      src = `data:text/javascript;base64,${btoa(unescape(encodeURIComponent(content)))}`;
    await (await import(src)).default(this.shadow);
    this.dispatchEvent(new Event("update"));
  }
}
