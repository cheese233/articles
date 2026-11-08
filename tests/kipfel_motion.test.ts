import { expect } from "@esm-bundle/chai";
import { createMotion } from "../components/kipfel_motion.js";

type Motion = ReturnType<typeof createMotion>;
type Frame = ReturnType<Motion["update"]>;
type Track = { duration: number; travel?: number[]; ground?: number[] };

const step = 1 / 30;

/** Per-frame track over `frames + 1` samples. */
const per = (frames: number, value: (i: number) => number) =>
  Array.from({ length: frames + 1 }, (_, i) => value(i));

/**
 * Clip lengths and root motion shaped like the baked ones: the run moves
 * at a steady speed and bobs twice a cycle, the halt brakes to a stop.
 */
const tracks: Record<string, Track> = {
  run: {
    duration: 10 / 30,
    travel: per(10, (i) => i * 0.0536),
    ground: per(10, (i) => -0.03 - 0.01 * Math.cos((i / 10) * Math.PI * 4)),
  },
  halt: {
    duration: 57 / 30,
    travel: per(57, (i) => 0.29 * Math.min(1, Math.sin(Math.min(i / 11, 1) * Math.PI / 2))),
    ground: per(57, () => -0.007),
  },
  idle: { duration: 4 },
  hunt: { duration: 0.5, ground: per(15, () => -0.04) },
  nuzzle: { duration: 1.6 },
  notice: { duration: 1.6 },
  ear_flick_l: { duration: 0.6 },
  ear_flick_r: { duration: 0.6 },
  shake: { duration: 1.1 },
  groom: { duration: 3.3 },
  swipe_l: { duration: 0.93 },
  swipe_r: { duration: 0.93 },
  startle: { duration: 1 },
  yawn: { duration: 2.5 },
};

// Fixed randomness keeps the curious idle deterministic.
const create = () => createMotion({ tracks, random: () => 0.5 });

/**
 * Advance in 1/30 s steps. `before` runs ahead of every step (to move the
 * pointer), `after` sees every resulting frame.
 */
const run = (
  motion: Motion,
  seconds: number,
  before?: (t: number) => void,
  after?: (frame: Frame) => void,
) => {
  let frame = motion.update(0);
  for (let t = 0; t < seconds; t += step) {
    before?.(t);
    frame = motion.update(step);
    after?.(frame);
  }
  return frame;
};

/** Run until the close-up has settled. */
const settle = (motion: Motion) => run(motion, 6);

const weightOf = (frame: Frame, name: string) =>
  [...frame.clips, ...frame.gestures]
    .filter((clip) => clip.name == name)
    .reduce((sum, clip) => sum + clip.weight, 0);

const gestureNames = (frame: Frame) => frame.gestures.map((g) => g.name);

