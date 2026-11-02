/**
 * Behaviour for the Kipfel avatar, evaluated every frame instead of replayed
 * from clips so it can react to the pointer:
 *
 *   run    jogs in from the far back toward the camera, with a gait cycle
 *   brake  skids to a stop, arms out for balance, ears perk up
 *   peek   leans in; the camera dollies until the head fills the view
 *   watch  curious idle: tilts the head, blinks, eyes and head follow the
 *          pointer, sometimes widens the eyes or lets the mouth fall open
 *
 * `update` returns the bone pose, morph weights, root placement and how
 * close the camera should be. Angles are radians about the rest-pose axes
 * (see components/kipfel_rig.js); the model faces +z.
 */

/** @typedef {import("./kipfel_rig.js").Pose} Pose */
/** @typedef {import("./kipfel_rig.js").Faces} Faces */

/**
 * @typedef {{
 *   pose: Pose;
 *   face: Faces;
 *   z: number;
 *   x: number;
 *   heading: number;
 *   lift: number;
 *   closeUp: number;
 *   phase: string;
 * }} Frame
 */

/** Phase lengths in seconds. */
const timing = { run: 2.6, brake: 0.55, peek: 1.1 };

/** Root travel along z, in model heights. */
const startZ = -5.5;
const stopZ = 0;

const clamp = (/** @type {number} */ value, /** @type {number} */ low,
  /** @type {number} */ high) => Math.min(high, Math.max(low, value));

const smooth = (/** @type {number} */ t) => {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
};

const easeOut = (/** @type {number} */ t) => 1 - (1 - clamp(t, 0, 1)) ** 3;

/** Smooth 0..1..0 envelope over [start, end]. */
const bump = (/** @type {number} */ t, /** @type {number} */ start,
  /** @type {number} */ end) =>
  t <= start || t >= end
    ? 0
    : Math.sin(((t - start) / (end - start)) * Math.PI) ** 2;

/** Blend two poses bone by bone and axis by axis. */
const mixPose = (/** @type {Pose} */ a, /** @type {Pose} */ b,
  /** @type {number} */ k) => {
  /** @type {Pose} */
  const out = {};
  for (const name of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const from = a[name] ?? {};
    const to = b[name] ?? {};
    /** @type {import("./kipfel_rig.js").Turn} */
    const turn = {};
    for (const axis of /** @type {const} */ (["x", "y", "z"])) {
      const value = (from[axis] ?? 0) * (1 - k) + (to[axis] ?? 0) * k;
      if (value) turn[axis] = value;
    }
    out[name] = turn;
  }
  return out;
};

/** Tail segments swing with a delay per joint. */
const tail = (/** @type {number} */ t, /** @type {number} */ speed,
  /** @type {number} */ amount, /** @type {number} */ lift = 0) =>
  Object.fromEntries(
    Array.from({ length: 6 }, (_, i) => [
      `Tail.00${i + 1}`,
      {
        y: Math.sin(t * speed - i * 0.6) * amount * (0.6 + i * 0.12),
        x: lift * (i < 2 ? 1 : 0.3),
      },
    ]),
  );

/**
 * Run cycle. Upper legs swing about x (positive pulls the foot back), knees
 * fold on the back swing, arms counter-swing bent at the elbow.
 */
