/** @typedef {import("../../render/lib/jsx.ts").Child} Child */

/**
 * Child component imported from another `.jsx` module.
 * @param {{ title: string; children?: Child[] }} props
 */
export const Card = ({ title, children }) => (
  <section className="card" style={{ borderRadius: "8px", "--tint": "gold" }}>
    <h2>{title}</h2>
    {children}
  </section>
);
