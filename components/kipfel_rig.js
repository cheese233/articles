import {
  AnimationClip,
  AnimationMixer,
  LoopOnce,
  NumberKeyframeTrack,
  PropertyBinding,
  Quaternion,
  QuaternionKeyframeTrack,
  Vector3,
} from "three/webgpu";

/**
 * Procedural actions for the Kipfel avatar. The glb ships a full humanoid
 * skeleton (Hips -> Spine -> Chest -> ...) with no clips, so every action is
 * sampled here into regular keyframe tracks and played through an
 * AnimationMixer bound to the skinned meshes' shared skeleton.
 *
 * Poses are written as rotations about world axes of the rest pose; `turn`
 * maps them into each bone's local frame, so the clips do not depend on how
 * the exporter oriented the bones (the arms rest in a T-pose along ±x, the
 * model faces +z).
 */

/** Keyframe sampling rate of generated clips. */
const fps = 30;

const axes = {
  x: new Vector3(1, 0, 0),
  y: new Vector3(0, 1, 0),
  z: new Vector3(0, 0, 1),
};

/** @typedef {keyof typeof axes} Axis */
/** @typedef {Partial<Record<Axis, number>>} Turn */
/** @typedef {Record<string, Turn>} Pose */
/** @typedef {Record<string, number>} Faces */

/**
 * @typedef {{
 *   duration: number;
 *   once?: boolean;
 *   pose: (time: number) => Pose;
 *   face?: (time: number) => Faces;
 * }} ActionSpec
 */

const tau = Math.PI * 2;

/** Smooth 0..1..0 envelope over [start, end]. */
const bump = (/** @type {number} */ t, /** @type {number} */ start,
  /** @type {number} */ end) => {
  if (t <= start || t >= end) return 0;
  return Math.sin(((t - start) / (end - start)) * Math.PI) ** 2;
};

const smoothstep = (/** @type {number} */ from, /** @type {number} */ to,
  /** @type {number} */ t) => {
  const x = Math.min(1, Math.max(0, (t - from) / (to - from)));
  return x * x * (3 - 2 * x);
};

/** Ramp in until `start`, hold, ramp out after `end`. */
const hold = (/** @type {number} */ t, /** @type {number} */ start,
  /** @type {number} */ end, /** @type {number} */ edge = 0.35) =>
  smoothstep(start - edge, start, t) * (1 - smoothstep(end, end + edge, t));

/** Arms hang from the T-pose; the right arm mirrors the left one. */
const relaxedArms = (/** @type {number} */ sway) => ({
  "UpperArm.L": { z: -1.22 + sway, x: -0.1 },
  "UpperArm.R": { z: 1.22 - sway, x: -0.1 },
  "LowerArm.L": { z: -0.18, y: 0.25 },
  "LowerArm.R": { z: 0.18, y: -0.25 },
});

/** Tail chain swings sideways with a delay per segment. */
const tail = (/** @type {number} */ t, /** @type {number} */ speed,
  /** @type {number} */ amount) =>
  Object.fromEntries(
    Array.from({ length: 6 }, (_, i) => [
      `Tail.00${i + 1}`,
      {
        y: Math.sin(t * speed - i * 0.55) * amount * (0.6 + i * 0.12),
        x: -0.04 * Math.sin(t * speed * 0.5 - i * 0.4),
      },
    ]),
  );

/** One ear flick per cycle, left and right offset. */
const ears = (/** @type {number} */ t, /** @type {number} */ duration) => ({
  "KemoEar.L": { z: -0.35 * bump(t, duration * 0.62, duration * 0.7) },
  "KemoEar.R": { z: 0.35 * bump(t, duration * 0.7, duration * 0.78) },
});

/** @type {Record<string, ActionSpec>} */
export const actions = {
  idle: {
    duration: 4.8,
    pose: (t) => {
      const breath = Math.sin((t / 4.8) * tau);
      return {
        Spine: { x: 0.015 * breath },
        Chest: { x: 0.025 * breath },
        Neck: { z: 0.03 * Math.sin((t / 4.8) * tau + 1) },
        Head: {
          z: 0.07 * Math.sin((t / 4.8) * tau),
          x: 0.04 + 0.02 * breath,
        },
        ...relaxedArms(0.04 * breath),
        ...tail(t, (tau / 4.8) * 2, 0.22),
        ...ears(t, 4.8),
      };
    },
    face: (t) => ({
      // Blink twice per cycle.
      eye_close: Math.max(bump(t, 1.2, 1.42), bump(t, 3.9, 4.12)),
    }),
  },

  wave: {
    duration: 2.6,
    once: true,
    pose: (t) => {
      const up = hold(t, 0.35, 2.15);
      const wave = Math.sin((t - 0.35) * tau * 1.8) * up;
      const arms = relaxedArms(0);
      return {
        ...arms,
        // Character's right arm (screen left) rises above the shoulder.
        "UpperArm.R": { z: 1.22 - up * 2.1, x: -0.1 - up * 0.25 },
        "LowerArm.R": { z: 0.18 - up * 0.5 + wave * 0.45, y: -0.25 },
        "Hand.R": { z: wave * 0.2 },
        Chest: { z: -0.05 * up },
        Head: { z: 0.12 * up, x: 0.05 },
        ...tail(t, tau * 1.2, 0.35),
        "KemoEar.L": { z: -0.25 * up },
        "KemoEar.R": { z: 0.25 * up },
      };
    },
    face: (t) => ({
      eye_joy: hold(t, 0.4, 2.1),
      "mouth_ω": hold(t, 0.45, 2.05),
    }),
  },

  stretch: {
    duration: 3.2,
    once: true,
    pose: (t) => {
      const up = hold(t, 0.6, 2.3, 0.55);
      const lean = Math.sin(((t - 0.6) / 1.7) * tau) * up;
      return {
        // Lazy cat stretch: both arms overhead, lean side to side.
        "UpperArm.L": { z: -1.22 + up * 2.55, x: -0.1 },
        "UpperArm.R": { z: 1.22 - up * 2.55, x: -0.1 },
        "LowerArm.L": { z: -0.18 + up * 0.35 },
        "LowerArm.R": { z: 0.18 - up * 0.35 },
        Spine: { z: 0.06 * lean, x: -0.04 * up },
        Chest: { z: 0.1 * lean, x: -0.08 * up },
        Head: { x: -0.18 * up, z: 0.05 * lean },
        ...tail(t, tau * 0.8, 0.3 + 0.2 * up),
      };
    },
    face: (t) => ({ eye_close: 0.85 * hold(t, 0.8, 2.2) }),
  },
};

