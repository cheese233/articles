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
      <div>
        <div>
          <span style="font-family: monospace;color: var(--secondary-color)"
          >233 lines · 1000 Bytes</span>
        </div>
      </div>
    `,
    main,
  );
}
