import { gsap } from "https://esm.sh/gsap@3";
import { render } from "https://esm.sh/preact@10";
import { html } from "https://esm.sh/htm@3/preact";

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
