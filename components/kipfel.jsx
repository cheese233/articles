import {
  Box3,
  CanvasTexture,
  Color,
  DirectionalLight,
  HemisphereLight,
  LinearFilter,
  Matrix3,
  NearestFilter,
  PerspectiveCamera,
  RenderPipeline,
  Scene,
  Timer,
  Vector2,
  Vector3,
  WebGPURenderer,
} from "three/webgpu";
import {
  Fn,
  If,
  Loop,
  abs,
  atan,
  cbrt,
  clamp,
  cos,
  dot,
  float,
  floor,
  fract,
  int,
  luminance,
  mat3,
  max,
  mix,
  pass,
  pow,
  round,
  rtt,
  sin,
  sqrt,
  texture,
  uniform,
  uniformArray,
  uv,
  vec2,
  vec3,
  vec4,
} from "three/tsl";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";

/**
 * ASCII post-processing after https://alexharri.com/blog/ascii-rendering:
 * every grid cell samples the scene with six sampling circles, the resulting
 * shape vector is contrast-enhanced and matched against the shape vectors of
 * the glyphs in a runtime atlas, so characters follow contours instead of
 * acting as pixels. Glyph colors are shaped in OKLCH toward the gold palette.
 */

const modelUrl = "/components/kipfel/model/Kipfel_Mobile_1.1.0_opti.glb";
const font = '600 {size}px ui-monospace, "Cascadia Code", monospace';

/** Printable ASCII, space first. */
const glyphs = Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i));

/** Cell size in CSS pixels; roughly a monospace character. */
const cell = { width: 6, height: 11 };

/** Atlas glyph size in pixels; sampled linearly when drawn. */
const atlasCell = { width: 24, height: 44 };

/**
 * Six sampling circles in a staggered 2x3 grid (cell space, y down). The
 * left column sits slightly higher than the right one, as in the article.
 */
const circles = [
  [0.3, 0.18], [0.7, 0.24],
  [0.3, 0.48], [0.7, 0.54],
  [0.3, 0.78], [0.7, 0.84],
];
const circleRadius = 0.2;

/** Sample points per circle in the shader, relative to its radius. */
const taps = [[0, 0], [0.6, 0], [-0.6, 0], [0, 0.6], [0, -0.6]];

/** Global contrast exponent applied to normalized sampling vectors. */
const contrast = 2.2;

/** Gold hue in OKLCH (from #f5bc6f / #805611), in radians. */
const goldHue = (75 / 180) * Math.PI;

const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const darkScheme = matchMedia("(prefers-color-scheme: dark)");

/**
 * Draw every glyph into one row and measure each glyph's overlap with the
 * sampling circles. Components are normalized per dimension so the vectors
 * span the same 0..1 range as the sampling vectors.
 */
const buildAtlas = () => {
  const canvas = document.createElement("canvas");
  canvas.width = atlasCell.width * glyphs.length;
  canvas.height = atlasCell.height;

  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("kipfel: no 2d context");

  context.fillStyle = "#fff";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = font.replace("{size}", String(atlasCell.height * 0.78));
  glyphs.forEach((glyph, index) => {
    context.fillText(
      glyph,
      (index + 0.5) * atlasCell.width,
      atlasCell.height * 0.54,
    );
  });

  const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
  const radius = circleRadius * atlasCell.width;
  const vectors = glyphs.map((_, index) =>
    circles.map(([cx, cy]) => {
      const x0 = (index + cx) * atlasCell.width;
      const y0 = cy * atlasCell.height;
      let inside = 0;
      let total = 0;

      for (let y = Math.floor(y0 - radius); y <= y0 + radius; y++) {
        for (let x = Math.floor(x0 - radius); x <= x0 + radius; x++) {
          if ((x - x0) ** 2 + (y - y0) ** 2 > radius ** 2) continue;
          total++;
          inside += (data[(y * canvas.width + x) * 4 + 3] ?? 0) / 255;
        }
      }

      return total ? inside / total : 0;
    }));

  const peak = circles.map((_, i) =>
    Math.max(...vectors.map((vector) => vector[i] ?? 0), 1e-6));
  const normalized = vectors.map((vector) =>
    vector.map((value, i) => value / (peak[i] ?? 1)));

  const atlas = new CanvasTexture(canvas);
  atlas.minFilter = LinearFilter;
  atlas.magFilter = LinearFilter;
  atlas.generateMipmaps = false;

  return { atlas, vectors: normalized };
};

/**
 * TSL builds numeric matrices through Matrix3.set, which is row-major; the
 * OKLab tables below are written column by column, as in GLSL.
 * @param {number[]} values
 */
const columns = (...values) =>
  mat3(new Matrix3().fromArray(values));