describe("kipfel motion", () => {
  it("scampers in from outside the left edge, moving by the clip", () => {
    const motion = create();
    const frames: Frame[] = [];
    run(motion, 2, undefined, (frame) => frames.push(frame));
    const start = frames[0];
    const middle = frames[30];

    expect(start?.phase).to.equal("run");
    expect(start?.x ?? 0).to.be.lessThan(-1);
    expect(middle?.phase).to.equal("run");
    expect(middle?.closeUp).to.equal(0);
    expect(weightOf(middle as Frame, "run")).to.equal(1);
    // The body bobs with the clip's ground track.
    const lifts = frames.slice(0, 20).map((frame) => frame.lift);
    expect(Math.max(...lifts) - Math.min(...lifts)).to.be.greaterThan(0.01);
  });

  it("covers exactly the distance the clips travel", () => {
    const motion = create();
    let previous = motion.update(0);
    let walked = 0;
    // 8 run cycles, then the halt.
    for (let t = 0; t < 8 * (10 / 30) + 57 / 30; t += step / 4) {
      const frame = motion.update(step / 4);
      walked += Math.hypot(frame.x - previous.x, frame.z - previous.z);
      previous = frame;
    }
    expect(walked).to.be.closeTo(8 * 0.536 + 0.29, 0.02);
    expect(previous.x).to.be.closeTo(0, 1e-6);
    expect(previous.z).to.be.closeTo(0, 1e-6);
  });

  it("halts facing the camera, then fills the view", () => {
    const motion = create();
    const halt = run(motion, 8 * (10 / 30) + 0.2);
    expect(halt.phase).to.equal("halt");
    expect(weightOf(halt, "halt")).to.equal(1);

    const frame = settle(motion);
    expect(frame.phase).to.equal("watch");
    expect(frame.closeUp).to.equal(1);
    expect(Math.abs(frame.heading)).to.be.lessThan(0.05);
    expect(weightOf(frame, "idle")).to.be.closeTo(1, 1e-6);
  });

  it("follows the pointer with eyes first, then the head", () => {
    const motion = create();
    settle(motion);
    motion.lookAt(0.9, 0);
    const early = run(motion, 0.05);
    const late = run(motion, 1.5);

    expect(early.face.eye_left ?? 0).to.be.greaterThan(0.3);
    const earlyHead = early.turns.Head?.y ?? 0;
    const lateHead = late.turns.Head?.y ?? 0;
    expect(lateHead).to.be.greaterThan(earlyHead);
    expect(lateHead).to.be.greaterThan(0.3);
    expect(late.face.eye_right).to.equal(0);
  });

  it("overshoots a little when the head turns", () => {
    const motion = create();
    settle(motion);
    motion.lookAt(0.8, 0);
    let peak = 0;
    const end = run(motion, 2, undefined, (frame) => {
      peak = Math.max(peak, frame.turns.Head?.y ?? 0);
    });
    expect(peak).to.be.greaterThan((end.turns.Head?.y ?? 0) * 1.03);
  });

  it("hunts a fast pointer and bats at it on that side", () => {
    const motion = create();
    settle(motion);
    const seen = new Set<string>();
    let hunt = 0;
    run(
      motion,
      2.5,
      // Darting back and forth on her left (screen right).
      (t) => motion.lookAt(0.45 + 0.4 * Math.sign(Math.sin(t * 20)), 0.2),
      (frame) => {
        hunt = Math.max(hunt, weightOf(frame, "hunt"));
        gestureNames(frame).forEach((name) => seen.add(name));
      },
    );

    expect(hunt).to.be.greaterThan(0.5);
    expect(seen.has("swipe_l")).to.equal(true);
    expect(seen.has("swipe_r")).to.equal(false);
  });

  it("leans into slow strokes over her head", () => {
    const motion = create();
    settle(motion);
    const frame = run(motion, 2, (t) => {
      motion.lookAt(Math.sin(t * 1.5) * 0.4, 0.3);
    });

    expect(weightOf(frame, "nuzzle")).to.be.greaterThan(0.5);
    expect(frame.face["mouth_ω"] ?? 0).to.be.greaterThan(0.5);
  });

  it("flinches at a boop, then shakes it off", () => {
    const motion = create();
    settle(motion);
    motion.poke();
    const flinch = run(motion, 0.3);
    expect(gestureNames(flinch)).to.include("startle");
    expect(flinch.face.eye_round ?? 0).to.be.greaterThan(0.8);

    const after = run(motion, 0.9);
    expect(gestureNames(after)).to.include("shake");
  });

  it("grooms or yawns when left alone", () => {
    const motion = create();
    settle(motion);
    const seen = new Set<string>();
    run(motion, 8, undefined, (frame) => {
      gestureNames(frame).forEach((name) => seen.add(name));
    });

    expect(seen.has("groom") || seen.has("yawn")).to.equal(true);
    expect(seen.has("ear_flick_l") || seen.has("ear_flick_r")).to.equal(true);
  });

  it("settles straight into the close-up for reduced motion", () => {
    const motion = create();
    motion.settle();
    const frame = motion.update(0);

    expect(frame.phase).to.equal("watch");
    expect(frame.closeUp).to.equal(1);
    expect(weightOf(frame, "idle")).to.equal(1);
  });
});
