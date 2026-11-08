"""Author the Kipfel animation clips in Blender.

Run inside Blender (MCP, Text Editor or `blender -b -P <this file>`):
imports components/kipfel/model/kipfel.glb into its own scene, bakes one
action per clip on the armature and exports the armature alone with every
action as a glTF animation to components/kipfel/model/kipfel_clips.glb.
scripts/optimize_clips.ts then drops static channels and compresses it.

A pose turns bones about the model's rest-pose axes, the same convention as
components/kipfel_rig.js (glTF space: the model faces +z, y up, T-pose arms
along ±x). `both` mirrors a left-side turn onto the right side.

The upper body never moves rigidly from key to key: every bone chases its
target pose through a damped spring tuned to its weight (spine stiff, head
softer, ears, ahoge and tail loose), so motion overlaps, lags and
overshoots like a body.

Legs are not sprung but solved: every clip has a footstep plan in world
space (when each toe plants, where, and when it lifts), plus the body's
forward travel and height. Planted toes stay exactly where they landed, a
two-bone IK puts the knee and ankle there and rolls the foot over the toe
for push-off, so feet cannot slide. Per clip the exporter writes `travel`
and `ground` (one value per frame, in model heights) into the animation
extras; the page moves the model by exactly that.

Clips (base clips blend normally, the rest play additively over `base`):
  base         one frame, the reference pose for every additive gesture
  run          loop, quick cat-girl scamper toward the camera, paws up
  halt         from the run: a braking step, the other foot pulls in
               beside it, knees give, she bounces up onto her toes and
               settles into the curious base pose
  idle         loop, breathing and tail swish around the base pose
  hunt         loop, crouched, rear wiggling before a pounce
  nuzzle       loop, leans into a petting hand
  notice       ears up, head tilts: "oh, you"
  ear_flick_l  one ear twitches (and _r)
  shake        shakes the head after a boop
  groom        licks a paw, then washes over face and ear
  swipe_l      bats at the pointer with the left paw (and _r)
  startle      flinches: ears flat, shoulders up, tail bristled
  yawn         stretches paws forward and yawns
"""

import json
import math
import os
import re
import sys

import bpy
from mathutils import Quaternion, Vector

# Blender's Text Editor and MCP runs do not put this folder on sys.path.
here = os.path.dirname(os.path.abspath(__file__)) if "__file__" in globals() \
    else os.path.join(os.path.expanduser("~"), "Desktop", "articles",
                      "scripts", "blender")
if here not in sys.path:
    sys.path.insert(0, here)
import importlib

import kipfel_gait as gait

importlib.reload(gait)

root = os.environ.get(
    "KIPFEL_ROOT",
    os.path.join(os.path.expanduser("~"), "Desktop", "articles"),
)
model = os.path.join(root, "components", "kipfel", "model", "kipfel.glb")
target = os.path.join(root, "components", "kipfel", "model", "kipfel_clips.glb")
scene_name = "kipfel"
fps = 30
substeps = 8
tau = math.pi * 2

# glTF axes in Blender armature space (the importer turns y-up into z-up).
axes = {
    "x": Vector((1, 0, 0)),
    "y": Vector((0, 0, 1)),
    "z": Vector((0, -1, 0)),
}


# --- small math -----------------------------------------------------------

def clamp(value, low, high):
    return min(high, max(low, value))


def smooth(t):
    x = clamp(t, 0, 1)
    return x * x * (3 - 2 * x)


def bump(t, start, end):
    """Smooth 0..1..0 envelope over [start, end]."""
    if t <= start or t >= end:
        return 0.0
    return math.sin((t - start) / (end - start) * math.pi) ** 2


def ramp(t, start, end):
    return smooth((t - start) / (end - start))


# --- pose building --------------------------------------------------------

def both(name, x=0.0, y=0.0, z=0.0):
    """Left turn plus its mirror on the right side."""
    return {
        f"{name}.L": {"x": x, "y": y, "z": z},
        f"{name}.R": {"x": x, "y": -y, "z": -z},
    }


def side(name, which, x=0.0, y=0.0, z=0.0):
    """One side only, given in left-side terms and mirrored for R."""
    sign = 1 if which == "L" else -1
    return {f"{name}.{which}": {"x": x, "y": y * sign, "z": z * sign}}


