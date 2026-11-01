import { Card } from "./card.jsx";

/**
 * # JSX fixture
 * @routable
 * @date 2026-10-30
 * @tags ["jsx", "test"]
 * @param {ShadowRoot} shadow
 */
export default function (shadow) {
  const items = ["a", "b"];
  const press = () => shadow.host.setAttribute("data-pressed", "");

  return (
    <>
      <Card title="hello">
        <ul>
          {items.map((item) => <li>{item}</li>)}
        </ul>
        <fluent-button appearance="primary" onClick={press}>
          press
        </fluent-button>
      </Card>
      <html-loader path="/tests/fixtures/inner.html"></html-loader>
    </>
  );
}
