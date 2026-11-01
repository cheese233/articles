#!/usr/bin/env node

// Offline optimizer for the Kipfel avatar: keeps the skeleton and only the
// expression morphs the homepage animates, simplifies the meshes for the
// ASCII renderer, shrinks the texture and re-encodes with meshopt.

import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import {
  dedup,
  meshopt,
  prune,
  simplify,
  textureCompress,
  weld,
} from "@gltf-transform/functions";
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from "meshoptimizer";
import sharp from "sharp";

// The vendor file is not deployed; pass its path explicitly.
const [source, target = "components/kipfel/model/kipfel.glb"] =
  process.argv.slice(2);
if (!source) {
  throw new Error("usage: optimize_model.ts <source.glb> [target.glb]");
}

/** Morph targets driven by components/kipfel.jsx. */
const keptMorphs = new Set(["eye_close", "eye_joy", "mouth_ω"]);

await Promise.all([
  MeshoptDecoder.ready,
  MeshoptEncoder.ready,
  MeshoptSimplifier.ready,
]);

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    "meshopt.decoder": MeshoptDecoder,
    "meshopt.encoder": MeshoptEncoder,
  });

const document = await io.read(source);

for (const mesh of document.getRoot().listMeshes()) {
  const extras = mesh.getExtras() as { targetNames?: string[] };
  const names = extras.targetNames ?? [];
  const keep = names.flatMap((name, index) =>
    keptMorphs.has(name) ? [index] : []
  );

  for (const primitive of mesh.listPrimitives()) {
    primitive.listTargets().forEach((morph, index) => {
      if (!keep.includes(index)) primitive.removeTarget(morph);
    });
  }

  mesh.setWeights(keep.map(() => 0));
  mesh.setExtras({ ...extras, targetNames: keep.map((i) => names[i]) });
}

await document.transform(
  prune(),
  dedup(),
  weld(),
  simplify({ simplifier: MeshoptSimplifier, ratio: 0.6, error: 0.0008 }),
  textureCompress({
    encoder: sharp,
    targetFormat: "webp",
    resize: [1024, 1024],
    quality: 82,
  }),
  prune(),
  meshopt({ encoder: MeshoptEncoder, level: "high" }),
);

await io.write(target, document);

for (const mesh of document.getRoot().listMeshes()) {
  for (const primitive of mesh.listPrimitives()) {
    console.log(
      mesh.getName(),
      `${(primitive.getIndices()?.getCount() ?? 0) / 3} triangles`,
      `${primitive.listTargets().length} morphs`,
    );
  }
}
