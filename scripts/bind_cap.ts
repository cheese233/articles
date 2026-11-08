#!/usr/bin/env node

// Binds Kipfel's cap to her cat ears so they never cut through it.
//
// The cap is skinned to Cap.Root only, a child of Head, while the ears it
// covers bend with the KemoEar chains; worse, parts of the ears already
// stick out of the cap shell in the rest pose. Four passes fix that:
//
// 1. Cap: vertices near the ears get ear bones from a field that depends
//    only on the rest position (full weight on the ear's own vertices,
//    fading with distance), the rest stays on Cap.Root. The cap's ear
//    bumps now perk up, flatten and flick with the ears like fabric.
// 2. Ears, rest pose: ear vertices outside the cap shell are pulled back to
//    just under its surface.
// 3. Ears, weights: ear vertices under the cap take the interpolated
//    weights of the cap surface right above them. Points with the same
//    skin weights move together, so the gap from step 2 holds in any pose.
// 4. Hair under the cap takes the cap's ear motion in the same share, so
//    it does not show through where the cap bulges with the ears.
//
// Run once on the output of scripts/optimize_model.ts; the file is marked
// and a second run is refused.

import { NodeIO } from "@gltf-transform/core";
import type { Accessor, Node, Primitive } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder, MeshoptEncoder } from "meshoptimizer";

const [source = "components/kipfel/model/kipfel.glb", target = source] =
  process.argv.slice(2);

/** Field falloff from the ear core, in model units (the model is ~0.84). */
const near = 0.008;
const far = 0.05;
/** Core ear vertices blended per point, so neighbours get similar weights. */
const neighbours = 10;
/** Share of ear-chain weight from which a vertex counts as core. */
const coreShare = 0.98;
/** How far under the cap surface stray ear vertices are pulled. */
const inset = 0.0025;
/** Ear vertices within this distance of the cap follow the cap. */
const reach = 0.035;

const marker = "kipfelCapBound";
const capBone = "Cap.Root";
const sides = ["L", "R"] as const;
const chainOf = (name: string) =>
  /^KemoEar\.([LR])(\.\d+)?$/.exec(name)?.[1];

await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready]);

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    "meshopt.decoder": MeshoptDecoder,
    "meshopt.encoder": MeshoptEncoder,
  });

const document = await io.read(source);
const root = document.getRoot();
const rootExtras = root.getExtras() as Record<string, unknown>;
if (rootExtras[marker]) {
  throw new Error("bind_cap: already bound, run on optimize_model.ts output");
}

const meshes = root.listNodes().filter((node) => node.getMesh());
const find = (name: string) => {
  const node = meshes.find((mesh) => mesh.getName() == name);
  if (!node) throw new Error(`bind_cap: missing ${name}`);
  return node;
};

