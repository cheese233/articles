#!/usr/bin/env node

// Offline optimizer for the Kipfel animation clips exported from Blender by
// scripts/blender/kipfel_actions.py. The page plays them on the optimized
// model (components/kipfel/model/kipfel.glb) by bone name, so only bone
// rotations that ever leave the rest pose are kept; translation and scale
// channels (hip lift is procedural), the skin and the meshes are dropped.

import { NodeIO } from "@gltf-transform/core";
import type { Node } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { meshopt, prune, resample } from "@gltf-transform/functions";
import { MeshoptDecoder, MeshoptEncoder } from "meshoptimizer";

const [source = "components/kipfel/model/kipfel_clips.glb", target = source] =
  process.argv.slice(2);

/** Largest per-component quaternion difference still treated as rest. */
const restTolerance = 1e-4;

await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready]);

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    "meshopt.decoder": MeshoptDecoder,
    "meshopt.encoder": MeshoptEncoder,
  });

const document = await io.read(source);
const root = document.getRoot();

/** Whether every key of a rotation channel equals the node's rest pose. */
const isRest = (node: Node, values: ArrayLike<number>) => {
  const rest = node.getRotation();
  for (let i = 0; i < values.length; i += 4) {
    // q and -q are the same rotation.
    const sign = Math.sign(
      rest.reduce((sum, value, k) => sum + value * (values[i + k] ?? 0), 0),
    ) || 1;
    for (let k = 0; k < 4; k++) {
      const value = (values[i + k] ?? 0) * sign;
      if (Math.abs(value - (rest[k] ?? 0)) > restTolerance) return false;
    }
  }
  return true;
};

for (const animation of root.listAnimations()) {
  for (const channel of animation.listChannels()) {
    const node = channel.getTargetNode();
    const sampler = channel.getSampler();
    const values = sampler?.getOutput()?.getArray();
    const isKept = channel.getTargetPath() == "rotation" && node && values &&
      !isRest(node, values);
    if (isKept) continue;
    channel.dispose();
    sampler?.dispose();
  }
}

for (const skin of root.listSkins()) skin.dispose();
for (const mesh of root.listMeshes()) mesh.dispose();

await document.transform(
  resample({ tolerance: 1e-4 }),
  prune({ keepLeaves: true }),
  meshopt({ encoder: MeshoptEncoder, level: "high" }),
);

await io.write(target, document);

for (const animation of root.listAnimations()) {
  const frames = animation.listSamplers()[0]?.getInput()?.getCount() ?? 0;
  console.log(
    animation.getName(),
    `${animation.listChannels().length} channels`,
    `${frames} keys`,
  );
}
