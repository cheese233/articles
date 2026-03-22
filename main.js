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
  function ghLikeCodeCard(props) {
    return html`
      <div
        style="--border-color: #d1d9e0;
          --background-color: #f6f8fa;
          --foreground-color: #59636e;
          --shadow: 0 1px 0 0 #1f23280a;
          --border: .0625rem solid var(--border-color);
          font-size: 14px"
      >
        <div
          style="font-family: monospace;
          color: var(--foreground-color);
          font-size: 12px;
          padding-bottom:1rem"
        >
          233 lines · 1000 Bytes
        </div>
        <div
          style="border-radius: .375rem .375rem 0 0;
              line-height: 1.5;
              background-color: var(--background-color);
              border: var(--border);
              padding: .5rem"
        >
          <span
            style="background: #e6eaef;
                  border: var(--border);
                  border-radius: .375rem;
                  display: inline-flex"
          >
            <button
              style="background-color: #fff;
                      margin: -0.0625rem 0 -0.0625rem -0.0625rem;
                      border: var(--border);
                      border-radius: .375rem;
                      line-height: inherit;
                      font-size: inherit;
                      font-weight: 600;
                      padding: 2px 12px 2px 12px"
            >
              Code
            </button>
            <span
              style="line-height: inherit;
                        display: inline-block;
                        font-size: inherit;
                        padding: 2px 12px 2px 12px"
              >Blame
            </span>
          </span>
        </div>
        <div
          style="border: var(--border);
                      border-radius: 0 0 .375rem .375rem;
                      margin-top: -0.0625rem;
                      padding: 8px 8px"
        >
          ${props.children}
        </div>
      </div>
    `;
  }
  render(
    html` <${ghLikeCodeCard} ><pre>111
      111
      111</pre></${ghLikeCodeCard}> `,
    main,
  );
}