def add(*poses):
    """Sum turns axis by axis; fine for authoring small layered offsets."""
    out = {}
    for pose in poses:
        for bone, turn in pose.items():
            into = out.setdefault(bone, {})
            for axis, angle in turn.items():
                into[axis] = into.get(axis, 0.0) + angle
    return out


def scale(pose, k):
    return {b: {a: v * k for a, v in t.items()} for b, t in pose.items()}


def mix(a, b, k):
    return add(scale(a, 1 - k), scale(b, k))


def keyed(t, keys):
    """Target along (time, pose) keys, eased between them; holds outside."""
    if t <= keys[0][0]:
        return keys[0][1]
    for (t0, p0), (t1, p1) in zip(keys, keys[1:]):
        if t <= t1:
            return mix(p0, p1, smooth((t - t0) / (t1 - t0)))
    return keys[-1][1]


fingers = [
    "IndexInterProxima", "IndexIntermediate", "IndexDistal",
    "MiddleProxima", "MiddleIntermediate", "MiddleDistal",
    "RingProxima", "RingIntermediate", "RingDistal",
    "LittleProxima", "LittleIntermediate", "LittleDistal",
]


def paw(which, k):
    """Curl one hand into a soft cat paw; k = 0 open, 1 curled."""
    pose = {}
    for name in fingers:
        pose.update(side(name, which, z=-0.75 * k))
    pose.update(side("ThumbIntermediate", which, z=-0.3 * k))
    return pose


def paws(k):
    return add(paw("L", k), paw("R", k))


def tail(t, speed, amount, lift=0.0, curl=0.0):
    """Swinging tail, each joint a little later; curl hooks the tip."""
    pose = {}
    for i in range(6):
        pose[f"Tail.00{i + 1}"] = {
            "y": math.sin(t * speed - i * 0.6) * amount * (0.6 + i * 0.12),
            "x": lift * (1 if i == 0 else 0.25) - curl * (i >= 3),
        }
    return pose


def ear_chain(which, x=0.0, z=0.0, tip=0.0):
    """Ear bones are named KemoEar.L, KemoEar.L.001, KemoEar.L.002."""
    sign = 1 if which == "L" else -1
    return {
        f"KemoEar.{which}": {"x": x, "z": z * sign},
        f"KemoEar.{which}.001": {"x": tip},
        f"KemoEar.{which}.002": {"x": tip * 0.6},
    }


def both_ears(x=0.0, z=0.0, tip=0.0):
    return add(ear_chain("L", x, z, tip), ear_chain("R", x, z, tip))


def ahoge(x=0.0, z=0.0):
    return {
        "Ahoge.A": {"x": x * 0.5, "z": z * 0.5},
        "Ahoge.A.001": {"x": x, "z": z},
        "Ahoge.A.002": {"x": x * 0.7, "z": z * 0.7},
    }


def side_hair(x=0.0, z=0.0):
    return add(both("Hair_Side", x=x, z=z), both("Hair_Side", x=x * 0.6))


# --- springs --------------------------------------------------------------

# (pattern, angular frequency in rad/s, damping ratio). Heavy, short bones
# follow tightly; light, long ones lag and overshoot. Leg turns from the
# springs are discarded, the gait plan replaces them.
stiffness = [
    (r"^Hips$", 40, 0.9),
    (r"^Spine$", 30, 0.75),
    (r"^Chest$", 24, 0.7),
    (r"^Neck$", 19, 0.62),
    (r"^Head$", 16, 0.55),
    (r"^Shoulder\.", 26, 0.7),
    (r"^UpperArm\.", 22, 0.62),
    (r"^LowerArm\.", 18, 0.55),
    (r"^Hand\.", 15, 0.5),
    (r"^(Index|Middle|Ring|Little|Thumb)", 16, 0.6),
    (r"^KemoEar\.[LR]$", 15, 0.35),
    (r"^KemoEar\.[LR]\.00\d$", 12, 0.28),
    (r"^(Hair_Ahoge|Ahoge)", 10, 0.22),
    (r"^(Hair|BackHair)", 9, 0.35),
    (r"^Cap_Ribbon", 8, 0.3),
]