const runPose = (/** @type {number} */ t) => {
  const cycle = t * Math.PI * 2 * 2.6;
  const s = Math.sin(cycle);
  const fold = (/** @type {number} */ phase) =>
    0.25 + 0.95 * Math.max(0, Math.sin(phase - 0.9));

  return {
    Spine: { x: 0.16, y: 0.08 * s },
    Chest: { x: 0.08, y: -0.14 * s },
    Neck: { x: -0.12 },
    Head: { x: -0.1, z: 0.04 * s },
    "UpperLeg.L": { x: -0.75 * s },
    "UpperLeg.R": { x: 0.75 * s },
    "LowerLeg.L": { x: fold(cycle) },
    "LowerLeg.R": { x: fold(cycle + Math.PI) },
    "foot.L": { x: -0.25 * s },
    "foot.R": { x: 0.25 * s },
    // Arms from T-pose down to the sides, then pumping opposite the legs.
    "UpperArm.L": { z: -1.15, x: 0.7 * s },
    "UpperArm.R": { z: 1.15, x: -0.7 * s },
    "LowerArm.L": { y: 1.35 },
    "LowerArm.R": { y: -1.35 },
    "KemoEar.L": { x: 0.35 },
    "KemoEar.R": { x: 0.35 },
    ...tail(t, 9, 0.18, -0.5),
  };
};

/** Skid: lean back, arms flung out, one leg forward. */
const brakePose = (/** @type {number} */ k) => ({
  Spine: { x: -0.18 * k },
  Chest: { x: -0.1 * k },
  Head: { x: 0.12 * k },
  "UpperLeg.L": { x: -0.45 * k },
  "UpperLeg.R": { x: 0.25 * k },
  "LowerLeg.R": { x: 0.5 * k },
  "UpperArm.L": { z: -0.55, x: -0.35 * k },
  "UpperArm.R": { z: 0.55, x: -0.35 * k },
  "LowerArm.L": { y: 0.5 },
  "LowerArm.R": { y: -0.5 },
  "KemoEar.L": { z: -0.3 * k },
  "KemoEar.R": { z: 0.3 * k },
  ...tail(0, 0, 0, 0.9 * k),
});

/**
 * Curious lean toward the viewer. `look` is the pointer direction in -1..1
 * (x right, y up) as seen by the camera.
 */
const peekPose = (/** @type {number} */ t, /** @type {{ x: number; y: number }} */ look,
  /** @type {number} */ tilt) => {
  const breath = Math.sin(t * 1.6);
  return {
    Spine: { x: 0.12 + 0.01 * breath },
    Chest: { x: 0.14 + 0.015 * breath, y: look.x * 0.12 },
    Neck: { x: -0.06 - look.y * 0.12, y: look.x * 0.22 },
    Head: { x: -look.y * 0.22, y: look.x * 0.35, z: tilt },
    // Hands come up and together in front of the chest, paws curled.
    "UpperArm.L": { z: -1.05, y: -0.55, x: 0.25 },
    "UpperArm.R": { z: 1.05, y: 0.55, x: 0.25 },
    "LowerArm.L": { y: 1.55 },
    "LowerArm.R": { y: -1.55 },
    "Hand.L": { x: 0.4 },
    "Hand.R": { x: 0.4 },
    "KemoEar.L": { x: 0.2, z: -0.18 * tilt * 4 },
    "KemoEar.R": { x: 0.2, z: -0.18 * tilt * 4 },
    ...tail(t, 2.2, 0.3, -0.15),
  };
};

/** Eyes follow the pointer through the directional morphs. */
const gaze = (/** @type {{ x: number; y: number }} */ look) => ({
  eye_left: clamp(look.x, 0, 1) * 0.8,
  eye_right: clamp(-look.x, 0, 1) * 0.8,
  eye_up: clamp(look.y, 0, 1) * 0.6,
  eye_down: clamp(-look.y, 0, 1) * 0.6,
});

/**
 * @param {{ random?: () => number }} [options]
 */
