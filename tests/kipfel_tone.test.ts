import { expect } from "@esm-bundle/chai";
import {
  backgroundOf,
  bestContrast,
  chromaRange,
  contrast,
  goldHue,
  hueSpread,
  lightRangeFor,
  minContrast,
  oklchToLinear,
} from "../components/kipfel_tone.js";

const linearize = (channel: number) => {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

const luminance = ([r, g, b]: number[]) =>
  0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);

/** Weakest contrast over every lightness level, chroma and hue band. */
const weakest = (background: [number, number, number]) => {
  const [low, high] = lightRangeFor(background);
  const bg = luminance(background.map(linearize));
  let worst = Infinity;

  for (let level = 0; level <= 20; level++) {
    const l = low + ((high - low) * level) / 20;
    for (const c of chromaRange) {
      for (let step = -8; step <= 8; step++) {
        const h = goldHue + (step / 8) * hueSpread;
        worst = Math.min(worst, contrast(luminance(oklchToLinear(l, c, h)), bg));
      }
    }
  }
  return worst;
};

describe("kipfel tone", () => {
  // --code-panel in components/home.css, light and dark.
  const panels: Record<string, [number, number, number]> = {
    light: [0xff, 0xff, 0xff],
    dark: [0x15, 0x10, 0x0a],
  };

  for (const [name, color] of Object.entries(panels)) {
    it(`keeps every glyph color at 7:1 on the ${name} panel`, () => {
      expect(weakest(color)).to.be.at.least(minContrast - 0.01);
    });
  }

  it("picks the best side on a mid-tone panel", () => {
    // No gold reaches 7:1 here; the range must sit at the stronger extreme.
    const mid: [number, number, number] = [0x80, 0x70, 0x60];
    expect(weakest(mid)).to.be.at.least(bestContrast(mid) - 0.01);
    expect(bestContrast(mid)).to.be.above(3);
  });

  it("uses dark glyphs on light panels and light glyphs on dark ones", () => {
    const [, lightHigh] = lightRangeFor(panels.light!);
    const [darkLow] = lightRangeFor(panels.dark!);
    expect(lightHigh).to.be.below(0.5);
    expect(darkLow).to.be.above(0.5);
  });

  it("reads the effective background through shadow roots", () => {
    const panel = document.createElement("div");
    panel.style.background = "rgb(21, 16, 10)";
    const host = document.createElement("div");
    const shadow = host.attachShadow({ mode: "open" });
    const inner = document.createElement("span");
    shadow.append(inner);
    panel.append(host);
    document.body.append(panel);

    expect(backgroundOf(inner)).to.deep.equal([21, 16, 10]);
    panel.remove();
  });
});