def spring_of(bone):
    match = re.match(r"^Tail\.00(\d)$", bone)
    if match:
        return 15 - 1.6 * int(match.group(1)), 0.38
    for pattern, omega, zeta in stiffness:
        if re.match(pattern, bone):
            return omega, zeta
    return 20, 0.7


class Springs:
    """Per bone and axis damped springs chasing a target pose."""

    def __init__(self, state=None):
        # (bone, axis) -> [value, velocity]
        self.state = {k: list(v) for k, v in (state or {}).items()}

    def snap(self, pose):
        for bone, turn in pose.items():
            for axis, value in turn.items():
                self.state[(bone, axis)] = [value, 0.0]

    def step(self, pose, dt):
        goal = {(b, a): v for b, turn in pose.items() for a, v in turn.items()}
        for key in goal:
            self.state.setdefault(key, [goal[key], 0.0])
        for key, s in self.state.items():
            omega, zeta = spring_of(key[0])
            accel = omega * omega * (goal.get(key, 0.0) - s[0]) - \
                2 * zeta * omega * s[1]
            s[1] += accel * dt
            s[0] += s[1] * dt

    def pose(self):
        out = {}
        for (bone, axis), (value, _) in self.state.items():
            out.setdefault(bone, {})[axis] = value
        return out

    def copy(self):
        return Springs(self.state)


def simulate(target, seconds, springs=None, warmup=0.0):
    """Frames of sprung poses for `target(t)`; returns (poses, springs)."""
    springs = springs or Springs()
    if not springs.state:
        springs.snap(target(-warmup))
    dt = 1 / (fps * substeps)
    for i in range(round(warmup * fps * substeps)):
        springs.step(target(-warmup + i * dt), dt)
    frames = max(1, round(seconds * fps))
    poses = [springs.pose()]
    for frame in range(frames):
        for sub in range(substeps):
            springs.step(target((frame + sub / substeps) / fps), dt)
        poses.append(springs.pose())
    return poses, springs


# --- clips ----------------------------------------------------------------

def base_pose():
    """Curious stance, paws held up in front of the chest."""
    return add(
        {"Spine": {"x": 0.1}, "Chest": {"x": 0.12}, "Neck": {"x": -0.05}},
        both("UpperArm", z=-1.05, y=-0.55, x=0.25),
        both("LowerArm", y=1.55),
        both("Hand", x=0.4),
        paws(0.8),
        both("UpperLeg", x=-0.06),
        both("LowerLeg", x=0.12),
        both("foot", x=-0.06),
        both_ears(x=0.12),
        tail(0, 0, 0, lift=1.0, curl=0.35),
    )


base = base_pose()

run_period = gait.run_period


def upper_run(t):
    """Upper body over the run; legs come from the gait plan."""
    c = tau * t / run_period
    # Bounce is twice per cycle, one per step; the body dips on each landing.
    step = math.cos(2 * c)
    return add(
        {
            # Pelvis turns with the reaching leg, chest counters it.
            "Hips": {"y": -0.12 * math.cos(c), "z": 0.03 * math.sin(c)},
            "Spine": {"x": 0.22 + 0.05 * step, "y": 0.04 * math.cos(c)},
            "Chest": {"x": 0.06, "y": 0.14 * math.cos(c)},
            "Neck": {"x": -0.12},
            "Head": {"x": -0.12 - 0.05 * step, "y": -0.05 * math.cos(c)},
            # Paws held up at the chest, pumping against the legs.
            "UpperArm.L": {"z": -1.1, "y": -0.4, "x": 0.25 + 0.45 * math.cos(c)},
            "UpperArm.R": {"z": 1.1, "y": 0.4, "x": 0.25 - 0.45 * math.cos(c)},
            "LowerArm.L": {"y": 1.65},
            "LowerArm.R": {"y": -1.65},
            "Hand.L": {"x": 0.5},
            "Hand.R": {"x": 0.5},
        },
        paws(1),
        # Ears pushed back by the wind; the springs make them flop per step.
        both_ears(x=-0.35, tip=-0.1),
        ahoge(x=0.15),
        tail(t, tau / run_period, 0.24, lift=0.7, curl=0.15),
    )


def run(t):
    return upper_run(t)


halt_length = gait.halt_length

