import { animate } from "https://esm.sh/animejs@4";
import { render } from "https://esm.sh/preact";
import { html } from "https://esm.sh/htm/preact";

/**
 * # 主页
 * @routable
 * @author cheese233
 * @param {HTMLElement} main
 */
export function homepage(main) {
  main.replaceChildren();
  render(
    html`
      <h1>hi</h1>
    `,
    main,
  );
}
