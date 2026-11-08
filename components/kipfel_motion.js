/**
 * Behaviour for the Kipfel avatar. Body motion comes from the clips baked in
 * Blender (scripts/blender/kipfel_actions.py), including root motion: each
 * clip carries how far the body travels and how high it rides per frame,
 * measured from the planted feet, so moving her by exactly that keeps the
 * feet from sliding. This module decides which clips play when, steers the
 * travel along a curved path, and layers the pointer reactions on top:
 *
 *   run    scampers in from outside the left edge, curving toward the
 *          camera and leaning into the turn
 *   halt   brakes with one step, pulls the other foot in, bobs up onto her
 *          toes, settles; the camera dollies until the head fills the view
 *   watch  a cat at the window: eyes dart to the pointer in quick
 *          saccades, the head follows on a spring and overshoots a little;
 *          a fast pointer makes her crouch and wiggle, then bat at it with
 *          the paw on that side; slow strokes over the head make her nuzzle
 *          in and slow-blink; a tap boops her (flinch, then a head shake);
 *          left alone she flicks her ears, washes her face and yawns
 *
 * Base clips blend normally; gestures are additive on top of the base pose.
 * Angles are radians about the rest-pose axes (components/kipfel_rig.js);
 * distances are model heights.
 */

/** @typedef {import("./kipfel_rig.js").Pose} Pose */
/** @typedef {import("./kipfel_rig.js").Faces} Faces */
/** @typedef {{ name: string; time: number; weight: number }} ClipState */
/** @typedef {{ duration: number; travel?: number[]; ground?: number[] }} Track */

/**
 * @typedef {{
 *   phase: string;
 *   clips: ClipState[];
 *   gestures: ClipState[];
 *   turns: Pose;
 *   face: Faces;
 *   x: number;
 *   z: number;
 *   heading: number;
 *   roll: number;
 *   lift: number;
 *   closeUp: number;
 *   look: { x: number; y: number };
 * }} Frame
 */

/** Base clips cross-faded by mood once she has settled. */
export const moods = /** @type {const} */ (["idle", "hunt", "nuzzle"]);

/** Gestures that only move the ears and may overlap any other gesture. */
const earFlicks = ["ear_flick_l", "ear_flick_r"];

/**
 * Run cycles before the halt; together they set the path length, long
 * enough that she starts outside the wide shot.
 */
const runCycles = 8;

/**
 * Path shape on the floor (x, z), ending at the stop mark facing the
 * camera (+z). It is scaled to the distance the clips actually cover.
 */
const pathShape = [[-1.3, -0.75], [-0.55, -0.75], [0.05, -0.55], [0, 0]];

/** Close-up dolly, relative to the start of the halt. */
const dolly = { start: 0.45, length: 1.5 };

/** Halt to moods cross-fade, seconds. */
const handover = 0.35;

/** Pointer speed (view units per second) that counts as prey. */
const preySpeed = 2.2;

const clamp = (/** @type {number} */ value, /** @type {number} */ low,
  /** @type {number} */ high) => Math.min(high, Math.max(low, value));

const smooth = (/** @type {number} */ t) => {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
};

/** Smooth 0..1..0 envelope over [start, end]. */
const bump = (/** @type {number} */ t, /** @type {number} */ start,
  /** @type {number} */ end) =>
  t <= start || t >= end
    ? 0
    : Math.sin(((t - start) / (end - start)) * Math.PI) ** 2;

/** Frame-rate independent approach factor. */
const follow = (/** @type {number} */ rate, /** @type {number} */ delta) =>
  1 - Math.exp(-rate * delta);

/** Linear sample of a per-frame track spread evenly over `duration`. */
const sample = (/** @type {number[] | undefined} */ values,
  /** @type {number} */ duration, /** @type {number} */ t) => {
  if (!values?.length) return 0;
  const last = values.length - 1;
  const at = clamp(t / duration, 0, 1) * last;
  const i = Math.min(Math.floor(at), last - 1);
  const a = values[Math.max(i, 0)] ?? 0;
  const b = values[Math.min(i + 1, last)] ?? a;
  return a + (b - a) * (at - i);
};