# Upper body keys over the halt: brace against the stop, sink, bounce up
# with the paws thrown up ("ta-da"), settle into the curious base pose.
brace = add(
    {"Spine": {"x": -0.05}, "Chest": {"x": -0.12}, "Neck": {"x": 0.05},
     "Head": {"x": 0.1}},
    both("UpperArm", z=-0.75, y=-0.35, x=-0.35),
    both("LowerArm", y=0.9),
    both("Hand", x=0.2),
    paws(0.3),
    both_ears(x=0.4, z=0.12),
    tail(0, 0, 0, lift=1.2),
    ahoge(x=-0.45),
)
sink = add(
    {"Spine": {"x": 0.3}, "Chest": {"x": 0.12}, "Head": {"x": -0.1}},
    both("UpperArm", z=-1.15, y=-0.25, x=0.55),
    both("LowerArm", y=1.35),
    paws(1),
    both_ears(x=0.25),
    tail(0, 0, 0, lift=0.7),
)
pop = add(
    {"Spine": {"x": 0.0}, "Chest": {"x": -0.08}, "Neck": {"x": -0.08},
     "Head": {"x": -0.18, "z": 0.12}},
    both("UpperArm", z=-0.95, y=-0.95, x=-0.15),
    both("LowerArm", y=1.45),
    both("Hand", x=0.65),
    paws(0.55),
    both_ears(x=0.55, z=0.15),
    tail(0, 0, 0, lift=1.35, curl=0.3),
)
perk = add(base, {"Head": {"z": 0.24, "x": -0.06}}, both_ears(x=0.35))


def halt(t):
    if t < 0.12:
        start = upper_run(t)
        return mix(start, brace, smooth(t / 0.12))
    return keyed(t, [
        (0.12, brace),
        (0.32, mix(brace, sink, 0.5)),
        (0.46, sink),
        (0.64, pop),
        (0.95, perk),
        (halt_length - 0.35, base),
    ])


idle_period = 4.0


def idle(t):
    w = tau / idle_period
    breath = math.sin(2 * w * t)
    return add(
        base,
        {
            "Spine": {"x": 0.012 * breath, "z": 0.025 * math.sin(w * t)},
            "Chest": {"x": 0.018 * breath, "y": 0.03 * math.sin(w * t)},
            "Head": {"z": 0.035 * math.sin(w * t + 1)},
            "UpperLeg.L": {"z": -0.02 * math.sin(w * t)},
            "UpperLeg.R": {"z": -0.02 * math.sin(w * t)},
        },
        both("UpperArm", x=0.025 * breath),
        tail(t, 2 * w, 0.3),
        ahoge(x=0.08 * math.sin(3 * w * t)),
    )


def notice(t):
    """Spots the viewer: ears snap up, chin up, head tilts, settles."""
    return keyed(t, [
        (0.0, base),
        (0.12, add(base, both_ears(x=0.5, z=0.12), {"Head": {"x": -0.12}},
                   ahoge(x=-0.25))),
        (0.42, add(base, both_ears(x=0.4), {"Head": {"x": -0.05, "z": 0.3}},
                   tail(0, 0, 0, curl=-0.2))),
        (0.9, add(base, {"Head": {"z": 0.2}})),
        (1.3, base),
    ])


def ear_flick(which):
    def sample(t):
        snap = bump(t, 0, 0.1)
        return add(
            base,
            ear_chain(which, x=-0.8 * snap, z=-0.3 * snap,
                      tip=-0.45 * bump(t, 0.02, 0.14)),
        )
    return sample


def shake(t):
    decay = 1 - ramp(t, 0.1, 0.75)
    wobble = math.sin(t * tau * 5.5) * decay * ramp(t, 0, 0.05)
    return add(
        base,
        {
            "Head": {"y": 0.42 * wobble, "z": 0.12 * wobble},
            "Neck": {"y": 0.12 * wobble},
            "Chest": {"y": -0.05 * wobble},
        },
    )


# Right paw up at the mouth, used by groom.
paw_at_mouth = add(
    side("UpperArm", "R", z=-0.75, y=-1.15, x=0.35),
    side("LowerArm", "R", y=2.35),
    side("Hand", "R", x=0.55, z=0.2),
)
paw_over_ear = add(
    side("UpperArm", "R", z=-0.05, y=-1.0, x=0.2),
    side("LowerArm", "R", y=2.2),
    side("Hand", "R", x=0.7, z=0.35),
)