/**
 * @param {import("three/webgpu").Object3D} root
 */
export const createRig = (root) => {
  root.updateMatrixWorld(true);

  /** @type {Map<string, { bone: import("three/webgpu").Bone; rest: Quaternion; parent: Quaternion }>} */
  const bones = new Map();
  /** @type {import("three/webgpu").SkinnedMesh[]} */
  const meshes = [];

  root.traverse((object) => {
    const bone = /** @type {import("three/webgpu").Bone} */ (object);
    if (bone.isBone && !bones.has(bone.name)) {
      const parent = new Quaternion();
      bone.parent?.getWorldQuaternion(parent);
      bones.set(bone.name, { bone, rest: bone.quaternion.clone(), parent });
    }

    const mesh = /** @type {import("three/webgpu").SkinnedMesh} */ (object);
    if (mesh.isSkinnedMesh) meshes.push(mesh);
  });

  if (!bones.has("Hips")) throw new Error("kipfel: missing skeleton");

  const delta = new Quaternion();
  const step = new Quaternion();

  /**
   * Local quaternion of a bone after a world-space turn of its rest pose:
   * L' = P⁻¹ · Δ · P · L.
   * @param {{ rest: Quaternion; parent: Quaternion }} entry
   * @param {Turn} turn
   */
  const turn = (entry, turn) => {
    delta.identity();
    for (const [axis, angle] of Object.entries(turn)) {
      step.setFromAxisAngle(axes[/** @type {Axis} */ (axis)], angle ?? 0);
      delta.premultiply(step);
    }
    return entry.parent.clone().invert()
      .multiply(delta)
      .multiply(entry.parent)
      .multiply(entry.rest);
  };

  /** @param {string} name @param {ActionSpec} spec */
  const toClip = (name, spec) => {
    const frames = Math.round(spec.duration * fps) + 1;
    const times = Array.from({ length: frames }, (_, i) =>
      Math.min(spec.duration, i / fps));
    const poses = times.map(spec.pose);
    const touched = new Set(poses.flatMap((pose) => Object.keys(pose)));

    /** @type {import("three/webgpu").KeyframeTrack[]} */
    const tracks = [];
    for (const boneName of touched) {
      // GLTFLoader sanitizes node names ("UpperArm.L" -> "UpperArmL").
      const entry = bones.get(PropertyBinding.sanitizeNodeName(boneName));
      if (!entry) continue;
      const values = poses.flatMap((pose) =>
        turn(entry, pose[boneName] ?? {}).toArray());
      tracks.push(
        new QuaternionKeyframeTrack(
          `${entry.bone.uuid}.quaternion`,
          times,
          values,
        ),
      );
    }

    if (spec.face) {
      const faces = times.map(spec.face);
      const names = new Set(faces.flatMap((face) => Object.keys(face)));
      for (const mesh of meshes) {
        for (const morph of names) {
          const index = mesh.morphTargetDictionary?.[morph];
          if (index == undefined) continue;
          tracks.push(
            new NumberKeyframeTrack(
              `${mesh.uuid}.morphTargetInfluences[${index}]`,
              times,
              faces.map((face) => face[morph] ?? 0),
            ),
          );
        }
      }
    }

    return new AnimationClip(name, spec.duration, tracks);
  };

  const mixer = new AnimationMixer(root);
  const playing = new Map(
    Object.entries(actions).map(([name, spec]) => {
      const action = mixer.clipAction(toClip(name, spec));
      if (spec.once) {
        action.setLoop(LoopOnce, 1);
        action.clampWhenFinished = true;
      }
      return [name, action];
    }),
  );

  const idle = playing.get("idle");
  if (!idle) throw new Error("kipfel: missing idle action");
  idle.play();

  /** @type {import("three/webgpu").AnimationAction | null} */
  let current = null;

  mixer.addEventListener("finished", (event) => {
    if (event.action != current) return;
    current = null;
    idle.reset().fadeIn(0.45).play();
    event.action.fadeOut(0.45);
  });

  return {
    mixer,
    names: Object.keys(actions).filter((name) => actions[name]?.once),
    get isBusy() {
      return current != null;
    },
    /** @param {string} name */
    play(name) {
      const action = playing.get(name);
      if (!action || action == idle || current) return false;
      current = action;
      action.reset().setEffectiveWeight(1).fadeIn(0.35).play();
      idle.fadeOut(0.35);
      return true;
    },
    /** @param {number} seconds */
    update(seconds) {
      mixer.update(seconds);
    },
    dispose() {
      mixer.stopAllAction();
      mixer.uncacheRoot(root);
    },
  };
};
