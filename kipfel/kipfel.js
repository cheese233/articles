import * as THREE from "https://esm.sh/three@0.184";
import { GLTFLoader } from "https://esm.sh/three@0.184/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "https://esm.sh/three@0.184/addons/libs/meshopt_decoder.module.js";

/**
 * # cute kipfel
 * @routable
 * @hidden
 * @author cheese233
 * @param {HTMLElement} div
 */
export default async function (div) {
  const canvas = document.createElement("canvas");
  canvas.style.width = canvas.style.height = "100%";
  canvas.style.display = "block";
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    canvas,
    alpha: true,
  });
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    75,
    canvas.clientWidth / canvas.clientHeight,
    0.1,
    1000,
  );

  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const model = await loader.loadAsync(
    "/kipfel/model/Kipfel_Mobile_1.1.0_opti.glb",
  );
  scene.add(model.scene);

  camera.position.z = 1;
  camera.position.y = 0.5;

  function resize() {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(canvas);

  div.replaceChildren(canvas);

  function animate(time) {
    renderer.render(scene, camera);
  }
  renderer.setAnimationLoop(animate);
}