type Vec3 = [number, number, number];
type Weights = Map<string, number>;

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const addScaled = (a: Vec3, b: Vec3, k: number): Vec3 =>
  [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const length = (a: Vec3) => Math.hypot(a[0], a[1], a[2]);
const normalize = (a: Vec3): Vec3 => {
  const l = length(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

const smoothstep = (low: number, high: number, value: number) => {
  const t = Math.min(1, Math.max(0, (value - low) / (high - low)));
  return t * t * (3 - 2 * t);
};

/** Column-major 4x4 product. */
const multiply = (a: number[], b: number[]) => {
  const out = new Array<number>(16).fill(0);
  for (let column = 0; column < 4; column++) {
    for (let row = 0; row < 4; row++) {
      for (let k = 0; k < 4; k++) {
        out[column * 4 + row] =
          (out[column * 4 + row] ?? 0) +
          (a[k * 4 + row] ?? 0) * (b[column * 4 + k] ?? 0);
      }
    }
  }
  return out;
};

const transform = (m: number[], [x = 0, y = 0, z = 0]: number[]): Vec3 => [
  (m[0] ?? 0) * x + (m[4] ?? 0) * y + (m[8] ?? 0) * z + (m[12] ?? 0),
  (m[1] ?? 0) * x + (m[5] ?? 0) * y + (m[9] ?? 0) * z + (m[13] ?? 0),
  (m[2] ?? 0) * x + (m[6] ?? 0) * y + (m[10] ?? 0) * z + (m[14] ?? 0),
];

/** Inverse of an affine column-major 4x4. */
const invert = (m: number[]) => {
  const [a = 0, b = 0, c = 0, , d = 0, e = 0, f = 0, , g = 0, h = 0, i = 0] = m;
  const det = a * (e * i - f * h) - d * (b * i - c * h) + g * (b * f - c * e);
  const r = [
    (e * i - f * h) / det, (c * h - b * i) / det, (b * f - c * e) / det,
    (f * g - d * i) / det, (a * i - c * g) / det, (c * d - a * f) / det,
    (d * h - e * g) / det, (b * g - a * h) / det, (a * e - b * d) / det,
  ];
  const t: Vec3 = [m[12] ?? 0, m[13] ?? 0, m[14] ?? 0];
  const out = [
    r[0] ?? 0, r[1] ?? 0, r[2] ?? 0, 0,
    r[3] ?? 0, r[4] ?? 0, r[5] ?? 0, 0,
    r[6] ?? 0, r[7] ?? 0, r[8] ?? 0, 0,
    0, 0, 0, 1,
  ];
  const moved = transform(out, t);
  out[12] = -moved[0];
  out[13] = -moved[1];
  out[14] = -moved[2];
  return out;
};

/** A skinned primitive with rest positions and editable influences. */
const open = (node: Node) => {
  const skin = node.getSkin();
  const primitive: Primitive | undefined = node.getMesh()?.listPrimitives()[0];
  const joint = skin?.listJoints()[0];
  const inverse = skin?.getInverseBindMatrices();
  const position = primitive?.getAttribute("POSITION");
  const joints = primitive?.getAttribute("JOINTS_0");
  const weights = primitive?.getAttribute("WEIGHTS_0");
  if (!skin || !primitive || !joint || !inverse || !position || !joints ||
    !weights) {
    throw new Error(`bind_cap: ${node.getName()} is not skinned`);
  }
  const names = skin.listJoints().map((bone) => bone.getName());
  const index = new Map(names.map((name, i) => [name, i]));
  // Any joint maps bind space to the rest pose.
  const bind = multiply(joint.getWorldMatrix(), inverse.getElement(0, []));
  const unbind = invert(bind);

  const count = position.getCount();
  const positions = Array.from({ length: count }, (_, i) =>
    transform(bind, position.getElement(i, [])));
  const influences = Array.from({ length: count }, (_, i) => {
    const bone = joints.getElement(i, []);
    const weight = weights.getElement(i, []);
    const out: Weights = new Map();
    bone.forEach((joint, k) => {
      const name = names[joint];
      const value = weight[k] ?? 0;
      if (name && value > 0) out.set(name, (out.get(name) ?? 0) + value);
    });
    return out;
  });

  /** Write up to four influences, quantized to bytes summing to 255. */
  const write = (i: number, next: Weights) => {
    const top = [...next]
      .filter(([name, value]) => value > 1e-4 && index.has(name))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);
    const total = top.reduce((sum, [, value]) => sum + value, 0);
    const bytes = top.map(([, value]) => Math.round((value / total) * 255));
    bytes[0] = (bytes[0] ?? 0) + 255 - bytes.reduce((sum, b) => sum + b, 0);
    const bone = [0, 0, 0, 0];
    const weight = [0, 0, 0, 0];
    top.forEach(([name], k) => {
      bone[k] = index.get(name) ?? 0;
      weight[k] = (bytes[k] ?? 0) / 255;
    });
    joints.setElement(i, bone);
    weights.setElement(i, weight);
    influences[i] = new Map(top.map(([name], k) => [name, weight[k] ?? 0]));
  };

  /** Move a vertex in rest space. */
  const move = (i: number, to: Vec3) => {
    (position as Accessor).setElement(i, transform(unbind, to));
    positions[i] = to;
  };

  return { primitive, positions, influences, write, move };
};

const chainShare = (weights: Weights, side: string) => {
  let share = 0;
  for (const [name, value] of weights) if (chainOf(name) == side) share += value;
  return share;
};
const earShare = (weights: Weights) =>
  Math.max(...sides.map((side) => chainShare(weights, side)));

const body = open(find("Body"));
const cap = open(find("Outfit_Mobile"));

// --- 1. the cap follows the ears -------------------------------------------

const core = new Map(sides.map((side) => [side, body.positions.flatMap(
  (position, i) => {
    const weights = body.influences[i] ?? new Map();
    const share = chainShare(weights, side);
    if (share < coreShare) return [];
    const split: Weights = new Map();
    for (const [name, value] of weights) {
      if (chainOf(name) == side) split.set(name, value / share);
    }
    return [{ position, split }];
  },
)]));

/** Ear field at a rest position: how much it follows, and which bones. */
const field = (position: Vec3) => {
  let best: { d: number; split: Weights }[] = [];
  for (const side of sides) {
    const nearest = (core.get(side) ?? [])
      .map((vertex) => ({
        d: length(sub(vertex.position, position)),
        split: vertex.split,
      }))
      .sort((a, b) => a.d - b.d)
      .slice(0, neighbours);
    if (!best.length || (nearest[0]?.d ?? Infinity) < (best[0]?.d ?? Infinity)) {
      best = nearest;
    }
  }
  const follow = 1 - smoothstep(near, far, best[0]?.d ?? Infinity);
  const split: Weights = new Map();
  let total = 0;
  for (const { d, split: weights } of best) {
    const k = 1 / (d + 0.003) ** 2;
    total += k;
    for (const [name, value] of weights) {
      split.set(name, (split.get(name) ?? 0) + value * k);
    }
  }
  for (const [name, value] of split) split.set(name, value / total);
  return { follow, split };
};

let capCount = 0;
cap.influences.forEach((weights, i) => {
  const pool = weights.get(capBone) ?? 0;
  if (pool < 1e-3) return;
  const { follow, split } = field(cap.positions[i] ?? [0, 0, 0]);
  const next: Weights = new Map(
    [...weights].filter(([name]) => name != capBone),
  );
  next.set(capBone, pool * (1 - follow));
  for (const [name, value] of split) {
    next.set(name, (next.get(name) ?? 0) + pool * follow * value);
  }
  cap.write(i, next);
  if (follow > 0.01) capCount++;
});

// --- the cap shell ---------------------------------------------------------

const indices = cap.primitive.getIndices()?.getArray();
if (!indices) throw new Error("bind_cap: cap has no indices");
/** Triangles of the cap itself (not shirt, boots, ...), with normals. */
const shell: { v: [number, number, number]; normal: Vec3 }[] = [];
const capNormals = cap.primitive.getAttribute("NORMAL");
for (let t = 0; t < indices.length; t += 3) {
  const v: [number, number, number] =
    [indices[t] ?? 0, indices[t + 1] ?? 0, indices[t + 2] ?? 0];
  const isCap = v.every((i) => {
    const weights = cap.influences[i] ?? new Map();
    let share = 0;
    for (const [name, value] of weights) {
      if (name == capBone || chainOf(name)) share += value;
    }
    return share > 0.5;
  });
  if (!isCap) continue;
  const [a, b, c] = v.map((i) => cap.positions[i] ?? [0, 0, 0]) as
    [Vec3, Vec3, Vec3];
  let normal = normalize(cross(sub(b, a), sub(c, a)));
  // Orient by the authored vertex normals (outward).
  const authored = capNormals?.getElement(v[0], []) as Vec3 | undefined;
  if (authored && dot(normal, authored) < 0) {
    normal = [-normal[0], -normal[1], -normal[2]];
  }
  shell.push({ v, normal });
}

/** Closest point on triangle abc to p, with barycentric weights. */
const closest = (p: Vec3, a: Vec3, b: Vec3, c: Vec3) => {
  // Ericson, Real-Time Collision Detection 5.1.5.
  const ab = sub(b, a);
  const ac = sub(c, a);
  const ap = sub(p, a);
  const d1 = dot(ab, ap);
  const d2 = dot(ac, ap);
  if (d1 <= 0 && d2 <= 0) return { q: a, w: [1, 0, 0] };
  const bp = sub(p, b);
  const d3 = dot(ab, bp);
  const d4 = dot(ac, bp);
  if (d3 >= 0 && d4 <= d3) return { q: b, w: [0, 1, 0] };
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) {
    const v = d1 / (d1 - d3);
    return { q: addScaled(a, ab, v), w: [1 - v, v, 0] };
  }
  const cp = sub(p, c);
  const d5 = dot(ab, cp);
  const d6 = dot(ac, cp);
  if (d6 >= 0 && d5 <= d6) return { q: c, w: [0, 0, 1] };
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) {
    const w = d2 / (d2 - d6);
    return { q: addScaled(a, ac, w), w: [1 - w, 0, w] };
  }
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
    const w = (d4 - d3) / ((d4 - d3) + (d5 - d6));
    return { q: addScaled(b, sub(c, b), w), w: [0, 1 - w, w] };
  }
  const denom = 1 / (va + vb + vc);
  const v = vb * denom;
  const w = vc * denom;
  return { q: addScaled(addScaled(a, ab, v), ac, w), w: [1 - v - w, v, w] };
};

