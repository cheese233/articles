import { parseJsDoc } from "../shared/jsdoc.js";

/** @typedef {import("vfile").VFile} VFile */
/** @typedef {import("../shared/types.ts").ParsedMeta} ParsedMeta */

/** Language root: parses JSDoc only, never mounts and has no compile step. */
export default class JavaScript {
  /** @param {VFile} file @returns {Promise<ParsedMeta>} */
  static async parse(file) {
    return parseJsDoc(String(file));
  }
}