/**
 * Damped spring per axis; a little underdamped so turns overshoot and
 * settle instead of easing in like a tween.
 */
const createSpring = (/** @type {number} */ omega,
  /** @type {number} */ zeta) => {
  const value = { x: 0, y: 0 };
  const speed = { x: 0, y: 0 };
  return {
    value,
    /** @param {{ x: number; y: number }} goal @param {number} delta */
    step(goal, delta) {
      // Substeps keep it stable when a slow frame hands in a large delta.
      const steps = Math.max(1, Math.ceil(delta * 240));
      const dt = delta / steps;
      for (let i = 0; i < steps; i++) {
        for (const axis of /** @type {const} */ (["x", "y"])) {
          const accel = omega * omega * (goal[axis] - value[axis]) -
            2 * zeta * omega * speed[axis];
          speed[axis] += accel * dt;
          value[axis] += speed[axis] * dt;
        }
      }
      return value;
    },
  };
};

/**
 * Arc-length parametrized cubic path scaled to `length`.
 * @param {number} length
 */
const createPath = (length) => {
  const point = (/** @type {number} */ t) => {
    const u = 1 - t;
    const w = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
    return [0, 1].map((axis) =>
      w.reduce((sum, k, i) => sum + k * (pathShape[i]?.[axis] ?? 0), 0));
  };

  const samples = 256;
  /** @type {number[][]} */
  const points = Array.from({ length: samples + 1 }, (_, i) =>
    point(i / samples));
  /** Cumulative length at each sample, before scaling. */
  const lengths = [0];
  for (let i = 1; i <= samples; i++) {
    const [ax = 0, az = 0] = points[i - 1] ?? [];
    const [bx = 0, bz = 0] = points[i] ?? [];
    lengths.push((lengths[i - 1] ?? 0) + Math.hypot(bx - ax, bz - az));
  }
  const scale = length / (lengths[samples] ?? 1);

  /** Index of the sample at a distance from the start. */
  const find = (/** @type {number} */ distance) => {
    const target = clamp(distance, 0, length) / scale;
    let low = 0;
    let high = samples;
    while (high - low > 1) {
      const mid = (low + high) >> 1;
      if ((lengths[mid] ?? 0) < target) low = mid;
      else high = mid;
    }
    const a = lengths[low] ?? 0;
    const b = lengths[high] ?? a;
    return { low, high, k: b > a ? (target - a) / (b - a) : 0 };
  };

  const headingAt = (/** @type {number} */ i) => {
    const a = points[Math.max(0, i - 1)] ?? [0, 0];
    const b = points[Math.min(samples, i + 1)] ?? [0, 0];
    return Math.atan2((b[0] ?? 0) - (a[0] ?? 0), (b[1] ?? 0) - (a[1] ?? 0));
  };

  return {
    /** Position, heading (model faces +z) and turn rate per unit distance. */
    at(/** @type {number} */ distance) {
      const { low, high, k } = find(distance);
      const a = points[low] ?? [0, 0];
      const b = points[high] ?? a;
      const h0 = headingAt(low);
      const h1 = headingAt(high);
      const step = ((lengths[high] ?? 0) - (lengths[low] ?? 0)) * scale || 1;
      return {
        x: ((a[0] ?? 0) + ((b[0] ?? 0) - (a[0] ?? 0)) * k) * scale,
        z: ((a[1] ?? 0) + ((b[1] ?? 0) - (a[1] ?? 0)) * k) * scale,
        heading: h0 + (h1 - h0) * k,
        curvature: (h1 - h0) / step,
      };
    },
  };
};

/** Fade a one-shot clip in and out over its length. */
const envelope = (/** @type {number} */ t, /** @type {number} */ length) =>
  smooth(t / 0.06) * smooth((length - t) / 0.12);

/**
 * Expressions that go with each gesture, as a function of clip time. They
 * are timed against the keys in scripts/blender/kipfel_actions.py.
 * @type {Record<string, (t: number) => Faces>}
 */
