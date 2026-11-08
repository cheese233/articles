"""Footstep plans and leg IK for scripts/blender/kipfel_actions.py.

Pure math in the rest-pose armature space Blender imports the model into
(z up, the model faces -y), so it can be checked without Blender. Legs
only bend in the sagittal plane, like the authored poses (hip, knee and
ankle turn about x).

Positions are (forward, up) in Blender units; forward is -y. A plan gives,
for every moment, where the hip joints are and where each ankle is. A
planted foot keeps its position while the body moves over it, so nothing
slides: the body's travel is exactly what the planted feet push it.
"""

import math

tau = math.pi * 2

# Rest skeleton of the left leg (the right one mirrors it in x only).
hip_rest = (0.1109, -0.0504)
knee_rest = (0.1109, -0.1992)
ankle_rest = (0.1031, -0.3657)
ball_rest = (0.1618, -0.4062)

thigh = math.dist(hip_rest, knee_rest)
shin = math.dist(knee_rest, ankle_rest)
foot_len = math.dist(ankle_rest, ball_rest)


def _direction(a, b):
    return math.atan2(b[1] - a[1], b[0] - a[0])


thigh_rest = _direction(hip_rest, knee_rest)
shin_rest = _direction(knee_rest, ankle_rest)
foot_rest = _direction(ankle_rest, ball_rest)

floor = ball_rest[1]
# Standing ankle relative to the hip, and its height over the floor.
stand_offset = ankle_rest[0] - hip_rest[0]
ankle_height = ankle_rest[1] - floor


def smooth(t):
    x = min(1.0, max(0.0, t))
    return x * x * (3 - 2 * x)


def bump(t, start, end):
    if t <= start or t >= end:
        return 0.0
    return math.sin((t - start) / (end - start) * math.pi) ** 2


def keyed(t, keys):
    """Value along (time, value) keys, eased between them."""
    if t <= keys[0][0]:
        return keys[0][1]
    for (t0, v0), (t1, v1) in zip(keys, keys[1:]):
        if t <= t1:
            return v0 + (v1 - v0) * smooth((t - t0) / (t1 - t0))
    return keys[-1][1]


# --- foot states: (ankle forward, ankle up, foot pitch) -------------------

def flat(forward):
    return (forward, floor + ankle_height, foot_rest)


def peeled(forward, peel):
    """Planted foot rolled up onto the ball (heel up); the ball stays put."""
    ball = (forward + foot_len * math.cos(foot_rest),
            floor + ankle_height + foot_len * math.sin(foot_rest))
    pitch = foot_rest - 0.9 * peel
    return (ball[0] - foot_len * math.cos(pitch),
            ball[1] - foot_len * math.sin(pitch), pitch)


def swing(u, start, end_forward, lift):
    """From a lifted-off foot state to a flat landing, arcing up."""
    end = flat(end_forward)
    w = smooth(u)
    forward = start[0] + (end[0] - start[0]) * w
    # Quick lift, then reach: the arc peaks early.
    up = start[1] + (end[1] - start[1]) * smooth(u * 1.15) + \
        lift * math.sin(math.pi * u ** 0.8)
    # Toes stay pointed down through the swing and flatten to land.
    pitch = start[2] + (end[2] - start[2]) * smooth((u - 0.2) / 0.8)
    pitch -= 0.35 * math.sin(math.pi * min(1.0, u * 1.25))
    return (forward, up, pitch)


# --- IK -------------------------------------------------------------------

def solve(which, hip, ankle):
    """
    Pose turns placing the ankle (forward, up, pitch) for a hip joint at
    (forward, up). The knee bends forward; out of reach the leg straightens.
    A turn about +x raises a forward-pointing bone, so the turns are minus
    the change of direction (positive swings back, as in the poses).
    """
    dx, dz = ankle[0] - hip[0], ankle[1] - hip[1]
    reach = min(math.hypot(dx, dz), thigh + shin - 1e-5)
    reach = max(reach, abs(thigh - shin) + 1e-5)
    toward = math.atan2(dz, dx)
    at_hip = math.acos(max(-1.0, min(1.0,
        (thigh * thigh + reach * reach - shin * shin) / (2 * thigh * reach))))
    at_knee = math.acos(max(-1.0, min(1.0,
        (thigh * thigh + shin * shin - reach * reach) / (2 * thigh * shin))))
    thigh_dir = toward + at_hip
    shin_dir = thigh_dir - (math.pi - at_knee)
    return {
        f"UpperLeg.{which}": {"x": -(thigh_dir - thigh_rest)},
        f"LowerLeg.{which}": {"x": -((shin_dir - thigh_dir) -
                                     (shin_rest - thigh_rest))},
        f"foot.{which}": {"x": -((ankle[2] - shin_dir) -
                                 (foot_rest - shin_rest))},
    }


def legs(hip, left, right):
    return {**solve("L", hip, left), **solve("R", hip, right)}


