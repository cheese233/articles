import { VFile as VFileCtor } from "vfile";
import HtmlFactory from "./html.ext.pages.js";

/** @typedef {import("vfile").VFile} VFile */
/** @typedef {import("../shared/types.ts").AdapterStatics} AdapterStatics */
/** @typedef {import("../shared/types.ts").ParsedMeta} ParsedMeta */

/** @type {AdapterStatics} */
export const meta = Object.freeze({
  ext: "json",
  lang: "html",
  priority: 25,
});

const escape = (/** @type {string} */ value) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** @param {VFile} file @returns {Promise<ParsedMeta>} */
export const parse = async (file) => {
  const data = JSON.parse(String(file));
  return {
    title: data.title,
    date: data.date,
    summary: data.summary,
    routable: data.routable !== false,
  };
};

/**
 * A multi-level adapter: json -> html -> pages -> js.
 *
 * @param {VFile} file
 */
const factory = (file) => (/** @type {ShadowRoot} */ shadow) => {
  const data = JSON.parse(String(file));
  const html = new VFileCtor({
    path: file.path,
    value: `<h1>${escape(String(data.title ?? "JSON"))}</h1>
      <pre>${escape(JSON.stringify(data, null, 2))}</pre>`,
  });

  return HtmlFactory(html)(shadow);
};

factory.meta = meta;

export default factory;