/** Nearest cap surface point: position, normal, distance, vertex weights. */
const nearestShell = (p: Vec3) => {
  let best = { d: Infinity, q: p, normal: [0, 0, 1] as Vec3,
    v: [0, 0, 0] as number[], w: [1, 0, 0] as number[] };
  for (const tri of shell) {
    const [a, b, c] = tri.v.map((i) => cap.positions[i] ?? [0, 0, 0]) as
      [Vec3, Vec3, Vec3];
    const { q, w } = closest(p, a, b, c);
    const d = length(sub(p, q));
    if (d < best.d) best = { d, q, normal: tri.normal, v: tri.v, w };
  }
  return best;
};

// --- 2 + 3. the ears stay under the cap and move with it -------------------

let pulled = 0;
let bound = 0;
body.influences.forEach((weights, i) => {
  if (earShare(weights) <= 0) return;
  const p = body.positions[i] ?? [0, 0, 0];
  let hit = nearestShell(p);
  if (hit.d > reach) return;

  const outside = dot(sub(p, hit.q), hit.normal);
  if (outside > -inset) {
    body.move(i, addScaled(p, hit.normal, -(outside + inset)));
    hit = nearestShell(body.positions[i] ?? p);
    pulled++;
  }

  // Interpolate the cap's (new) weights at the surface point above.
  const next: Weights = new Map();
  hit.v.forEach((vertex, k) => {
    for (const [name, value] of cap.influences[vertex] ?? []) {
      next.set(name, (next.get(name) ?? 0) + value * (hit.w[k] ?? 0));
    }
  });
  // Cap.Root and Head move together; the body is skinned to Head.
  const rigid = next.get(capBone) ?? 0;
  next.delete(capBone);
  next.set("Head", (next.get("Head") ?? 0) + rigid);
  body.write(i, next);
  bound++;
});