class Step:
    """One frame of a plan: leg turns, body travel and height (units)."""

    def __init__(self, pose, travel, rise):
        self.pose = pose
        self.travel = travel
        self.rise = rise


# --- standing -------------------------------------------------------------

stand_rise = -0.006


def stand(rise=stand_rise, peel=0.0, spread=0.0):
    """Feet side by side under the hips; `spread` steps them apart."""
    hip = (hip_rest[0], hip_rest[1] + rise)
    front = hip_rest[0] + stand_offset + spread / 2
    back = hip_rest[0] + stand_offset - spread / 2
    return Step(legs(hip, peeled(front, peel), peeled(back, peel)), 0.0, rise)


# --- the run --------------------------------------------------------------

run_period = 10 / 30  # two steps, a whole number of 30 fps frames
run_duty = 0.4     # share of a cycle a foot is down; the rest is flight
run_speed = 1.35   # units per second
run_rise = -0.026
run_bob = 0.011
run_lift = 0.06
run_push = 0.75    # how far the foot peels before lifting

stance = run_period * run_duty
# Touchdown ahead of the hip, liftoff as far behind it.
reach = run_speed * stance / 2


def run_rise_at(t):
    """Lowest mid-stance, highest in the flight between steps."""
    return run_rise - run_bob * math.cos(
        2 * tau * (t - stance / 2) / run_period)


def run_foot(t, offset):
    """Ankle of a foot that plants at offset + k * period."""
    k = math.floor((t - offset) / run_period)
    planted_at = k * run_period + offset
    u = t - planted_at
    land = hip_rest[0] + run_speed * planted_at + stand_offset + reach
    push = run_push * smooth((u - stance * 0.5) / (stance * 0.5))
    if u < stance:
        return peeled(land, push)
    lifted = peeled(land, run_push)
    return swing((u - stance) / (run_period - stance), lifted,
                 land + run_speed * run_period, run_lift)


def run_plan(t):
    hip = (hip_rest[0] + run_speed * t, hip_rest[1] + run_rise_at(t))
    left = run_foot(t, 0.0)
    right = run_foot(t, run_period / 2)
    # Relative to the hips, so the loop repeats.
    shift = run_speed * t
    pose = legs((hip[0] - shift, hip[1]),
                (left[0] - shift, left[1], left[2]),
                (right[0] - shift, right[1], right[2]))
    return Step(pose, run_speed * t, run_rise_at(t))


# --- the halt -------------------------------------------------------------

# Starts where a run cycle starts: the left foot just planted, the right one
# mid-swing. The body brakes over `brake`; the right foot plants ahead as
# the braking step, the left one pulls in beside it, the knees give, she
# bounces up onto her toes and settles.
brake = 0.36
halt_right_lands = run_period / 2
halt_left_lifts = 0.19
halt_left_lands = 0.38
halt_length = 1.9


def halt_travel(t):
    u = min(t, brake)
    return run_speed * (u - u * u / (2 * brake))


halt_stop = halt_travel(brake)
final = hip_rest[0] + halt_stop + stand_offset


def halt_rise(t):
    return keyed(t, [
        (0.0, run_rise_at(0.0)),
        (0.2, -0.03),
        (0.44, -0.046),
        (0.62, 0.004),
        (0.8, -0.013),
        (1.0, stand_rise),
    ])


def halt_peel(t):
    return 0.55 * bump(t, 0.46, 0.84)


def halt_plan(t):
    hip = (hip_rest[0] + halt_travel(t), hip_rest[1] + halt_rise(t))
    tiptoe = halt_peel(t)

    # Left: planted from the run, pushes off, pulls in beside the right.
    left_at = hip_rest[0] + stand_offset + reach
    if t < halt_left_lifts:
        push = 0.5 * smooth((t - 0.1) / (halt_left_lifts - 0.1))
        left = peeled(left_at, push)
    elif t < halt_left_lands:
        u = (t - halt_left_lifts) / (halt_left_lands - halt_left_lifts)
        left = swing(u, peeled(left_at, 0.5), final, 0.035)
    else:
        left = peeled(final, tiptoe)

    # Right: finishes its run swing early and lands as the braking step.
    if t < halt_right_lands:
        lifted_at = -run_period / 2 + stance
        start_land = hip_rest[0] + run_speed * (-run_period / 2) + \
            stand_offset + reach
        u = (t - lifted_at) / (halt_right_lands - lifted_at)
        right = swing(u, peeled(start_land, run_push), final, run_lift)
    else:
        right = peeled(final, tiptoe)

    shift = halt_travel(t)
    pose = legs((hip[0] - shift, hip[1]),
                (left[0] - shift, left[1], left[2]),
                (right[0] - shift, right[1], right[2]))
    return Step(pose, shift, halt_rise(t))


# --- crouch for the hunt --------------------------------------------------

hunt_rise = -0.032


def hunt_plan(t, period):
    # Weight rocks from foot to foot; the feet stay put.
    rock = math.sin(tau * t / period)
    return stand(hunt_rise + 0.003 * rock, spread=0.05)
