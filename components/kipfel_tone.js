/**
 * Glyph lightness range for the ASCII shader, derived from the panel
 * background so every glyph color the shader can emit keeps a minimum WCAG
 * contrast. The math mirrors `goldTone` in components/kipfel.jsx: OKLCH with
 * the hue clamped to a band around gold, then clamped linear sRGB.
 */

/** Gold hue in OKLCH (from #f5bc6f / #805611), in radians. */
export const goldHue = (75 / 180) * Math.PI;

/** Chroma bounds the shader clamps to. */
export const chromaRange = [0.05, 0.16];

/**
 * Glyphs are 6x11 px with anti-aliased strokes, so their effective contrast
 * is lower than solid text; aim for the AAA text ratio on the weakest one.
 */
export const minContrast = 7;

/**
 * Widest lightness span for the shader's quantized levels; it shrinks when
 * a wider range would drop below `minContrast`.
 */
const span = 0.28;

/** OKLCH lightness extremes that still render as gold, not white/black. */
const lightest = 0.96;
const darkest = 0.18;

/** Widest hue offset from gold the shader emits, in radians. */
export const hueSpread = 0.3 * Math.PI;

/** @param {number} c */
const clamp01 = (c) => Math.min(1, Math.max(0, c));

/**
 * OKLCH -> clamped linear sRGB (Björn Ottosson).
 * @param {number} l @param {number} c @param {number} h
 * @returns {[number, number, number]}
 */
export const oklchToLinear = (l, c, h) => {
  const a = c * Math.cos(h);
  const b = c * Math.sin(h);
  const lms = [
    l + 0.3963377774 * a + 0.2158037573 * b,
    l - 0.1055613458 * a - 0.0638541728 * b,
    l - 0.0894841775 * a - 1.291485548 * b,
  ].map((v) => v ** 3);
  const [x = 0, y = 0, z = 0] = lms;
  return [
    clamp01(4.0767416621 * x - 3.3077115913 * y + 0.2309699292 * z),
    clamp01(-1.2684380046 * x + 2.6097574011 * y - 0.3413193965 * z),
    clamp01(-0.0041960863 * x - 0.7034186147 * y + 1.707614701 * z),
  ];
};

/** @param {number} channel 0..255 sRGB */
const linearize = (channel) => {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

/** @param {[number, number, number]} rgb linear */
const luminance = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/** @param {number} a @param {number} b relative luminances */
export const contrast = (a, b) =>
  (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

/** Every hue/chroma the shader may emit at lightness `l`. */
const worstContrast = (/** @type {number} */ l, /** @type {number} */ bg) => {
  let worst = Infinity;
  for (const c of chromaRange) {
    for (let step = -4; step <= 4; step++) {
      const h = goldHue + (step / 4) * hueSpread;
      worst = Math.min(worst, contrast(luminance(oklchToLinear(l, c, h)), bg));
    }
  }
  return worst;
};

/**
 * @param {[number, number, number]} background 0..255 sRGB
 * @returns {[number, number]} lightness range, low to high
 */
export const lightRangeFor = (background) => {
  const [r = 0, g = 0, b = 0] = background;
  const bg = 0.2126 * linearize(r) + 0.7152 * linearize(g) +
    0.0722 * linearize(b);
  // Light glyphs on dark panels, dark glyphs on light ones: whichever end
  // of the lightness axis has more headroom.
  const isDark = worstContrast(lightest, bg) > worstContrast(darkest, bg);
  const steps = 200;

  // Grow toward the panel from the far extreme while the weakest glyph
  // still clears the bar; the extreme itself is the best possible.
  if (isDark) {
    let low = lightest;
    for (let i = 0; i <= steps; i++) {
      const l = lightest - ((lightest - darkest) * i) / steps;
      if (worstContrast(l, bg) < minContrast) break;
      low = l;
    }
    return [Math.max(low, lightest - span), lightest];
  }

  let high = darkest;
  for (let i = 0; i <= steps; i++) {
    const l = darkest + ((lightest - darkest) * i) / steps;
    if (worstContrast(l, bg) < minContrast) break;
    high = l;
  }
  return [darkest, Math.min(high, darkest + span)];
};

/**
 * Whether a range from `lightRangeFor` draws glyphs lighter than the panel.
 * The shader then maps bright scene areas to dense glyphs; otherwise dark
 * areas get the dense glyphs, since the ink itself is dark.
 * @param {[number, number]} range
 */
export const isLightInk = ([low, high]) => low + high > 1;

/** Best weakest-glyph contrast the shader can reach on `background`. */
export const bestContrast = (/** @type {[number, number, number]} */ background) => {
  const [r = 0, g = 0, b = 0] = background;
  const bg = 0.2126 * linearize(r) + 0.7152 * linearize(g) +
    0.0722 * linearize(b);
  return Math.max(worstContrast(lightest, bg), worstContrast(darkest, bg));
};

/** Parse any computed CSS color to 0..255 sRGB + alpha via a 1x1 canvas. */
const toRgba = (/** @type {string} */ color) => {
  const context = new OffscreenCanvas(1, 1).getContext("2d");
  if (!context) return [255, 255, 255, 0];
  context.clearRect(0, 0, 1, 1);
  context.fillStyle = color;
  context.fillRect(0, 0, 1, 1);
  return [...context.getImageData(0, 0, 1, 1).data];
};

/**
 * Effective background behind an element: the first opaque
 * `background-color` up the composed tree (crossing shadow roots), so the
 * component follows whatever panel it is embedded in.
 * @param {Element} element
 * @returns {[number, number, number]}
 */
export const backgroundOf = (element) => {
  /** @type {Element | null} */
  let node = element;
  while (node) {
    const [r = 0, g = 0, b = 0, a = 0] = toRgba(
      getComputedStyle(node).backgroundColor,
    );
    if (a >= 250) return [r, g, b];

    const root = node.getRootNode();
    node = node.parentElement ??
      (root instanceof ShadowRoot ? root.host : null);
  }
  return matchMedia("(prefers-color-scheme: dark)").matches
    ? [0, 0, 0]
    : [255, 255, 255];
};