const gestureFaces = {
  notice: (t) => ({
    eye_round: bump(t, 0, 0.7) * 1.2,
    eyebrow_surprised: 0.7 * bump(t, 0, 0.6),
    "mouth_○": 0.4 * bump(t, 0.05, 0.5),
  }),
  startle: (t) => ({
    eye_round: bump(t, 0, 0.8) * 1.6,
    eyebrow_surprised: bump(t, 0, 0.8) * 1.6,
    "mouth_○": bump(t, 0.02, 0.6),
  }),
  shake: (t) => ({ eye_close: bump(t, 0, 0.8) * 1.4, "mouth_ω": 0.6 }),
  groom: (t) => ({
    // Eyes shut while licking the paw, content while washing.
    eye_close: bump(t, 0.3, 1.65) * 1.5,
    "mouth_○": 0.35 * bump(t, 0.45, 1.6),
    eye_joy: bump(t, 1.65, 2.9),
  }),
  yawn: (t) => ({
    "mouth_○": bump(t, 0.3, 1.7) * 1.5,
    eye_close: bump(t, 0.4, 1.6) * 1.4,
    eyebrow_surprised: 0.4 * bump(t, 0.35, 1.55),
    eye_joy: 0.6 * bump(t, 1.55, 2.35),
  }),
  swipe_l: (t) => ({
    eye_round: 0.8 * bump(t, 0, 0.65),
    "mouth_○": 0.5 * bump(t, 0.1, 0.45),
  }),
  swipe_r: (t) => ({
    eye_round: 0.8 * bump(t, 0, 0.65),
    "mouth_○": 0.5 * bump(t, 0.1, 0.45),
  }),
};

/** Eyes follow the pointer through the directional morphs. */
const gaze = (/** @type {{ x: number; y: number }} */ look) => ({
  eye_left: clamp(look.x, 0, 1) * 0.85,
  eye_right: clamp(-look.x, 0, 1) * 0.85,
  eye_up: clamp(look.y, 0, 1) * 0.65,
  eye_down: clamp(-look.y, 0, 1) * 0.65,
});

/** Merge faces, keeping the strongest weight per morph. @param {Faces[]} faces */
const strongest = (...faces) => {
  /** @type {Faces} */
  const out = {};
  for (const face of faces) {
    for (const [name, value] of Object.entries(face)) {
      out[name] = clamp(Math.max(out[name] ?? 0, value), 0, 1);
    }
  }
  return out;
};

/**
 * @param {{
 *   tracks: Record<string, Track>;
 *   random?: () => number;
 * }} options
 */
