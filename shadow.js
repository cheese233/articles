const key = new URL(import.meta.url).hash.slice(1);
if (!key) throw new Error();
/** @type ShadowRoot */
const shadow = window[key];
export default shadow;
