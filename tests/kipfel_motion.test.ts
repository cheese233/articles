import { expect } from "@esm-bundle/chai";
import { createMotion } from "../components/kipfel_motion.js";

/** Advance in 1/30 s steps and return the last frame. */
const run = (motion: ReturnType<typeof createMotion>, seconds: number) => {
  let frame = motion.update(0);
  for (let t = 0; t < seconds; t += 1 / 30) frame = motion.update(1 / 30);
  return frame;
};

describe("kipfel motion", () => {
  // Fixed randomness keeps the curious idle deterministic.
  const options = { random: () => 0.5 };

  it("runs in from the back toward the camera", () => {
    const motion = createMotion(options);
    const start = motion.update(0);
    const middle = run(motion, 1.2);

    expect(start.phase).to.equal("run");
    expect(middle.phase).to.equal("run");
    expect(middle.z).to.be.greaterThan(start.z);
    expect(middle.closeUp).to.equal(0);
    // Legs swing in opposite directions.
    const left = middle.pose["UpperLeg.L"]?.x ?? 0;
    const right = middle.pose["UpperLeg.R"]?.x ?? 0;
    expect(Math.sign(left)).to.equal(-Math.sign(right));
  });

  it("ends in a full close-up watching the pointer", () => {
    const motion = createMotion(options);
    motion.lookAt(1, 0);
    const frame = run(motion, 6);

    expect(frame.phase).to.equal("watch");
    expect(frame.closeUp).to.equal(1);
    expect(frame.z).to.equal(0);
    expect(frame.face.eye_left).to.be.greaterThan(0.5);
    expect(frame.face.eye_right).to.equal(0);
    expect(frame.pose.Head?.y ?? 0).to.be.greaterThan(0.2);
  });

  it("is startled by a poke", () => {
    const motion = createMotion(options);
    run(motion, 5);
    motion.poke();
    const frame = run(motion, 0.7);

    expect(frame.face.eye_round ?? 0).to.be.greaterThan(0.8);
    expect(frame.face["mouth_○"] ?? 0).to.be.greaterThan(0.4);
  });

  it("settles straight into the close-up for reduced motion", () => {
    const motion = createMotion(options);
    motion.settle();
    const frame = motion.update(0);

    expect(frame.phase).to.equal("watch");
    expect(frame.closeUp).to.equal(1);
  });
});
