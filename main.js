import { animate } from "https://esm.sh/animejs@4";
import { render } from "https://esm.sh/preact@10";
import { html } from "https://esm.sh/htm@3/preact";

/**
 * # 主页
 * @routable
 * @hidden
 * @author cheese233
 * @param {HTMLElement} main
 */
export default function (main) {
  main.replaceChildren();
  function mainCard(props) {
    return html`<div
      class="acrylic"
      style="
        pointer-events: auto;
        border-radius: 8px;
        padding: 8px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
        "
    >
      ${props.children}
    </div>`;
  }
  function fluentWindow(props) {
    const THRESHOLD = 15;

    const hover = (el) => {
      if (!el) return;

      const motionMatchMedia = window.matchMedia("(prefers-reduced-motion)");
      if (motionMatchMedia.matches) return;

      el.addEventListener("mousemove", (e) => {
        const { clientX, clientY, currentTarget } = e;
        const { clientWidth, clientHeight } = currentTarget;
        const offsetLeft = currentTarget.getBoundingClientRect().left;
        const offsetTop = currentTarget.getBoundingClientRect().top;

        const horizontal = (clientX - offsetLeft) / clientWidth;
        const vertical = (clientY - offsetTop) / clientHeight;
        const rotateX = (THRESHOLD / 2 - horizontal * THRESHOLD).toFixed(2);
        const rotateY = (vertical * THRESHOLD - THRESHOLD / 2).toFixed(2);

        animate(el, {
          transform: [
            `perspective(${clientWidth}px) rotateX(${rotateY}deg) rotateY(${rotateX}deg)`,
          ],
          duration: 300,
          easing: "inCirc",
        });
      });

      el.addEventListener("mouseleave", (e) => {
        animate(el, {
          transform: [
            `perspective(${e.currentTarget.clientWidth}px) rotateX(0deg) rotateY(0deg)`,
          ],
          duration: 500,
          easing: "outElastic",
        });
      });
    };

    return html`
      <div
        ref=${hover}
        style="border-radius: 8px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
          border: 1px solid rgba(255, 255, 255, 0.18);
          transform-style: preserve-3d;
          background: #fff;"
      >
        <div style="padding: 16px">${props.children}</div>
      </div>
    `;
  }

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
          padding-bottom: 1rem"
        >
          233 lines · 1000 Bytes
        </div>
        <div
          style="border-radius: .375rem .375rem 0 0;
              line-height: 1.5;
              background-color: var(--background-color);
              border: var(--border);
              padding: .5rem;
              display: flex;
              justify-content: space-between;
              align-items: center"
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
            <span style="padding: 2px 12px">Blame</span>
          </span>
          <span style="color: var(--foreground-color); padding: 0 4px">⋯</span>
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
    html`
    <style>
        header {
            display: none !important;
        }
        nav {
            display: none !important;
        }
        #hero {
            padding-top: 6rem;
        }
        #main-container {
            padding-left: 32px;
        }
        @media (max-width: 300px) {
            #main-container {
                padding-left: 0;
            }
        }
        @media (max-width: 768px) {
            #hero {
                padding-top: 2rem;
            }
        }
    </style>
    <div style="display: grid;
        width: 100%;
        height:100%;
        overflow-x: hidden;
        position: relative;
        box-sizing: border-box;" id="hero">

        <div style="
            grid-area: 1 / 1;
            width: max(40%, 300px);
            z-index: 1;
            position: relative;
            padding-top: 2rem;
            pointer-events: none;
        " id="main-container">
            <${mainCard}>
                <h1 style="margin-top: 0">hi</h1>
                <p>under construction...</p>
            </${mainCard}>
        </div>

        <div style="
            grid-area: 1 / 1;
            width: 90%;
            margin-left: 30%;
            z-index: 0;
        ">
            <${fluentWindow}>
                <${ghLikeCodeCard}>

                </${ghLikeCodeCard}>
            </${fluentWindow}>
        </div>

    </div>`,
    main,
  );
}
