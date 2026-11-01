import { parseJsDoc } from "../shared/jsdoc.js";

/** @typedef {import("vfile").VFile} VFile */
/** @typedef {import("../shared/types.ts").ParsedMeta} ParsedMeta */

export default class JavaScript {
  /** @param {VFile} file @returns {Promise<ParsedMeta>} */
  static async parse(file) {
    return parseJsDoc(String(file));
  }

  /**
   * @param {{ Adapter?: import("../render/lib/adapters.ts").LoaderConstructor }} child
   */
  static Adapter = (child) => child.Adapter;
}
