import {
  AdditiveAnimationBlendMode,
  AnimationMixer,
  LoopRepeat,
  Quaternion,
  QuaternionKeyframeTrack,
} from "three/webgpu";
import { moods } from "./kipfel_motion.js";

/**
 * Plays the clips baked in Blender (scripts/blender/kipfel_actions.py) on
 * the optimized model. Time and weight of every clip come from the motion
 * frame, so the mixer is never advanced on its own clock.
 *
 * Gesture clips are authored as "base pose + gesture"; they are turned into
 * additive clips relative to the base pose (or the bone's rest rotation when
 * the base pose leaves it alone), so they layer over any mood.
 */

/** Clips blended normally; everything else except `base` is additive. */
const baseClips = new Set(["run", "halt", ...moods]);

/**
 * @param {import("three/webgpu").Object3D} model
 * @param {import("three/webgpu").AnimationClip[]} animations
 */
export const createClips = (model, animations) => {
  /** Rest rotation per sanitized node name, read before anything plays. */
  /** @type {Map<string, Quaternion>} */
  const rest = new Map();
  model.traverse((object) => {
    if (!rest.has(object.name)) rest.set(object.name, object.quaternion.clone());
  });

  const base = animations.find((clip) => clip.name == "base");
  if (!base) throw new Error("kipfel: missing base clip");
  /** @type {Map<string, Quaternion>} */
  const reference = new Map(rest);
  for (const track of base.tracks) {
    const node = track.name.slice(0, track.name.lastIndexOf("."));
    reference.set(node, new Quaternion().fromArray(track.values, 0));
  }

  const inverse = new Quaternion();
  const value = new Quaternion();

  /** @param {import("three/webgpu").AnimationClip} clip */
  const additive = (clip) => {
    const result = clip.clone();
    result.tracks = result.tracks.flatMap((track) => {
      if (!(track instanceof QuaternionKeyframeTrack)) return [];
      const node = track.name.slice(0, track.name.lastIndexOf("."));
      const from = reference.get(node);
      if (!from) return [];
      inverse.copy(from).invert();
      const values = track.values;
      for (let i = 0; i < values.length; i += 4) {
        // Delta d with from · d = value, applied as current · d.
        value.fromArray(values, i).premultiply(inverse).normalize();
        value.toArray(values, i);
      }
      return [track];
    });
    return result;
  };

  const mixer = new AnimationMixer(model);
  /** @type {Map<string, import("three/webgpu").AnimationAction>} */
  const actions = new Map();
  for (const clip of animations) {
    if (clip.name == "base") continue;
    const isBase = baseClips.has(clip.name);
    const action = isBase
      ? mixer.clipAction(clip)
      : mixer.clipAction(additive(clip), undefined, AdditiveAnimationBlendMode);
    action.setLoop(LoopRepeat, Infinity);
    action.setEffectiveWeight(0);
    action.play();
    actions.set(clip.name, action);
  }

  return {
    /**
     * Length and root motion per clip, for kipfel_motion.js. `travel` and
     * `ground` are per-frame tracks the Blender script measured from the
     * planted feet (animation extras).
     * @type {Record<string, import("./kipfel_motion.js").Track>}
     */
    tracks: Object.fromEntries(animations.map((clip) => [clip.name, {
      duration: clip.duration,
      travel: clip.userData.travel,
      ground: clip.userData.ground,
    }])),

    /** @param {import("./kipfel_motion.js").ClipState[]} states */
    apply(states) {
      for (const action of actions.values()) action.setEffectiveWeight(0);
      for (const { name, time, weight } of states) {
        const action = actions.get(name);
        if (!action) continue;
        action.time = Math.min(time, action.getClip().duration - 1e-4);
        action.setEffectiveWeight(weight);
      }
      mixer.update(0);
    },
  };
};
