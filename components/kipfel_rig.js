import { PropertyBinding, Quaternion, Vector3 } from "three/webgpu";

/**
 * Pose driver for the Kipfel avatar's own skeleton (Hips -> Spine -> Chest
 * -> ..., shared by both skinned meshes). The baked clips set the body pose
 * (components/kipfel_clips.js); `turn` layers pointer reactions from
 * components/kipfel_motion.js on top, and `face` sets the morphs.
 *
 * A turn rotates a bone about the axes of the model's rest pose (the model
 * faces +z, the arms rest in a T-pose along ±x), mapped into each bone's
 * local frame, so turns do not depend on how the exporter oriented the
 * bones. scripts/blender/kipfel_actions.py uses the same convention.
 */

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
 *   bone: import("three/webgpu").Bone;
 *   rest: Quaternion;
 *   parent: Quaternion;
 *   parentInverse: Quaternion;
 * }} BoneEntry
 */

/** @param {import("three/webgpu").Object3D} root */
export const createRig = (root) => {
  root.updateMatrixWorld(true);
  const rootInverse = new Quaternion();
  root.getWorldQuaternion(rootInverse).invert();

  /** @type {Map<string, BoneEntry>} */
  const bones = new Map();
  /** @type {import("three/webgpu").SkinnedMesh[]} */
  const meshes = [];

  root.traverse((object) => {
    const bone = /** @type {import("three/webgpu").Bone} */ (object);
    if (bone.isBone && !bones.has(bone.name)) {
      // Parent orientation relative to the model root, in the rest pose.
      const parent = new Quaternion();
      bone.parent?.getWorldQuaternion(parent);
      parent.premultiply(rootInverse);
      bones.set(bone.name, {
        bone,
        rest: bone.quaternion.clone(),
        parent,
        parentInverse: parent.clone().invert(),
      });
    }

    const mesh = /** @type {import("three/webgpu").SkinnedMesh} */ (object);
    if (mesh.isSkinnedMesh) meshes.push(mesh);
  });

  /** GLTFLoader sanitizes node names ("UpperArm.L" -> "UpperArmL"). */
  const find = (/** @type {string} */ name) =>
    bones.get(PropertyBinding.sanitizeNodeName(name));

  const head = find("Head");
  if (!head) throw new Error("kipfel: missing skeleton");

  const delta = new Quaternion();
  const step = new Quaternion();
  /** @type {Set<BoneEntry>} */
  const touched = new Set();

  /** @type {Map<string, number>[]} */
  const morphs = meshes.map((mesh) =>
    new Map(Object.entries(mesh.morphTargetDictionary ?? {})));

  const headTop = new Vector3();

  return {
    /**
     * Put bones turned last frame back to rest. Call before the clip mixer
     * writes the frame, so bones no clip drives do not accumulate turns.
     */
    relax() {
      for (const entry of touched) entry.bone.quaternion.copy(entry.rest);
      touched.clear();
    },

    /**
     * Layer rest-space turns over whatever the bones hold now (the clip
     * mixer output). In the parent's rest frame a turn Δ maps the local
     * rotation L to P⁻¹ · Δ · P · L.
     * @param {Pose} pose
     */
    turn(pose) {
      for (const [name, turn] of Object.entries(pose)) {
        const entry = find(name);
        if (!entry) continue;
        delta.identity();
        for (const [axis, angle] of Object.entries(turn)) {
          if (!angle) continue;
          step.setFromAxisAngle(axes[/** @type {Axis} */ (axis)], angle);
          delta.premultiply(step);
        }
        entry.bone.quaternion.premultiply(
          step.copy(entry.parentInverse).multiply(delta).multiply(entry.parent),
        );
        touched.add(entry);
      }
    },

    /** Morph influences by name; unknown names reset to 0. @param {Faces} faces */
    face(faces) {
      meshes.forEach((mesh, index) => {
        const influences = mesh.morphTargetInfluences;
        if (!influences) return;
        for (const [name, slot] of morphs[index] ?? []) {
          influences[slot] = faces[name] ?? 0;
        }
      });
    },

    /**
     * World-space center and radius of the head with ears and hair. The
     * offsets are in source units along the Head bone (head ~0.64 m, ear
     * tips ~0.8 m above the feet).
     * @param {Vector3} center
     */
    headBounds(center) {
      head.bone.updateWorldMatrix(true, false);
      head.bone.localToWorld(center.set(0, 0.06, 0.01));
      head.bone.localToWorld(headTop.set(0, 0.19, 0.01));
      return center.distanceTo(headTop);
    },
  };
};