// --- 4. hair under the cap moves with it -----------------------------------

// Where the cap now bulges with the ears, the hair under it would stay put
// and show through. It takes the cap's ear motion in the same share, keeping
// its own bones for the rest.
let hair = 0;
body.influences.forEach((weights, i) => {
  if (earShare(weights) > 0) return;
  const p = body.positions[i] ?? [0, 0, 0];
  const hit = nearestShell(p);
  if (hit.d > reach || dot(sub(p, hit.q), hit.normal) > 0) return;
  const ears: Weights = new Map();
  hit.v.forEach((vertex, k) => {
    for (const [name, value] of cap.influences[vertex] ?? []) {
      if (chainOf(name)) {
        ears.set(name, (ears.get(name) ?? 0) + value * (hit.w[k] ?? 0));
      }
    }
  });
  const share = [...ears.values()].reduce((sum, v) => sum + v, 0);
  if (share < 0.01) return;
  const next: Weights = new Map();
  for (const [name, value] of weights) next.set(name, value * (1 - share));
  for (const [name, value] of ears) next.set(name, (next.get(name) ?? 0) + value);
  body.write(i, next);
  hair++;
});

root.setExtras({ ...rootExtras, [marker]: true });
await io.write(target, document);
console.log(
  `${capCount} cap vertices follow the ears;`,
  `${pulled} ear vertices pulled under the cap, ${bound} bound to it;`,
  `${hair} hair vertices follow the cap`,
);