export const createMotion = ({ random = Math.random } = {}) => {
  let time = 0;
  let watchTime = 0;
  /** Pointer target and its smoothed value, -1..1. */
  const target = { x: 0, y: 0 };
  const look = { x: 0, y: 0 };
  let tilt = 0;
  let tiltTarget = 0.18;
  let nextTilt = 2;
  let nextBlink = 1.5;
  let blinkStart = -1;
  let surprise = 0;
  let surpriseStart = -10;
  let nextSurprise = 4;

  const blink = () => {
    if (watchTime >= nextBlink) {
      blinkStart = watchTime;
      // Occasionally a quick double blink.
      nextBlink = watchTime + (random() < 0.25 ? 0.35 : 2.2 + random() * 3);
    }
    return bump(watchTime, blinkStart, blinkStart + 0.22);
  };

  return {
    /** @param {number} x @param {number} y pointer in -1..1, y up */
    lookAt(x, y) {
      target.x = clamp(x, -1, 1);
      target.y = clamp(y, -1, 1);
    },

    /** A tap startles her: wide eyes, open mouth, ears up. */
    poke() {
      surpriseStart = watchTime;
    },

    get time() {
      return time;
    },

    /** Restart from the far end of the run. */
    reset() {
      time = 0;
      watchTime = 0;
    },

    /** Skip straight to the close-up, for reduced motion. */
    settle() {
      time = timing.run + timing.brake + timing.peek;
    },

    /** @param {number} delta seconds @returns {Frame} */
    update(delta) {
      time += delta;
      const runEnd = timing.run;
      const brakeEnd = runEnd + timing.brake;
      const peekEnd = brakeEnd + timing.peek;

      if (time < runEnd) {
        const k = time / runEnd;
        const cycle = time * Math.PI * 2 * 2.6;
        return {
          phase: "run",
          pose: runPose(time),
          face: { "mouth_○": 0.35, eye_joy: 0.3 },
          z: startZ + (stopZ - 0.35 - startZ) * k,
          // Slight weave so the approach reads as running, not sliding.
          x: Math.sin(k * Math.PI * 1.5) * 0.12,
          heading: Math.cos(k * Math.PI * 1.5) * 0.12,
          lift: Math.abs(Math.sin(cycle)) * 0.025 - 0.02,
          closeUp: 0,
        };
      }

      if (time < brakeEnd) {
        const k = (time - runEnd) / timing.brake;
        const skid = easeOut(k);
        return {
          phase: "brake",
          pose: mixPose(runPose(runEnd), brakePose(1), smooth(k * 2.5)),
          face: { eye_round: skid, eyebrow_surprised: skid, "mouth_○": 0.6 },
          z: stopZ - 0.35 + 0.35 * skid,
          x: 0,
          heading: 0,
          lift: -0.05 * bump(k, 0, 1),
          closeUp: 0,
        };
      }

      watchTime += delta;
      // Pointer smoothing; the head trails the eyes a little.
      const follow = 1 - Math.exp(-delta * 4);
      look.x += (target.x - look.x) * follow;
      look.y += (target.y - look.y) * follow;

      if (watchTime >= nextTilt) {
        tiltTarget = (random() < 0.5 ? -1 : 1) * (0.12 + random() * 0.16);
        nextTilt = watchTime + 2.5 + random() * 3;
      }
      tilt += (tiltTarget - tilt) * (1 - Math.exp(-delta * 2.5));

      if (watchTime >= nextSurprise) {
        surpriseStart = watchTime;
        nextSurprise = watchTime + 7 + random() * 6;
      }
      surprise = bump(watchTime, surpriseStart, surpriseStart + 1.4);

      const k = smooth((time - brakeEnd) / timing.peek);
      const pose = mixPose(brakePose(1), peekPose(time, look, tilt), k);
      const closed = blink() * (1 - surprise);

      return {
        phase: time < peekEnd ? "peek" : "watch",
        pose,
        face: {
          ...gaze(look),
          eye_close: closed,
          eye_round: 0.35 * k + 0.65 * surprise,
          eyebrow_surprised: 0.4 * k + 0.6 * surprise,
          "mouth_○": 0.15 * k + 0.5 * surprise,
          "mouth_ω": 0.4 * k * (1 - surprise),
        },
        z: stopZ,
        x: 0,
        heading: look.x * 0.08,
        // Rise on tiptoe when surprised, sink back while staring.
        lift: -0.05 * (1 - k) + 0.012 * surprise,
        closeUp: k,
      };
    },
  };
};