/** Linear sRGB -> OKLab (Björn Ottosson). */
const toLms = columns(
  0.4122214708, 0.2119034982, 0.0883024619,
  0.5363325363, 0.6806995451, 0.2817188376,
  0.0514459929, 0.1073969566, 0.6299787005,
);
const lmsToLab = columns(
  0.2104542553, 1.9779984951, 0.0259040371,
  0.7936177850, -2.4285922050, 0.7827717662,
  -0.0040720468, 0.4505937099, -0.8086757660,
);
const labToLms = columns(
  1, 1, 1,
  0.3963377774, -0.1055613458, -0.0894841775,
  0.2158037573, -0.0638541728, -1.2914855480,
);
const fromLms = columns(
  4.0767416621, -1.2684380046, -0.0041960863,
  -3.3077115913, 2.6097574011, -0.7034186147,
  0.2309699292, -0.3413193965, 1.7076147010,
);

/**
 * Convert to OKLCH, quantize and boost lightness/chroma, pull the hue toward
 * gold, then return linear sRGB.
 */
const goldTone = Fn(([rgb, lightRange]) => {
  const lab = lmsToLab.mul(cbrt(toLms.mul(rgb)));
  const lightness = clamp(lab.x.mul(1.25), 0, 1);
  const chroma = sqrt(dot(lab.yz, lab.yz));
  const hue = atan(lab.z, lab.y);

  const steps = float(5);
  const level = floor(lightness.mul(steps)).add(0.5).div(steps);
  const outL = mix(lightRange.x, lightRange.y, level);
  const outC = clamp(floor(chroma.mul(1.6).add(0.06).mul(20)).div(20), 0.05, 0.16);
  const delta = atan(sin(float(goldHue).sub(hue)), cos(float(goldHue).sub(hue)));
  const outH = hue.add(delta.mul(0.7));

  const lms = labToLms.mul(vec3(outL, outC.mul(cos(outH)), outC.mul(sin(outH))));
  return clamp(fromLms.mul(lms.mul(lms).mul(lms)), 0, 1);
});

/**
 * @param {WebGPURenderer} renderer
 * @param {Scene} scene
 * @param {PerspectiveCamera} camera
 */
const createAscii = (renderer, scene, camera) => {
  const { atlas, vectors } = buildAtlas();
  const grid = uniform(new Vector2(1, 1));
  const lightRange = uniform(new Vector2(0.36, 0.6));
  const first = uniformArray(vectors.map((v) => new Vector3(v[0], v[1], v[2])));
  const second = uniformArray(vectors.map((v) => new Vector3(v[3], v[4], v[5])));

  const scenePass = pass(scene, camera);
  const sceneColor = scenePass.getTextureNode();

  // Pass 1: one fragment per cell. Output: glyph index + average color.
  const cellNode = Fn(() => {
    const center = uv();
    const cellSize = vec2(1).div(grid);
    /** @type {any[]} */
    const lightness = [];
    const color = vec3(0).toVar();

    for (const [cx, cy] of circles) {
      const sum = float(0).toVar();
      for (const [tx, ty] of taps) {
        // Cell space is y down, texture uv is y up.
        const local = vec2(
          cx + tx * circleRadius - 0.5,
          0.5 - (cy + ty * circleRadius * (cell.width / cell.height)),
        );
        const sample = sceneColor.sample(center.add(local.mul(cellSize)));
        const value = sqrt(luminance(sample.rgb)).mul(sample.a);
        sum.addAssign(value);
        color.addAssign(sample.rgb);
      }
      lightness.push(sum.div(taps.length));
    }

    const a = vec3(lightness[0], lightness[1], lightness[2]).toVar();
    const b = vec3(lightness[3], lightness[4], lightness[5]).toVar();

    // Contrast enhancement: normalize by the largest component, raise to
    // an exponent and scale back, which sharpens edges inside the cell.
    const peak = max(max(a.x, max(a.y, a.z)), max(b.x, max(b.y, b.z)));
    If(peak.greaterThan(1e-4), () => {
      a.assign(pow(a.div(peak), vec3(contrast)).mul(peak));
      b.assign(pow(b.div(peak), vec3(contrast)).mul(peak));
    });

    const best = float(0).toVar();
    const bestDistance = float(1e9).toVar();
    Loop(glyphs.length, ({ i }) => {
      const da = first.element(i).sub(a);
      const db = second.element(i).sub(b);
      const distance = dot(da, da).add(dot(db, db));
      If(distance.lessThan(bestDistance), () => {
        bestDistance.assign(distance);
        best.assign(float(i));
      });
    });

    return vec4(best, color.div(circles.length * taps.length));
  })();

  const cells = rtt(cellNode, 1, 1, {
    minFilter: NearestFilter,
    magFilter: NearestFilter,
  });

  // Pass 2: per pixel, draw the cell's glyph from the atlas.
  const output = Fn(() => {
    const position = uv().mul(grid);
    const cellUv = floor(position).add(0.5).div(grid);
    const data = cells.sample(cellUv);
    const index = round(data.x);
    const local = fract(position);
    const glyphUv = vec2(index.add(local.x).div(glyphs.length), local.y);
    const mask = texture(atlas, glyphUv).a;
    const tone = goldTone(data.yzw, lightRange);
    return vec4(tone.mul(mask), mask);
  })();

  const pipeline = new RenderPipeline(renderer, output);

  /** @param {number} width @param {number} height */
  const resize = (width, height) => {
    const columns = Math.max(1, Math.floor(width / cell.width));
    const rows = Math.max(1, Math.floor(height / cell.height));
    grid.value.set(columns, rows);
    cells.setSize(columns, rows);
  };

  const setScheme = () => {
    lightRange.value.set(...(darkScheme.matches ? [0.68, 0.9] : [0.36, 0.6]));
  };
  setScheme();

  return {
    pipeline,
    resize,
    setScheme,
    dispose: () => {
      pipeline.dispose();
      cells.dispose();
      scenePass.dispose();
      atlas.dispose();
    },
  };
};

