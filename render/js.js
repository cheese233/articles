import { Loader as BaseLoader } from "./base_loader.js";

export class Loader extends BaseLoader {
  async attributeChangedCallback(name, _, val) {
    if (!this.shadow) return;
    if (name == "src") await this.update(undefined, val);
  }
  /**
   * @param {string | undefined} content
   * @param {string | undefined} src
   */
  async update(content, src) {
    if (!src)
      src = `data:text/javascript;base64,${btoa(unescape(encodeURIComponent(content)))}`;
    try {
      await (await import(src)).default(this.shadow);
      this.dispatchEvent(new Event("update"));
    } catch (e) {
      console.error(e);
      this.dispatchEvent(new Event("error"));
    }
  }
}