export const createMotion = ({ tracks, random = Math.random }) => {
  /** @param {string} name */
  const track = (name) => tracks[name] ?? { duration: 1 };
  /** @param {string} name */
  const length = (name) => track(name).duration;
  /** @param {string} name @param {"travel" | "ground"} key @param {number} t */
  const read = (name, key, t) => sample(track(name)[key], length(name), t);

  const runPeriod = length("run");
  const runEnd = runCycles * runPeriod;
  const haltLength = length("halt");
  const haltEnd = runEnd + haltLength;
  const cycleTravel = read("run", "travel", runPeriod);
  const runDistance = runCycles * cycleTravel;
  const path = createPath(runDistance + read("halt", "travel", haltLength));

  let time = 0;
  /** Clock for blinks, saccades and gestures; runs from the halt on. */
  let watchTime = 0;
  /** Time since the halt ended, for the hand-over to the moods. */
  let settledFor = 0;

  // Pointer target in -1..1 (x right, y up); eyes hold a fixation point and
  // jump to the next one, the head chases them on a spring.
  const target = { x: 0, y: 0 };
  const last = { x: 0, y: 0 };
  const fixation = { x: 0, y: 0 };
  const eyes = { x: 0, y: 0 };
  const head = createSpring(10, 0.5);
  const body = createSpring(5, 0.75);
  let nextSaccade = 0.3;
  let isInside = false;
  let speed = 0;
  let stillFor = 0;

  // Moods, 0..1, smoothed into base clip weights.
  let excitement = 0;
  let petting = 0;
  /** @type {Record<string, number>} */
  const weights = { idle: 1, hunt: 0, nuzzle: 0 };
  let alert = 0;

  // Head tilt and blinking.
  let tilt = 0;
  let tiltSpeed = 0;
  let tiltTarget = 0.2;
  let nextTilt = 1.5;
  let nextBlink = 1.2;
  let blinkStart = -1;

  /** @type {{ name: string; start: number }[]} */
  let active = [];
  /** @type {string[]} */
  let queue = [];
  let swipeCooldown = 0;
  let nextFlick = 1.5;
  let nextBored = 10;
  let hasNoticed = false;

  const busy = () => active.some((g) => !earFlicks.includes(g.name));

  /** @param {string} name */
  const play = (name) => {
    active = active.filter((g) => g.name != name);
    active.push({ name, start: watchTime });
  };

  const blinkNow = () => {
    if (watchTime - blinkStart > 0.35) blinkStart = watchTime;
  };

  const blink = () => {
    if (watchTime >= nextBlink) {
      blinkStart = watchTime;
      // Occasionally a quick double blink.
      nextBlink = watchTime + (random() < 0.25 ? 0.3 : 2 + random() * 3);
    }
    // While petted she slow-blinks: the cat way of saying she trusts you.
    const slow = petting > 0.5;
    return bump(watchTime, blinkStart, blinkStart + (slow ? 0.9 : 0.18));
  };

  /** Eyes jump between fixation points instead of gliding. */
  const saccade = (/** @type {number} */ delta) => {
    const dx = target.x - fixation.x;
    const dy = target.y - fixation.y;
    const gap = Math.hypot(dx, dy);
    if (gap > 0.14 || watchTime >= nextSaccade) {
      // Small jitter around the target keeps a still gaze alive.
      fixation.x = target.x + (random() - 0.5) * 0.06;
      fixation.y = target.y + (random() - 0.5) * 0.04;
      nextSaccade = watchTime + 0.35 + random() * 0.9;
      // Big gaze shifts come with a blink, as in people and cats.
      if (gap > 0.7) blinkNow();
    }
    eyes.x += (fixation.x - eyes.x) * follow(40, delta);
    eyes.y += (fixation.y - eyes.y) * follow(40, delta);
  };

  /** Decide gestures and moods from the pointer; runs once settled. */
  const think = (/** @type {number} */ delta) => {
    const dx = target.x - last.x;
    const dy = target.y - last.y;
    last.x = target.x;
    last.y = target.y;
    const instant = delta > 0 ? Math.hypot(dx, dy) / delta : 0;
    speed += (instant - speed) * follow(10, delta);
    stillFor = instant > 0.05 ? 0 : stillFor + delta;

    const overHead = isInside && Math.hypot(target.x, target.y) < 0.7;
    const isStroke = overHead && speed > 0.15 && speed < preySpeed;
    const isPrey = isInside && speed >= preySpeed;

    petting = clamp(petting + (isStroke ? delta * 1.4 : -delta * 0.9), 0, 1);
    excitement = clamp(
      excitement + (isPrey ? delta * 1.8 : -delta * 0.5) - petting * delta,
      0,
      1.5,
    );
    alert = clamp(alert + (instant > 0.4 ? delta * 4 : -delta * 0.7), 0, 1);

    if (!hasNoticed) {
      hasNoticed = true;
      play("notice");
    }

    // Bat at prey on the side it is on: screen right is her left paw.
    swipeCooldown -= delta;
    if (excitement > 0.9 && swipeCooldown <= 0 && !busy()) {
      play(target.x >= 0 ? "swipe_l" : "swipe_r");
      swipeCooldown = 0.9 + random() * 0.6;
      excitement -= 0.35;
    }

    if (watchTime >= nextFlick) {
      play(random() < 0.5 ? "ear_flick_l" : "ear_flick_r");
      nextFlick = watchTime + 3 + random() * 6;
    }

    // Left alone she gets on with cat things, at her own pace.
    if (stillFor > 8 && watchTime >= nextBored && !busy()) {
      play(random() < 0.6 ? "groom" : "yawn");
      nextBored = watchTime + 18 + random() * 12;
    }

    const next = queue[0];
    if (next && !busy()) {
      queue = queue.slice(1);
      play(next);
    }

    const mood = petting > 0.45 ? "nuzzle" : excitement > 0.35 ? "hunt" : "idle";
    for (const name of moods) {
      weights[name] = (weights[name] ?? 0) +
        ((name == mood ? 1 : 0) - (weights[name] ?? 0)) * follow(5, delta);
    }
  };

  /** Pointer reactions layered over the clips; `k` fades them in. */
  const react = (/** @type {number} */ delta, /** @type {number} */ k) => {
    saccade(delta);
    const hunt = weights.hunt ?? 0;
    const nuzzle = weights.nuzzle ?? 0;
    // On the hunt the head locks on harder.
    const aim = head.step({ x: eyes.x * (1 + 0.2 * hunt), y: eyes.y }, delta);
    const lean = body.step(aim, delta);

    if (watchTime >= nextTilt) {
      tiltTarget = (random() < 0.5 ? -1 : 1) * (0.12 + random() * 0.18);
      nextTilt = watchTime + 1.8 + random() * 2.5;
    }
    // Tilt on its own soft spring, so it swings over and settles.
    tiltSpeed += (36 * (tiltTarget - tilt) - 6 * tiltSpeed) * delta;
    tilt += tiltSpeed * delta;
    const lookTilt = tilt * (1 - hunt) + nuzzle * 0.25 * Math.sin(watchTime * 4);

    return {
      Spine: { y: lean.x * 0.06 * k },
      Chest: { x: -lean.y * 0.04 * k, y: lean.x * 0.1 * k },
      Neck: { x: -aim.y * 0.12 * k, y: aim.x * 0.2 * k },
      Head: {
        x: -aim.y * 0.28 * k,
        y: aim.x * 0.42 * k,
        z: lookTilt * k,
      },
      // Ears swivel toward the pointer and prick up when it moves.
      "KemoEar.L": { x: 0.3 * alert * k, z: -0.25 * aim.x * k },
      "KemoEar.R": { x: 0.3 * alert * k, z: -0.25 * aim.x * k },
    };
  };

  /** @param {number} delta @returns {Frame} */
  const watch = (delta) => {
    watchTime += delta;
    think(delta);

    /** @type {ClipState[]} */
    const gestures = [];
    /** @type {Faces[]} */
    const faces = [];
    let focus = 1;
    active = active.filter(({ name, start }) => {
      const t = watchTime - start;
      const end = length(name);
      if (t >= end) return false;
      const weight = envelope(t, end);
      gestures.push({ name, time: t, weight });
      const face = gestureFaces[name];
      if (face) {
        faces.push(Object.fromEntries(Object.entries(face(t))
          .map(([key, value]) => [key, value * weight])));
      }
      // Grooming and yawning look away from the pointer.
      if (name == "groom" || name == "yawn") focus = Math.min(focus, 1 - weight);
      return true;
    });

    const turns = react(delta, focus);
    const hunt = weights.hunt ?? 0;
    const nuzzle = weights.nuzzle ?? 0;

    // The halt hands over to the moods.
    settledFor += delta;
    const fade = smooth(settledFor / handover);
    /** @type {ClipState[]} */
    const clips = moods.map((name) => ({
      name,
      time: watchTime % length(name),
      weight: (weights[name] ?? 0) * fade,
    }));
    if (fade < 1) clips.push({ name: "halt", time: haltLength, weight: 1 - fade });
    const lift = clips.reduce((sum, clip) =>
      sum + read(clip.name, "ground", clip.time) * clip.weight, 0);

    const startle = gestures.find((g) => g.name == "startle")?.weight ?? 0;
    const pounce = gestures
      .filter((g) => g.name.startsWith("swipe"))
      .reduce((sum, g) => sum + g.weight, 0);
    const end = path.at(Infinity);

    return {
      phase: "watch",
      clips,
      gestures,
      turns,
      face: strongest(
        {
          ...gaze(eyes),
          eye_round: 0.25 + 0.75 * hunt,
          "mouth_ω": 0.45 * (1 - hunt),
          eye_joy: 0.9 * nuzzle,
          eye_close: blink(),
        },
        { "mouth_ω": nuzzle, eye_close: 0.45 * nuzzle },
        ...faces,
      ),
      // Hop back on a boop, lean in on a pounce.
      x: end.x,
      z: end.z - 0.05 * startle + 0.03 * pounce,
      heading: head.value.x * 0.1,
      roll: 0,
      lift,
      closeUp: smooth((time - runEnd - dolly.start) / dolly.length),
      look: { x: eyes.x, y: eyes.y },
    };
  };

  /** Place her on the path by distance travelled. */
  const travel = (/** @type {number} */ distance,
    /** @type {number} */ speed) => {
    const at = path.at(distance);
    // Lean into the turn: centripetal tilt, kept subtle.
    const roll = clamp(-at.curvature * speed * speed * 0.035, -0.22, 0.22);
    return { x: at.x, z: at.z, heading: at.heading, roll };
  };

  return {
    /** @param {number} x @param {number} y pointer in -1..1, y up */
    lookAt(x, y) {
      target.x = clamp(x, -1.2, 1.2);
      target.y = clamp(y, -1.2, 1.2);
      isInside = Math.abs(x) <= 1 && Math.abs(y) <= 1;
    },

    /** The pointer left the page; she slowly loses interest. */
    leave() {
      isInside = false;
      target.x = 0;
      target.y = -0.2;
    },

    /** A tap boops her: flinch, then shake it off. While petted, just shake. */
    poke() {
      excitement = 0;
      if (petting > 0.3) {
        play("shake");
      } else {
        active = active.filter((g) => earFlicks.includes(g.name));
        play("startle");
        queue = ["shake"];
      }
    },

    get time() {
      return time;
    },

    get isSettled() {
      return time >= runEnd + haltLength * 0.5;
    },

    /** Restart from outside the view. */
    reset() {
      time = 0;
      settledFor = 0;
      active = [];
      queue = [];
      hasNoticed = false;
    },

    /** Skip straight to the close-up, for reduced motion. */
    settle() {
      time = Math.max(haltEnd, runEnd + dolly.start + dolly.length);
      settledFor = handover;
    },

    /** @param {number} delta seconds @returns {Frame} */
    update(delta) {
      time += delta;

      if (time < runEnd) {
        const cycle = Math.floor(time / runPeriod);
        const t = time - cycle * runPeriod;
        const distance = cycle * cycleTravel + read("run", "travel", t);
        return {
          phase: "run",
          clips: [{ name: "run", time: t, weight: 1 }],
          gestures: [],
          turns: {},
          face: { "mouth_○": 0.45, eye_joy: 0.55 },
          ...travel(distance, cycleTravel / runPeriod),
          lift: read("run", "ground", t),
          closeUp: 0,
          look: { x: 0, y: 0 },
        };
      }

      if (time < haltEnd) {
        const t = time - runEnd;
        const distance = runDistance + read("halt", "travel", t);
        const speed = (read("halt", "travel", t + 0.02) -
          read("halt", "travel", t)) / 0.02;
        const k = smooth((t - dolly.start) / dolly.length);
        // She looks up at the camera as it comes in.
        watchTime += delta;
        const turns = react(delta, k);
        return {
          phase: "halt",
          clips: [{ name: "halt", time: t, weight: 1 }],
          gestures: [],
          turns,
          face: {
            ...gaze(eyes),
            eye_round: 0.8 * bump(t, 0.05, 0.9),
            eyebrow_surprised: 0.7 * bump(t, 0.05, 0.8),
            "mouth_○": 0.6 * bump(t, 0, 0.75),
            eye_joy: 0.6 * bump(t, 0.6, 1.4),
            "mouth_ω": 0.45 * smooth((t - 0.9) / 0.6),
          },
          ...travel(distance, speed),
          lift: read("halt", "ground", t),
          closeUp: k,
          look: { x: eyes.x, y: eyes.y },
        };
      }

      return watch(delta);
    },
  };
};