def groom(t):
    head_down = {"Head": {"x": 0.3, "z": -0.12, "y": -0.22}}
    head_wash = {"Head": {"x": 0.12, "z": -0.32, "y": -0.12}}
    pose = keyed(t, [
        (0.0, base),
        (0.4, add(base, paw_at_mouth, head_down)),
        (1.55, add(base, paw_at_mouth, head_down)),
        (1.85, add(base, paw_over_ear, head_wash)),
        (2.6, add(base, paw_over_ear, head_wash)),
        (2.95, base),
    ])
    licks = sum(bump(t, 0.5 + i * 0.3, 0.72 + i * 0.3) for i in range(3))
    strokes = math.sin((t - 1.85) * tau * 2.2) * bump(t, 1.8, 2.65)
    return add(
        pose,
        {"Head": {"x": 0.1 * licks}},
        side("Hand", "R", x=-0.18 * licks),
        side("LowerArm", "R", y=-0.35 * strokes),
        {"Head": {"z": -0.07 * strokes}},
        # The ear on the washed side folds under the paw.
        ear_chain("R", x=-0.4 * bump(t, 1.7, 2.75), z=-0.3 * bump(t, 1.7, 2.75)),
    )


def swipe(which):
    raised = add(
        side("UpperArm", which, z=-0.15, y=-0.95, x=0.1),
        side("LowerArm", which, y=1.9),
        side("Hand", which, x=0.6),
        paw(which, 1),
    )
    strike = add(
        side("UpperArm", which, z=-0.7, y=-1.4, x=0.1),
        side("LowerArm", which, y=0.35),
        side("Hand", which, x=-0.25),
        paw(which, 0.2),
    )
    lean = 1 if which == "L" else -1

    def sample(t):
        pose = keyed(t, [
            (0.0, base),
            (0.16, add(base, raised)),
            (0.24, add(base, strike)),
            (0.36, add(base, strike)),
            (0.7, base),
        ])
        k = bump(t, 0.04, 0.55)
        return add(
            pose,
            {
                "Spine": {"x": 0.06 * k, "y": 0.1 * lean * k},
                "Chest": {"y": 0.12 * lean * k},
                "Head": {"x": 0.08 * k, "y": 0.12 * lean * k},
            },
            both_ears(x=0.3 * k),
            tail(t, 18, 0.15 * k),
        )
    return sample


def startle(t):
    jolt = ramp(t, 0, 0.05) * (1 - ramp(t, 0.3, 0.75))
    return add(
        base,
        scale(add(
            {
                "Spine": {"x": -0.12},
                "Chest": {"x": -0.08},
                "Neck": {"x": 0.1},
                "Head": {"x": -0.18},
            },
            both("Shoulder", z=0.3),
            both("UpperArm", z=0.25, y=-0.2),
            both("LowerArm", y=0.35),
            paws(-0.5),
            both_ears(x=-0.9, z=-0.35, tip=-0.3),
            tail(0, 0, 0, lift=0.5, curl=-0.35),
            ahoge(x=-0.6),
        ), jolt),
    )


def yawn(t):
    stretch = add(
        {"Spine": {"x": 0.08}, "Chest": {"x": -0.05}, "Neck": {"x": -0.2},
         "Head": {"x": -0.32}},
        both("UpperArm", z=0.2, y=-0.75),
        both("LowerArm", y=-1.25),
        both("Hand", x=-0.3),
        paws(-0.9),
        both_ears(x=-0.45, z=-0.45),
        tail(0, 0, 0, curl=-0.4),
    )
    pose = keyed(t, [
        (0.0, base),
        (0.6, add(base, stretch)),
        (1.5, add(base, stretch)),
        (2.0, base),
    ])
    tremble = math.sin(t * 40) * bump(t, 0.65, 1.45)
    return add(pose, both("UpperArm", x=0.03 * tremble))


nuzzle_period = 1.6


def nuzzle(t):
    w = tau / nuzzle_period
    rub = math.sin(w * t)
    return add(
        base,
        {
            "Chest": {"x": 0.05, "y": 0.04 * rub},
            "Neck": {"x": 0.1, "z": 0.06 * rub},
            "Head": {"x": 0.06, "z": 0.24 * rub, "y": 0.08 * math.sin(w * t + 1)},
        },
        # Relaxed "airplane" ears.
        both_ears(x=-0.35, z=-0.45),
        tail(t, w * 2, 0.2, lift=0.2),
    )