/** @param {Scene} scene */
const loadModel = async (scene) => {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.loadAsync(modelUrl);
  const model = gltf.scene;

  // The model ships hundreds of morph targets; three packs them into one
  // array texture that exceeds WebGPU's default 256 layer limit. They are
  // never animated here, so drop them.
  model.traverse((object) => {
    const mesh = /** @type {import("three/webgpu").Mesh} */ (object);
    if (!mesh.isMesh) return;
    mesh.geometry.morphAttributes = {};
    mesh.morphTargetInfluences = undefined;
    mesh.morphTargetDictionary = undefined;
  });

  // Center the model and scale it to a unit-ish size.
  const box = new Box3().setFromObject(model);
  const size = box.getSize(new Vector3());
  const center = box.getCenter(new Vector3());
  const scale = 1 / Math.max(size.x, size.y, size.z, 1e-6);
  model.position.sub(center.multiplyScalar(scale));
  model.scale.setScalar(scale);

  const pivot = new Scene();
  pivot.add(model);
  scene.add(pivot);
  return pivot;
};

/**
 * # kipfel
 * @hidden
 * @author cheese233
 * @param {ShadowRoot} shadow
 */
export default async function (shadow) {
  const host = /** @type {HTMLElement} */ (shadow.host);
  const canvas = document.createElement("canvas");
  canvas.className = "kipfel";
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", "ASCII kipfel");

  const style = document.createElement("link");
  style.rel = "stylesheet";
  style.href = "/components/kipfel.css";

  const renderer = new WebGPURenderer({ canvas, alpha: true, antialias: false });
  renderer.setClearColor(new Color(0x000000), 0);
  renderer.setPixelRatio(1);
  await renderer.init();

  const scene = new Scene();
  scene.add(new HemisphereLight(0xfff4e0, 0x3a2a18, 2.2));
  const sun = new DirectionalLight(0xffffff, 2.6);
  sun.position.set(1.5, 2, 2.5);
  scene.add(sun);

  const camera = new PerspectiveCamera(32, 2, 0.01, 20);
  camera.position.set(0, 0.35, 2);
  camera.lookAt(0, 0, 0);

  const ascii = createAscii(renderer, scene, camera);
  const pivot = await loadModel(scene);
  pivot.rotation.set(0.25, -0.6, 0);

  const timer = new Timer();
  let isDirty = true;
  let wasConnected = false;

  const resize = () => {
    const width = Math.max(1, canvas.clientWidth);
    const height = Math.max(1, canvas.clientHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    ascii.resize(width, height);
    isDirty = true;
  };
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);

  const onScheme = () => {
    ascii.setScheme();
    isDirty = true;
  };
  darkScheme.addEventListener("change", onScheme);

  const dispose = () => {
    renderer.setAnimationLoop(null);
    observer.disconnect();
    darkScheme.removeEventListener("change", onScheme);
    ascii.dispose();
    scene.traverse((object) => {
      const mesh = /** @type {any} */ (object);
      mesh.geometry?.dispose?.();
      for (const material of [mesh.material].flat()) material?.dispose?.();
    });
    renderer.dispose();
  };

  renderer.setAnimationLoop((time) => {
    // The shim has no disconnect hook for content; poll the canvas instead.
    if (canvas.isConnected) {
      wasConnected = true;
    } else {
      if (wasConnected) dispose();
      return;
    }

    timer.update(time);
    if (!reducedMotion.matches) {
      pivot.rotation.y += timer.getDelta() * 0.35;
      isDirty = true;
    }
    if (!isDirty) return;
    isDirty = false;
    ascii.pipeline.render();
  });

  host.dataset.renderer = renderer.backend.isWebGPUBackend ? "webgpu" : "webgl";
  return [style, canvas];
}