hunt_period = 0.5


def hunt(t):
    w = tau / hunt_period
    wiggle = math.sin(w * t)
    return add(
        base,
        {
            "Hips": {"y": 0.09 * wiggle},
            "Spine": {"x": 0.14, "y": -0.05 * wiggle},
            "Chest": {"x": 0.1},
            "Neck": {"x": -0.12},
            "Head": {"x": -0.1},
        },
        both_ears(x=0.5, tip=0.15),
        paws(0.4),
        tail(t, w, 0.1, lift=-1.1),
    )


class Clip:
    def __init__(self, target, seconds, loop=False, legs=None, after=None,
                 settle=0.0):
        self.target = target
        self.seconds = seconds
        self.loop = loop
        # Gait plan: t -> gait.Step with leg turns, travel and rise.
        self.legs = legs or (lambda t: gait.stand())
        # Start the springs from the end of another clip (halt after run).
        self.after = after
        self.settle = settle


clips = {
    "base": Clip(lambda t: base, 1 / fps, settle=2.0),
    "run": Clip(run, run_period, loop=True, legs=gait.run_plan),
    "halt": Clip(halt, halt_length, legs=gait.halt_plan, after="run"),
    "idle": Clip(idle, idle_period, loop=True),
    "hunt": Clip(hunt, hunt_period, loop=True,
                 legs=lambda t: gait.hunt_plan(t, hunt_period)),
    "nuzzle": Clip(nuzzle, nuzzle_period, loop=True),
    "notice": Clip(notice, 1.6),
    "ear_flick_l": Clip(ear_flick("L"), 0.6),
    "ear_flick_r": Clip(ear_flick("R"), 0.6),
    "shake": Clip(shake, 1.1),
    "groom": Clip(groom, 3.3),
    "swipe_l": Clip(swipe("L"), 0.95),
    "swipe_r": Clip(swipe("R"), 0.95),
    "startle": Clip(startle, 1.0),
    "yawn": Clip(yawn, 2.5),
}


# --- Blender side ---------------------------------------------------------

def setup():
    """Fresh scene with only the imported model, reused across runs."""
    scene = bpy.data.scenes.get(scene_name)
    if scene is None:
        scene = bpy.data.scenes.new(scene_name)
    bpy.context.window.scene = scene
    for obj in list(scene.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    scene.render.fps = fps
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=model)
    imported = [o for o in bpy.data.objects if o not in before]
    for obj in imported:
        if obj.name.startswith("Icosphere"):
            obj.hide_render = True
            obj.hide_set(True)
    arm = next(o for o in imported if o.type == "ARMATURE")
    arm.name = "kipfel"
    arm.animation_data_create()
    return scene, arm


def delta(turn):
    q = Quaternion()
    for axis, angle in turn.items():
        if angle:
            q = Quaternion(axes[axis], angle) @ q
    return q


def apply(arm, pose):
    """Write a pose; bones missing from it go back to rest."""
    for pb in arm.pose.bones:
        rest = pb.bone.matrix_local.to_quaternion()
        turn = pose.get(pb.name)
        pb.rotation_mode = "QUATERNION"
        pb.location = (0, 0, 0)
        pb.rotation_quaternion = (
            rest.inverted() @ delta(turn) @ rest if turn else Quaternion()
        )


def rest_extent(arm):
    """Lowest and highest rest-pose vertex, for the floor and the scale."""
    zs = [
        (obj.matrix_world @ v.co).z
        for obj in bpy.context.scene.objects
        if obj.type == "MESH" and obj.parent == arm
        for v in obj.data.vertices
    ]
    return min(zs), max(zs)


def bake(arm, name, clip, springs, height):
    action = bpy.data.actions.get(name)
    if action:
        bpy.data.actions.remove(action)
    action = bpy.data.actions.new(name)
    action.use_fake_user = True
    arm.animation_data.action = action

    if clip.loop:
        # Settle into the periodic motion first, then record one cycle.
        poses, state = simulate(clip.target, clip.seconds,
                                warmup=3 * clip.seconds)
        poses[-1] = poses[0]
    else:
        start = springs.get(clip.after)
        poses, state = simulate(
            clip.target, clip.seconds,
            springs=start.copy() if start else None,
            warmup=clip.settle,
        )
    springs[name] = state

    # Legs come straight from the footstep plan, never from the springs.
    steps = [clip.legs(i / fps) for i in range(len(poses))]
    if clip.loop:
        steps[-1] = gait.Step(steps[0].pose, steps[-1].travel, steps[0].rise)
    poses = [{**pose, **step.pose} for pose, step in zip(poses, steps)]

    bones = sorted({b for pose in poses for b in pose} | set(base))
    for frame, pose in enumerate(poses):
        apply(arm, pose)
        for bone in bones:
            pb = arm.pose.bones.get(bone)
            if pb:
                pb.keyframe_insert("rotation_quaternion", frame=frame)
    for fcurve in fcurves(action):
        for point in fcurve.keyframe_points:
            point.interpolation = "LINEAR"

    action["travel"] = [round(s.travel / height, 5) for s in steps]
    action["ground"] = [round(s.rise / height, 5) for s in steps]
    action.frame_range = (0, len(poses) - 1)
    arm.animation_data.action = None
    return action

def fcurves(action):
    """Blender 4.4+ keeps curves in layered channelbags."""
    if hasattr(action, "layers") and action.layers:
        for layer in action.layers:
            for strip in layer.strips:
                for bag in strip.channelbags:
                    yield from bag.fcurves
    else:
        yield from action.fcurves


def bake_all(arm):
    # The exporter writes every action in the file; drop clips that were
    # renamed or removed since an earlier run.
    for action in list(bpy.data.actions):
        if action.use_fake_user and action.name not in clips:
            bpy.data.actions.remove(action)
    apply(arm, {})
    bpy.context.view_layer.update()
    floor, top = rest_extent(arm)
    springs = {}
    return [
        bake(arm, name, clip, springs, top - floor)
        for name, clip in clips.items()
    ]


def export(arm):
    for obj in bpy.context.view_layer.objects:
        obj.select_set(obj == arm)
    bpy.context.view_layer.objects.active = arm
    # Every action becomes its own glTF animation; the NLA is not used.
    bpy.ops.export_scene.gltf(
        filepath=target,
        use_selection=True,
        export_format="GLB",
        export_extras=True,
        export_animations=True,
        export_animation_mode="ACTIONS",
        export_force_sampling=True,
        export_frame_step=1,
        export_anim_slide_to_zero=True,
        export_reset_pose_bones=True,
        export_optimize_animation_size=False,
        export_skins=True,
        export_morph=False,
        export_materials="NONE",
    )
    return target


def preview(arm, pose, path, camera="full"):
    """Workbench still of one pose, for checking angles while authoring."""
    scene = bpy.context.scene
    apply(arm, pose)
    cam = scene.objects.get("kipfel_cam")
    if cam is None:
        cam = bpy.data.objects.new("kipfel_cam", bpy.data.cameras.new("kipfel_cam"))
        scene.collection.objects.link(cam)
    scene.camera = cam
    shots = {
        "full": ((1.0, -2.2, 0.25), (0, -0.1, 0.0), 50),
        "front": ((0, -2.4, 0.15), (0, -0.1, 0.0), 50),
        "side": ((2.4, -0.1, 0.15), (0, -0.1, 0.0), 50),
        "head": ((0, -0.9, 0.3), (0, -0.1, 0.28), 50),
    }
    eye, look, lens = shots[camera]
    cam.location = eye
    cam.data.lens = lens
    cam.rotation_mode = "QUATERNION"
    cam.rotation_quaternion = (Vector(look) - Vector(eye)).to_track_quat("-Z", "Y")
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.render.resolution_x = 360
    scene.render.resolution_y = 360
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    return path


def main():
    _, arm = setup()
    actions = bake_all(arm)
    path = export(arm)
    return {
        "target": path,
        "clips": {
            a.name: {"frames": len(a["travel"]), "travel": a["travel"][-1],
                     "ground": [min(a["ground"]), max(a["ground"])]}
            for a in actions
        },
    }


if __name__ == "__main__":
    print(json.dumps(main()))
