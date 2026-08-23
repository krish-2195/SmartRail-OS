"""
MetroPulse / SmartRail-OS — Shared Metro Simulation Engine
=========================================================
Single source of truth for:
  - Network stations and geometry (Blue Line & Red Line)
  - Timetable scheduling (Presentation Mode vs Real-World Official)
  - Platform architecture (Platform 1 & 2 for standard stations; Platforms 1..4 for Old High Court)
  - Deterministic passenger flow simulation (strict in-transit conservation, zero fluctuation)
"""

import os
from datetime import datetime, date, timedelta
import math
import hashlib
from typing import Optional

# ══════════════════════════════════════════════
#  SIMULATION CONFIGURATION PRESET
#  "PRESENTATION" (Fast-paced live demo) vs "REAL_WORLD" (Official GMRC)
# ══════════════════════════════════════════════

SIMULATION_MODE = os.getenv("SIMULATION_MODE", "PRESENTATION").upper()
if SIMULATION_MODE not in ("PRESENTATION", "REAL_WORLD"):
    SIMULATION_MODE = "PRESENTATION"

# ══════════════════════════════════════════════
#  STATION DEFINITIONS
# ══════════════════════════════════════════════

BLUE_LINE_STATIONS = [
    # (id, name, cumulative_km, busy)
    ("BL01", "Vastral Gam",           0.00, False),
    ("BL02", "Nirant Cross Road",     1.20, False),
    ("BL03", "Vastral",               2.30, False),
    ("BL04", "Rabari Colony",         3.50, False),
    ("BL05", "Amraivadi",             4.70, False),
    ("BL06", "Apparel Park",          6.00, False),
    ("BL07", "Kankaria East",         7.30, False),
    ("BL08", "Kalupur Metro Station", 8.60, True ),
    ("BL09", "Ghee Kanta",            9.70, False),
    ("BL10", "Shahpur",              10.80, False),
    ("BL11", "Old High Court",       11.90, True ),
    ("BL12", "S P Stadium",          13.10, True ),
    ("BL13", "Commerce Six Road",    14.30, False),
    ("BL14", "Gujarat University",   15.60, True ),
    ("BL15", "Gurukul Road",         16.80, False),
    ("BL16", "Doordarshan Kendra",   18.00, False),
    ("BL17", "Thaltej",              19.20, False),
    ("BL18", "Thaltej Gam",          20.40, False),
]

RED_LINE_STATIONS = [
    ("RL01", "APMC",                  0.00, False),
    ("RL02", "Jivraj Park",           1.40, False),
    ("RL03", "Rajivnagar",            2.60, False),
    ("RL04", "Shreyas",               3.80, False),
    ("RL05", "Paldi",                 5.00, False),
    ("RL06", "Gandhigram",            6.30, True ),
    ("RL07", "Old High Court",        7.50, True ),
    ("RL08", "Usmanpura",             8.60, False),
    ("RL09", "Vijay Nagar",           9.70, False),
    ("RL10", "Vadaj",                10.80, False),
    ("RL11", "Ranip",                11.90, False),
    ("RL12", "Sabarmati Rly Station",13.10, True ),
    ("RL13", "AEC",                  14.20, False),
    ("RL14", "Sabarmati",            15.30, False),
    ("RL15", "Motera Stadium",       16.50, True ),
]

# ══════════════════════════════════════════════
#  RUNTIMES & DWELL CONFIGURATION
# ══════════════════════════════════════════════

if SIMULATION_MODE == "PRESENTATION":
    # Compressed presentation schedule (15 min Blue Line, 12 min Red Line)
    BLUE_UP_RUNTIME   = 15 * 60
    BLUE_DOWN_RUNTIME = 15 * 60
    RED_UP_RUNTIME    = 12 * 60
    RED_DOWN_RUNTIME  = 12 * 60

    # Snappy presentation dwells (seconds)
    DWELL_NORMAL   = 20
    DWELL_BUSY     = 30
    DWELL_TERMINAL = 60
else:
    # Official real-world timetable (seconds)
    BLUE_UP_RUNTIME   = 45 * 60 + 19
    BLUE_DOWN_RUNTIME = 43 * 60 + 28
    RED_UP_RUNTIME    = 32 * 60 +  9
    RED_DOWN_RUNTIME  = 31 * 60 + 50

    # Official dwells (seconds)
    DWELL_NORMAL   = 30
    DWELL_BUSY     = 45
    DWELL_TERMINAL = 180

# ══════════════════════════════════════════════
#  PLATFORM ARCHITECTURE & HELPER
# ══════════════════════════════════════════════

def get_platform_info(line_code: str, direction: str, station_id: str, station_name: str = "") -> dict:
    """
    Returns platform number (1, 2, 3, 4) and platform name based on station layout.
    - Standard single-line stations:
        * Platform 1: UP direction (Towards Thaltej Gam / Motera Stadium)
        * Platform 2: DOWN direction (Towards Vastral Gam / APMC)
    - Old High Court Interchange (BL11 / RL07):
        * Platform 1: Blue Line UP (Level 2 -> towards Thaltej Gam)
        * Platform 2: Blue Line DOWN (Level 2 -> towards Vastral Gam)
        * Platform 3: Red Line UP (Level 1 -> towards Motera Stadium)
        * Platform 4: Red Line DOWN (Level 1 -> towards APMC)
    """
    s_name = (station_name or "").lower()
    is_ohc = station_id in ("BL11", "RL07") or "old high court" in s_name

    if is_ohc:
        if line_code == "BL":
            p_num = 1 if direction == "UP" else 2
            dest = "Thaltej Gam" if direction == "UP" else "Vastral Gam"
            return {
                "platform_number": p_num,
                "platform_name": f"Platform {p_num} (Blue Line · Level 2 · towards {dest})",
                "platform_level": "Level 2 (Elevated East-West)",
                "is_interchange": True,
            }
        else:
            p_num = 3 if direction == "UP" else 4
            dest = "Motera Stadium" if direction == "UP" else "APMC"
            return {
                "platform_number": p_num,
                "platform_name": f"Platform {p_num} (Red Line · Level 1 · towards {dest})",
                "platform_level": "Level 1 (Elevated North-South)",
                "is_interchange": True,
            }

    # Standard single-line station
    if direction == "UP":
        dest = "Thaltej Gam" if line_code == "BL" else "Motera Stadium"
        return {
            "platform_number": 1,
            "platform_name": f"Platform 1 (towards {dest})",
            "platform_level": "Elevated",
            "is_interchange": False,
        }
    else:
        dest = "Vastral Gam" if line_code == "BL" else "APMC"
        return {
            "platform_number": 2,
            "platform_name": f"Platform 2 (towards {dest})",
            "platform_level": "Elevated",
            "is_interchange": False,
        }

# ══════════════════════════════════════════════
#  COACH / BERTH DEFINITIONS
#  3 coaches per Ahmedabad Metro train
# ══════════════════════════════════════════════

COACHES = [
    {"id": "C1", "name": "Coach 1 — General", "type": "GENERAL", "capacity": 400},
    {"id": "C2", "name": "Coach 2 — Ladies",  "type": "LADIES",  "capacity": 400},
    {"id": "C3", "name": "Coach 3 — General", "type": "GENERAL", "capacity": 400},
]
TRAIN_CAPACITY = sum(c["capacity"] for c in COACHES)   # 1200

# Ladies coach historically runs at ~70% of general coach occupancy
LADIES_COACH_FACTOR = 0.70

# ══════════════════════════════════════════════
#  DETERMINISTIC SEED HELPER
# ══════════════════════════════════════════════

def _seed_float(train_id: str, dt: datetime, salt: str = "") -> float:
    """Returns a stable pseudo-random float [0,1) for a given train+departure."""
    key = f"{train_id}:{dt.year}{dt.month}{dt.day}{dt.hour}{dt.minute}:{salt}"
    h   = int(hashlib.md5(key.encode()).hexdigest()[:8], 16)
    return (h % 10000) / 10000.0

# ══════════════════════════════════════════════
#  TIMETABLE FREQUENCY
# ══════════════════════════════════════════════

def get_headway_minutes(line: str, now: datetime) -> float:
    """Returns headway in minutes for a line at the given time."""
    if SIMULATION_MODE == "PRESENTATION":
        return 3.0 if line == "BL" else 2.5

    is_weekend = now.weekday() >= 5
    hour       = now.hour + now.minute / 60.0
    is_peak    = (8.0 <= hour < 11.0) or (17.0 <= hour < 20.0)
    if line == "BL":
        if is_weekend: return 12.0
        if is_peak:    return 9.0
        return 10.0
    else:
        if is_weekend: return 12.0
        if is_peak:    return 10.0
        return 12.0

# ══════════════════════════════════════════════
#  TRIP SCHEDULE BUILDER
# ══════════════════════════════════════════════

def build_trip_schedule(stations_raw: list, runtime_sec: int, direction: str):
    ordered = [
        {"id": s[0], "name": s[1], "km": s[2], "busy": s[3]}
        for s in (stations_raw if direction == "UP" else reversed(stations_raw))
    ]
    n = len(ordered)
    total_dwell = sum(
        DWELL_TERMINAL if (i == 0 or i == n-1) else (DWELL_BUSY if st["busy"] else DWELL_NORMAL)
        for i, st in enumerate(ordered)
    )
    total_travel = max(runtime_sec - total_dwell, 1)
    total_dist   = abs(ordered[-1]["km"] - ordered[0]["km"])

    schedule, elapsed = [], 0
    for i, st in enumerate(ordered):
        is_terminal   = (i == 0 or i == n - 1)
        arrive_offset = elapsed
        dwell         = DWELL_TERMINAL if is_terminal else (DWELL_BUSY if st["busy"] else DWELL_NORMAL)
        depart_offset = elapsed + dwell
        elapsed       = depart_offset
        schedule.append({"station": st, "arrive_offset": arrive_offset, "depart_offset": depart_offset})
        if i < n - 1:
            seg_dist   = abs(ordered[i+1]["km"] - st["km"])
            seg_travel = int((seg_dist / total_dist) * total_travel)
            elapsed   += seg_travel

    return schedule, elapsed


BL_UP_SCHED,   BL_UP_DUR   = build_trip_schedule(BLUE_LINE_STATIONS, BLUE_UP_RUNTIME,   "UP")
BL_DOWN_SCHED, BL_DOWN_DUR = build_trip_schedule(BLUE_LINE_STATIONS, BLUE_DOWN_RUNTIME, "DOWN")
RL_UP_SCHED,   RL_UP_DUR   = build_trip_schedule(RED_LINE_STATIONS,  RED_UP_RUNTIME,    "UP")
RL_DOWN_SCHED, RL_DOWN_DUR = build_trip_schedule(RED_LINE_STATIONS,  RED_DOWN_RUNTIME,  "DOWN")

# ══════════════════════════════════════════════
#  TIMETABLE FREQUENCY HELPER
# ══════════════════════════════════════════════

def time_to_seconds(h, m, s=0): return h * 3600 + m * 60 + s
def seconds_to_time(t_sec):
    h = (t_sec // 3600) % 24
    m = (t_sec % 3600) // 60
    s = t_sec % 60
    return f"{h:02d}:{m:02d}" if s == 0 else f"{h:02d}:{m:02d}:{s:02d}"

# ══════════════════════════════════════════════
#  TRAIN ROSTER BUILDER — CONTINUOUS CIRCULATION
# ══════════════════════════════════════════════

def build_train_roster(now: datetime) -> list:
    """
    Builds the fleet of 24 physical circulating train rakes:
    - 12 Blue Line rakes: BL-01 to BL-12
    - 12 Red Line rakes:  RL-01 to RL-12
    """
    trains = []

    # Blue Line: 12 rakes
    bl_t_up = BL_UP_DUR
    bl_t_down = BL_DOWN_DUR
    bl_t_turn = 192
    bl_cycle = bl_t_up + bl_t_turn + bl_t_down + bl_t_turn  # exactly 2160s = 36.0 min (12 * 180s)
    bl_headway = 180
    bl_start = time_to_seconds(6, 0)
    bl_end = time_to_seconds(23, 0)

    for i in range(12):
        launch = bl_start + i * bl_headway
        trip_instances = []
        cur_dep = launch
        while cur_dep <= bl_end:
            trip_instances.append({
                "direction": "UP",
                "dep_sec": cur_dep,
                "schedule": BL_UP_SCHED,
                "duration": bl_t_up,
                "origin": "Vastral Gam",
                "destination": "Thaltej Gam",
                "origin_id": "BL01",
                "destination_id": "BL18",
            })
            down_dep = cur_dep + bl_t_up + bl_t_turn
            if down_dep <= bl_end + bl_cycle:
                trip_instances.append({
                    "direction": "DOWN",
                    "dep_sec": down_dep,
                    "schedule": BL_DOWN_SCHED,
                    "duration": bl_t_down,
                    "origin": "Thaltej Gam",
                    "destination": "Vastral Gam",
                    "origin_id": "BL18",
                    "destination_id": "BL01",
                })
            cur_dep += bl_cycle

        trains.append({
            "train_id": f"BL-{i+1:02d}",
            "rake_number": i + 1,
            "line_name": "Blue Line",
            "line_code": "BL",
            "terminal_A": "Vastral Gam",
            "terminal_B": "Thaltej Gam",
            "terminal_A_id": "BL01",
            "terminal_B_id": "BL18",
            "terminal_start": "Vastral Gam",
            "terminal_end": "Thaltej Gam",
            "direction": "UP",
            "schedule": BL_UP_SCHED,
            "sched_up": BL_UP_SCHED,
            "sched_down": BL_DOWN_SCHED,
            "trip_duration": bl_t_up,
            "t_up": bl_t_up,
            "t_down": bl_t_down,
            "t_turn": bl_t_turn,
            "cycle_duration": bl_cycle,
            "headway": bl_headway,
            "launch_sec": launch,
            "slot_index": i,
            "n_trains": 12,
            "service_start_sec": bl_start,
            "service_end_sec": bl_end,
            "all_departures": [tr["dep_sec"] for tr in trip_instances],
            "trip_instances": trip_instances,
        })

    # Red Line: 12 rakes
    rl_t_up = RL_UP_DUR
    rl_t_down = RL_DOWN_DUR
    rl_t_turn = 188
    rl_cycle = rl_t_up + rl_t_turn + rl_t_down + rl_t_turn  # exactly 1800s = 30.0 min (12 * 150s)
    rl_headway = 150
    rl_start = time_to_seconds(6, 0)
    rl_end = time_to_seconds(23, 0)

    for i in range(12):
        launch = rl_start + i * rl_headway
        trip_instances = []
        cur_dep = launch
        while cur_dep <= rl_end:
            trip_instances.append({
                "direction": "UP",
                "dep_sec": cur_dep,
                "schedule": RL_UP_SCHED,
                "duration": rl_t_up,
                "origin": "APMC",
                "destination": "Motera Stadium",
                "origin_id": "RL01",
                "destination_id": "RL15",
            })
            down_dep = cur_dep + rl_t_up + rl_t_turn
            if down_dep <= rl_end + rl_cycle:
                trip_instances.append({
                    "direction": "DOWN",
                    "dep_sec": down_dep,
                    "schedule": RL_DOWN_SCHED,
                    "duration": rl_t_down,
                    "origin": "Motera Stadium",
                    "destination": "APMC",
                    "origin_id": "RL15",
                    "destination_id": "RL01",
                })
            cur_dep += rl_cycle

        trains.append({
            "train_id": f"RL-{i+1:02d}",
            "rake_number": i + 1,
            "line_name": "Red Line",
            "line_code": "RL",
            "terminal_A": "APMC",
            "terminal_B": "Motera Stadium",
            "terminal_A_id": "RL01",
            "terminal_B_id": "RL15",
            "terminal_start": "APMC",
            "terminal_end": "Motera Stadium",
            "direction": "UP",
            "schedule": RL_UP_SCHED,
            "sched_up": RL_UP_SCHED,
            "sched_down": RL_DOWN_SCHED,
            "trip_duration": rl_t_up,
            "t_up": rl_t_up,
            "t_down": rl_t_down,
            "t_turn": rl_t_turn,
            "cycle_duration": rl_cycle,
            "headway": rl_headway,
            "launch_sec": launch,
            "slot_index": i,
            "n_trains": 12,
            "service_start_sec": rl_start,
            "service_end_sec": rl_end,
            "all_departures": [tr["dep_sec"] for tr in trip_instances],
            "trip_instances": trip_instances,
        })

    return trains

# ══════════════════════════════════════════════
#  OCCUPANCY MODEL
# ══════════════════════════════════════════════

def occupancy_base_factor(dt: datetime, train_id: str) -> float:
    h          = dt.hour + dt.minute / 60.0 + dt.second / 3600.0
    is_weekend = dt.weekday() >= 5
    noise      = (_seed_float(train_id, dt, "base") - 0.5) * 0.06

    # 1. Overnight shutdown: 23:00 to 06:00 (Station doors closed, 0 passengers)
    if h >= 23.0 or h < 6.0:
        return 0.0

    # 2. Evening Wind-down: 21:30 (9:30 PM) to 23:00 (11:00 PM) -> Smooth cosine decay to 0.0
    if h >= 21.5:
        # Wind down factor smoothly goes from 1.0 (at 21.5) to 0.0 (at 23.0)
        decay = (1.0 + math.cos(math.pi * (h - 21.5) / 1.5)) / 2.0
        base_demand = (0.22 if is_weekend else 0.20) + noise * 0.5
        return max(0.0, min(0.60, base_demand * decay))

    # 3. Regular Daytime & Peak Schedules
    if is_weekend:
        return max(0.15, min(0.95, (0.45 if 10 <= h <= 19 else 0.25) + noise))
    if 8.0 <= h < 11.0:
        return max(0.20, min(0.98, 0.60 + 0.35 * (1.0 - abs(h - 9.0) / 1.5) + noise))
    if 17.0 <= h < 20.0:
        return max(0.20, min(0.98, 0.55 + 0.40 * (1.0 - abs(h - 18.5) / 1.5) + noise))
    if 11.0 <= h < 17.0:
        return max(0.20, min(0.85, 0.35 + noise))
    return max(0.10, min(0.60, 0.20 + noise * 0.5))

def _crowd_label(pct: float) -> str:
    if pct >= 85: return "VERY_CROWDED"
    if pct >= 60: return "CROWDED"
    if pct >= 35: return "MODERATE"
    return "EMPTY"

def _empty_coaches():
    return [
        {
            "coach_id": coach["id"],
            "coach_name": coach["name"],
            "coach_type": coach["type"],
            "capacity": coach["capacity"],
            "current_passengers": 0,
            "occupancy_pct": 0.0,
            "crowd_level": "EMPTY",
        }
        for coach in COACHES
    ]

# ══════════════════════════════════════════════
#  DETERMINISTIC PASSENGER TRIP PROFILE
# ══════════════════════════════════════════════

_TRIP_PROFILE_CACHE: dict = {}

def get_trip_passenger_profile(train_id: str, schedule: list, direction: str, dep_dt: datetime) -> list:
    cache_key = f"{train_id}:{dep_dt.strftime('%Y%m%d%H%M%S')}:{direction}"
    if cache_key in _TRIP_PROFILE_CACHE:
        return _TRIP_PROFILE_CACHE[cache_key]

    base = occupancy_base_factor(dep_dt, train_id)
    n = len(schedule)
    profile = []
    p_prev = 0

    for i, seg in enumerate(schedule):
        st = seg["station"]
        is_busy = st.get("busy", False)

        if i == 0:
            p_arr = 0
            a = 0
            if base <= 0.001:
                target = 0
            else:
                min_floor = int(60 * min(1.0, base / 0.15))
                target = max(min_floor, int(base * math.sin(1.0 / max(n - 1, 1) * math.pi) * 0.85 * TRAIN_CAPACITY))
            b = target
            p_dep = target
        elif i == n - 1:
            p_arr = p_prev
            a = p_arr
            b = 0
            p_dep = 0
        else:
            p_arr = p_prev
            if base <= 0.001:
                target = 0
                a = max(1, int(p_arr * 0.5)) if p_arr > 0 else 0
                p_post_alight = max(0, p_arr - a)
                b = 0
                p_dep = p_post_alight
            else:
                pos = i / max(n - 1, 1)
                pos_factor = math.sin(pos * math.pi)
                station_boost = 1.25 if is_busy else 1.0
                target = int(base * pos_factor * station_boost * TRAIN_CAPACITY)
                a = max(min(p_arr, int(10 * min(1.0, base / 0.15))), int(p_arr * 0.12)) if p_arr > 50 else (p_arr if i == n - 1 else 0)
                p_post_alight = max(0, p_arr - a)
                b_desired = max(int(10 * min(1.0, base / 0.15)), target - p_post_alight)
                b = max(0, min(b_desired, TRAIN_CAPACITY - p_post_alight))
                p_dep = p_post_alight + b

        profile.append({
            "station_idx": i,
            "station_id": st["id"],
            "station_name": st["name"],
            "arr_passengers": p_arr,
            "alighting": a,
            "post_alight": p_arr - a if i != 0 else 0,
            "boarding": b,
            "dep_passengers": p_dep,
        })
        p_prev = p_dep

    if len(_TRIP_PROFILE_CACHE) > 500: _TRIP_PROFILE_CACHE.clear()
    _TRIP_PROFILE_CACHE[cache_key] = profile
    return profile

def compute_coach_passengers(train_id, schedule, station_idx, direction, dep_dt, dwell_sec, elapsed_in_dwell, is_in_transit) -> dict:
    profile = get_trip_passenger_profile(train_id, schedule, direction, dep_dt)
    st_prof = profile[station_idx]

    if is_in_transit:
        total_pax = st_prof["dep_passengers"]
        phase     = "IN_TRANSIT"
        progress  = 1.0
    else:
        half = max(1.0, dwell_sec / 2.0)
        if elapsed_in_dwell <= half:
            progress = elapsed_in_dwell / half
            total_pax = max(0, int(round(st_prof["arr_passengers"] - st_prof["alighting"] * progress)))
            phase = "ALIGHTING"
        else:
            progress = (elapsed_in_dwell - half) / max(1.0, dwell_sec - half)
            total_pax = max(0, min(TRAIN_CAPACITY, int(round(st_prof["post_alight"] + st_prof["boarding"] * progress))))
            phase = "BOARDING"

    ladies_share  = LADIES_COACH_FACTOR / (2 + LADIES_COACH_FACTOR)
    general_share = 1.0 / (2 + LADIES_COACH_FACTOR)
    raw_c2 = int(total_pax * ladies_share)
    raw_c1 = int(total_pax * general_share)
    raw_c3 = total_pax - raw_c1 - raw_c2
    
    coach_pax = [max(0, min(COACHES[0]["capacity"], raw_c1)), max(0, min(COACHES[1]["capacity"], raw_c2)), max(0, min(COACHES[2]["capacity"], raw_c3))]
    coaches_out = []
    for i, coach in enumerate(COACHES):
        pax = coach_pax[i]
        pct = round((pax / coach["capacity"]) * 100, 1)
        coaches_out.append({"coach_id": coach["id"], "coach_name": coach["name"], "coach_type": coach["type"], "capacity": coach["capacity"], "current_passengers": pax, "occupancy_pct": pct, "crowd_level": _crowd_label(pct)})

    total_pct = round((total_pax / TRAIN_CAPACITY) * 100, 1)
    return {"train_capacity": TRAIN_CAPACITY, "train_current_passengers": total_pax, "train_occupancy_pct": total_pct, "train_crowd_level": _crowd_label(total_pct), "passenger_event": phase, "event_progress_pct": round(progress * 100, 1), "coaches": coaches_out}

# ══════════════════════════════════════════════
#  CORE STATE CALCULATOR — 4-PHASE CIRCULAR LOOP
# ══════════════════════════════════════════════

def get_train_state(train: dict, now: datetime) -> dict:
    now_sec = now.hour * 3600 + now.minute * 60 + now.second
    launch = train["launch_sec"]
    cycle_dur = train["cycle_duration"]
    t_up = train["t_up"]
    t_down = train["t_down"]
    t_turn = train["t_turn"]

    if now_sec < launch - 60: return _not_running(train, now)

    if launch - 60 <= now_sec < launch:
        dep_dt = datetime(now.year, now.month, now.day) + timedelta(seconds=launch)
        wait_sec = launch - now_sec
        schedule = train["sched_up"]
        p_data = get_platform_info(train["line_code"], "UP", train["terminal_A_id"], train["terminal_A"])
        occ = compute_coach_passengers(train["train_id"], schedule, 0, "UP", dep_dt, 60, 60 - wait_sec, False)
        return {**occ, "train_id": train["train_id"], "display_name": f"{train['line_name']} · {train['terminal_B']}", "line": train["line_name"], "line_code": train["line_code"], "direction": "UP", "terminal_start": train["terminal_A"], "terminal_end": train["terminal_B"], "platform_number": p_data["platform_number"], "platform_name": p_data["platform_name"], "platform_level": p_data["platform_level"], "is_interchange": p_data["is_interchange"], "status": "WAITING_AT_TERMINAL", "current_station": train["terminal_A"], "current_station_id": train["terminal_A_id"], "previous_station": None, "next_station": schedule[1]["station"]["name"], "next_station_id": schedule[1]["station"]["id"], "journey_completed_pct": 0.0, "current_position": 1.0, "departed_terminal_at": None, "arrived_at_station": None, "departs_station_at": seconds_to_time(launch), "eta_to_next_station_sec": wait_sec, "eta_to_next_station_min": round(wait_sec / 60.0, 1), "timestamp": now.strftime("%Y-%m-%d %H:%M:%S")}

    elapsed_day = now_sec - launch
    cycle_idx = elapsed_day // cycle_dur
    tau = elapsed_day % cycle_dur
    cycle_start_sec = launch + cycle_idx * cycle_dur

    if cycle_start_sec > train["service_end_sec"] + cycle_dur: return _not_running(train, now)

    if tau < t_up:
        return _evaluate_schedule_segment(train, train["sched_up"], "UP", train["terminal_A"], train["terminal_B"], cycle_start_sec, datetime(now.year, now.month, now.day) + timedelta(seconds=cycle_start_sec), tau, t_up, now)

    elif tau < t_up + t_turn:
        e_turn = tau - t_up
        term_b_name, term_b_id = train["terminal_B"], train["terminal_B_id"]
        up_dep_sec = cycle_start_sec
        down_dep_sec = cycle_start_sec + t_up + t_turn
        if e_turn < 60:
            p_data = get_platform_info(train["line_code"], "UP", term_b_id, term_b_name)
            occ = compute_coach_passengers(train["train_id"], train["sched_up"], len(train["sched_up"]) - 1, "UP", datetime(now.year, now.month, now.day) + timedelta(seconds=up_dep_sec), 60, e_turn, False)
            return {**occ, "train_id": train["train_id"], "display_name": f"{train['line_name']} · {term_b_name}", "line": train["line_name"], "line_code": train["line_code"], "direction": "UP", "terminal_start": train["terminal_A"], "terminal_end": term_b_name, "platform_number": p_data["platform_number"], "platform_name": p_data["platform_name"], "platform_level": p_data["platform_level"], "is_interchange": p_data["is_interchange"], "status": "AT_STATION", "current_station": term_b_name, "current_station_id": term_b_id, "previous_station": train["sched_up"][-2]["station"]["name"], "next_station": None, "next_station_id": None, "journey_completed_pct": 100.0, "current_position": 100.0, "departed_terminal_at": seconds_to_time(up_dep_sec), "arrived_at_station": seconds_to_time(up_dep_sec + t_up), "departs_station_at": seconds_to_time(down_dep_sec), "eta_to_next_station_sec": t_turn - e_turn, "eta_to_next_station_min": round((t_turn - e_turn) / 60.0, 1), "timestamp": now.strftime("%Y-%m-%d %H:%M:%S")}
        elif e_turn < t_turn - 60:
            return {"train_id": train["train_id"], "display_name": f"{train['line_name']} · {train['terminal_A']}", "line": train["line_name"], "line_code": train["line_code"], "direction": "DOWN", "terminal_start": term_b_name, "terminal_end": train["terminal_A"], "platform_number": None, "platform_name": "Crossover / Reversing Siding", "platform_level": "Track Level", "is_interchange": False, "status": "REVERSING", "current_station": term_b_name, "current_station_id": term_b_id, "previous_station": None, "next_station": train["sched_down"][1]["station"]["name"], "next_station_id": train["sched_down"][1]["station"]["id"], "journey_completed_pct": 0.0, "current_position": 1.0, "departed_terminal_at": None, "arrived_at_station": None, "departs_station_at": seconds_to_time(down_dep_sec), "eta_to_next_station_sec": t_turn - e_turn, "eta_to_next_station_min": round((t_turn - e_turn) / 60.0, 1), "train_capacity": TRAIN_CAPACITY, "train_current_passengers": 0, "train_occupancy_pct": 0.0, "train_crowd_level": "EMPTY", "passenger_event": "REVERSING", "event_progress_pct": round(((e_turn - 60) / max(1, t_turn - 120)) * 100, 1), "coaches": _empty_coaches(), "timestamp": now.strftime("%Y-%m-%d %H:%M:%S")}
        else:
            p_data = get_platform_info(train["line_code"], "DOWN", term_b_id, term_b_name)
            return {"train_id": train["train_id"], "display_name": f"{train['line_name']} · {train['terminal_A']}", "line": train["line_name"], "line_code": train["line_code"], "direction": "DOWN", "terminal_start": term_b_name, "terminal_end": train["terminal_A"], "platform_number": p_data["platform_number"], "platform_name": p_data["platform_name"], "platform_level": p_data["platform_level"], "is_interchange": p_data["is_interchange"], "status": "WAITING_AT_TERMINAL", "current_station": term_b_name, "current_station_id": term_b_id, "previous_station": None, "next_station": train["sched_down"][1]["station"]["name"], "next_station_id": train["sched_down"][1]["station"]["id"], "journey_completed_pct": 0.0, "current_position": 1.0, "departed_terminal_at": None, "arrived_at_station": None, "departs_station_at": seconds_to_time(down_dep_sec), "eta_to_next_station_sec": t_turn - e_turn, "eta_to_next_station_min": round((t_turn - e_turn) / 60.0, 1), "train_capacity": TRAIN_CAPACITY, "train_current_passengers": 0, "train_occupancy_pct": 0.0, "train_crowd_level": "EMPTY", "passenger_event": "WAITING", "event_progress_pct": round(((e_turn - (t_turn - 60)) / 60.0) * 100, 1), "coaches": _empty_coaches(), "timestamp": now.strftime("%Y-%m-%d %H:%M:%S")}

    elif tau < t_up + t_turn + t_down:
        return _evaluate_schedule_segment(train, train["sched_down"], "DOWN", train["terminal_B"], train["terminal_A"], cycle_start_sec + t_up + t_turn, datetime(now.year, now.month, now.day) + timedelta(seconds=cycle_start_sec + t_up + t_turn), tau - (t_up + t_turn), t_down, now)

    else:
        e_turn = tau - (t_up + t_turn + t_down)
        term_a_name, term_a_id = train["terminal_A"], train["terminal_A_id"]
        down_dep_sec = cycle_start_sec + t_up + t_turn
        next_up_dep_sec = cycle_start_sec + cycle_dur
        if e_turn < 60:
            p_data = get_platform_info(train["line_code"], "DOWN", term_a_id, term_a_name)
            occ = compute_coach_passengers(train["train_id"], train["sched_down"], len(train["sched_down"]) - 1, "DOWN", datetime(now.year, now.month, now.day) + timedelta(seconds=down_dep_sec), 60, e_turn, False)
            return {**occ, "train_id": train["train_id"], "display_name": f"{train['line_name']} · {term_a_name}", "line": train["line_name"], "line_code": train["line_code"], "direction": "DOWN", "terminal_start": train["terminal_B"], "terminal_end": term_a_name, "platform_number": p_data["platform_number"], "platform_name": p_data["platform_name"], "platform_level": p_data["platform_level"], "is_interchange": p_data["is_interchange"], "status": "AT_STATION", "current_station": term_a_name, "current_station_id": term_a_id, "previous_station": train["sched_down"][-2]["station"]["name"], "next_station": None, "next_station_id": None, "journey_completed_pct": 100.0, "current_position": 100.0, "departed_terminal_at": seconds_to_time(down_dep_sec), "arrived_at_station": seconds_to_time(down_dep_sec + t_down), "departs_station_at": seconds_to_time(next_up_dep_sec), "eta_to_next_station_sec": t_turn - e_turn, "eta_to_next_station_min": round((t_turn - e_turn) / 60.0, 1), "timestamp": now.strftime("%Y-%m-%d %H:%M:%S")}
        elif e_turn < t_turn - 60:
            return {"train_id": train["train_id"], "display_name": f"{train['line_name']} · {train['terminal_B']}", "line": train["line_name"], "line_code": train["line_code"], "direction": "UP", "terminal_start": term_a_name, "terminal_end": train["terminal_B"], "platform_number": None, "platform_name": "Crossover / Reversing Siding", "platform_level": "Track Level", "is_interchange": False, "status": "REVERSING", "current_station": term_a_name, "current_station_id": term_a_id, "previous_station": None, "next_station": train["sched_up"][1]["station"]["name"], "next_station_id": train["sched_up"][1]["station"]["id"], "journey_completed_pct": 0.0, "current_position": 1.0, "departed_terminal_at": None, "arrived_at_station": None, "departs_station_at": seconds_to_time(next_up_dep_sec), "eta_to_next_station_sec": t_turn - e_turn, "eta_to_next_station_min": round((t_turn - e_turn) / 60.0, 1), "train_capacity": TRAIN_CAPACITY, "train_current_passengers": 0, "train_occupancy_pct": 0.0, "train_crowd_level": "EMPTY", "passenger_event": "REVERSING", "event_progress_pct": round(((e_turn - 60) / max(1, t_turn - 120)) * 100, 1), "coaches": _empty_coaches(), "timestamp": now.strftime("%Y-%m-%d %H:%M:%S")}
        else:
            p_data = get_platform_info(train["line_code"], "UP", term_a_id, term_a_name)
            return {"train_id": train["train_id"], "display_name": f"{train['line_name']} · {train['terminal_B']}", "line": train["line_name"], "line_code": train["line_code"], "direction": "UP", "terminal_start": term_a_name, "terminal_end": train["terminal_B"], "platform_number": p_data["platform_number"], "platform_name": p_data["platform_name"], "platform_level": p_data["platform_level"], "is_interchange": p_data["is_interchange"], "status": "WAITING_AT_TERMINAL", "current_station": term_a_name, "current_station_id": term_a_id, "previous_station": None, "next_station": train["sched_up"][1]["station"]["name"], "next_station_id": train["sched_up"][1]["station"]["id"], "journey_completed_pct": 0.0, "current_position": 1.0, "departed_terminal_at": None, "arrived_at_station": None, "departs_station_at": seconds_to_time(next_up_dep_sec), "eta_to_next_station_sec": t_turn - e_turn, "eta_to_next_station_min": round((t_turn - e_turn) / 60.0, 1), "train_capacity": TRAIN_CAPACITY, "train_current_passengers": 0, "train_occupancy_pct": 0.0, "train_crowd_level": "EMPTY", "passenger_event": "WAITING", "event_progress_pct": round(((e_turn - (t_turn - 60)) / 60.0) * 100, 1), "coaches": _empty_coaches(), "timestamp": now.strftime("%Y-%m-%d %H:%M:%S")}

def _evaluate_schedule_segment(train, schedule, direction, terminal_start, terminal_end, active_dep_sec, dep_dt, elapsed_s, total_trip_dur, now) -> dict:
    total_dist = abs(schedule[-1]["station"]["km"] - schedule[0]["station"]["km"]) or 1.0
    start_km = schedule[0]["station"]["km"]
    station_positions = [1.0 + 99.0 * (abs(seg["station"]["km"] - start_km) / total_dist) for seg in schedule]
    journey_completed_pct = round(min(100.0, max(0.0, (elapsed_s / total_trip_dur) * 100.0)), 2)
    status, cur_idx, prev_station, next_station, next_station_id, arrived_at, departs_at, eta_sec, is_in_transit, dwell_sec = "IN_TRANSIT", 0, None, None, None, None, None, 0, True, DWELL_NORMAL
    for i, seg in enumerate(schedule):
        if elapsed_s < seg["arrive_offset"]:
            status, cur_idx, prev_station, next_station, next_station_id, eta_sec, departs_at = "IN_TRANSIT", max(i-1, 0), schedule[max(i-1, 0)]["station"]["name"], seg["station"]["name"], seg["station"]["id"], seg["arrive_offset"] - elapsed_s, (dep_dt + timedelta(seconds=seg["depart_offset"])).strftime("%H:%M:%S" if SIMULATION_MODE == "PRESENTATION" else "%H:%M")
            break
        elif seg["arrive_offset"] <= elapsed_s <= seg["depart_offset"]:
            status, cur_idx, prev_station, next_station, next_station_id, arrived_at, departs_at, eta_sec, is_in_transit, dwell_sec = "AT_STATION", i, (schedule[i-1]["station"]["name"] if i > 0 else None), (schedule[i+1]["station"]["name"] if i < len(schedule)-1 else None), (schedule[i+1]["station"]["id"] if i < len(schedule)-1 else None), (dep_dt + timedelta(seconds=seg["arrive_offset"])).strftime("%H:%M:%S" if SIMULATION_MODE == "PRESENTATION" else "%H:%M"), (dep_dt + timedelta(seconds=seg["depart_offset"])).strftime("%H:%M:%S" if SIMULATION_MODE == "PRESENTATION" else "%H:%M"), max(0, seg["depart_offset"] - elapsed_s), False, seg["depart_offset"] - seg["arrive_offset"]
            break
    else: cur_idx = len(schedule)-1; status = "AT_STATION"
    occ = compute_coach_passengers(train["train_id"], schedule, cur_idx, direction, dep_dt, dwell_sec, 0 if status == "IN_TRANSIT" else (elapsed_s - schedule[cur_idx]["arrive_offset"]), status == "IN_TRANSIT")
    p_data = get_platform_info(train["line_code"], direction, schedule[cur_idx]["station"]["id"], schedule[cur_idx]["station"]["name"])
    return {**occ, "train_id": train["train_id"], "display_name": f"{train['line_name']} · {terminal_end}", "line": train["line_name"], "line_code": train["line_code"], "direction": direction, "terminal_start": terminal_start, "terminal_end": terminal_end, "platform_number": p_data["platform_number"], "platform_name": p_data["platform_name"], "platform_level": p_data["platform_level"], "is_interchange": p_data["is_interchange"], "status": status, "current_station": schedule[cur_idx]["station"]["name"], "current_station_id": schedule[cur_idx]["station"]["id"], "previous_station": prev_station, "next_station": next_station, "next_station_id": next_station_id, "journey_completed_pct": journey_completed_pct, "current_position": round(station_positions[cur_idx], 2), "departed_terminal_at": seconds_to_time(active_dep_sec), "arrived_at_station": arrived_at, "departs_station_at": departs_at, "eta_to_next_station_sec": eta_sec, "eta_to_next_station_min": round(eta_sec / 60.0, 1), "timestamp": now.strftime("%Y-%m-%d %H:%M:%S")}

def _not_running(train, now):
    return {"train_id": train["train_id"], "display_name": f"{train['line_name']} · {train['terminal_B']}", "line": train["line_name"], "line_code": train["line_code"], "direction": "UP", "status": "NOT_IN_SERVICE", "journey_completed_pct": 0.0, "current_position": 0.0, "message": "Train not in service", "timestamp": now.strftime("%Y-%m-%d %H:%M:%S")}

# ══════════════════════════════════════════════
#  PUBLIC ENGINE CLASS
# ══════════════════════════════════════════════

class MetroEngine:
    def __init__(self):
        self._date   = date.today()
        self._trains = build_train_roster(datetime.now())
    def _refresh(self, now):
        if now.date() != self._date: self._date, self._trains = now.date(), build_train_roster(now)
    def all_trains(self, now=None):
        now = now or datetime.now(); self._refresh(now)
        return [get_train_state(t, now) for t in self._trains]
    def query_by_train(self, train_id: str, now=None):
        now = now or datetime.now(); self._refresh(now)
        for t in self._trains:
            if t["train_id"] == train_id.upper(): return get_train_state(t, now)
        return {"error": "Not found"}

    def query_by_station(self, station_name: str, now=None):
        now = now or datetime.now(); self._refresh(now)
        name_lower = station_name.lower().strip()
        results = []
        for t in self._trains:
            s = get_train_state(t, now)
            if s.get("status") == "NOT_IN_SERVICE":
                continue
            curr = s.get("current_station", "").lower()
            nxt = (s.get("next_station") or "").lower()
            if name_lower in curr:
                results.append({**s, "arrives_in_sec": 0, "arrives_in_min": 0, "match_type": "AT_STATION"})
            elif name_lower in nxt:
                eta = s.get("eta_to_next_station_sec", 0)
                l_code = s.get("line_code") or ("BL" if "BL" in s["train_id"] else "RL")
                p_info = get_platform_info(l_code, s.get("direction", "UP"), s.get("next_station_id", ""), s.get("next_station", ""))
                results.append({
                    **s,
                    "platform_number": p_info["platform_number"],
                    "platform_name": p_info["platform_name"],
                    "platform_level": p_info["platform_level"],
                    "arrives_in_sec": eta,
                    "arrives_in_min": round(eta / 60.0, 1),
                    "match_type": "ARRIVING_NEXT"
                })
        results.sort(key=lambda x: x["arrives_in_sec"])
        return {
            "station": station_name,
            "timestamp": now.strftime("%Y-%m-%d %H:%M:%S"),
            "trains_found": len(results),
            "upcoming_trains": results,
        }

    def summary(self, now=None):
        now = now or datetime.now()
        states = self.all_trains(now)
        running = [s for s in states if s.get("status") != "NOT_IN_SERVICE"]
        avg = round(sum(s.get("train_occupancy_pct", 0) for s in running) / max(len(running), 1), 1)
        return {"timestamp": now.strftime("%Y-%m-%d %H:%M:%S"), "total_trains": len(states), "trains_in_service": len(running), "average_occupancy_pct": avg}

engine = MetroEngine()

# ══════════════════════════════════════════════
#  STATION CURRENT AND FEATURE HELPERS
# ══════════════════════════════════════════════

def get_station_current_state(station_id: str, train_states: list, now: datetime) -> dict:
    """Finds if a train is currently dwelling at the station, matching current time with arrival/departure."""
    for ts in train_states:
        if ts.get("status") == "AT_STATION" and ts.get("current_station_id") == station_id:
            return {
                "train_id": ts["train_id"],
                "platform_number": ts.get("platform_number"),
                "platform_name": ts.get("platform_name"),
                "current_passenger_count": ts["train_current_passengers"],
                "arrival_time": ts.get("arrived_at_station"),
                "departure_time": ts.get("departs_station_at"),
            }
    return {
        "train_id": None,
        "platform_number": None,
        "platform_name": None,
        "current_passenger_count": 0,
        "arrival_time": None,
        "departure_time": None,
    }


def get_station_feature_predictions(station_id: str, train_objects: list, now: datetime) -> dict | None:
    """
    Scans circulating train trip instances to find the closest upcoming train arriving at station_id.
    Uses the exact deterministic trip passenger chain for 100% accurate ML feature prediction.
    """
    now_sec = now.hour * 3600 + now.minute * 60 + now.second
    candidates = []

    for train in train_objects:
        for trip in train.get("trip_instances", []):
            sched = trip["schedule"]
            st_idx = next((i for i, seg in enumerate(sched) if seg["station"]["id"] == station_id), None)
            if st_idx is None:
                continue

            arr_sec = trip["dep_sec"] + sched[st_idx]["arrive_offset"]
            dep_sec = trip["dep_sec"] + sched[st_idx]["depart_offset"]

            if arr_sec > now_sec:
                arr_dt = datetime(now.year, now.month, now.day) + timedelta(seconds=arr_sec)
                dep_dt = datetime(now.year, now.month, now.day) + timedelta(seconds=trip["dep_sec"])
                dep_sched_dt = datetime(now.year, now.month, now.day) + timedelta(seconds=dep_sec)
                candidates.append({
                    "train": train,
                    "trip": trip,
                    "dep_dt": dep_dt,
                    "arrival_dt": arr_dt,
                    "departure_time": dep_sched_dt.strftime("%H:%M:%S" if SIMULATION_MODE == "PRESENTATION" else "%H:%M"),
                    "station_idx": st_idx,
                })

    if not candidates:
        return None

    candidates.sort(key=lambda x: x["arrival_dt"])
    best = candidates[0]

    train = best["train"]
    trip = best["trip"]
    dep_dt = best["dep_dt"]
    station_idx = best["station_idx"]
    arrival_dt = best["arrival_dt"]
    departure_time_str = best["departure_time"]

    schedule = trip["schedule"]
    direction = trip["direction"]
    profile = get_trip_passenger_profile(train["train_id"], schedule, direction, dep_dt)
    st_prof = profile[station_idx]
    st = schedule[station_idx]["station"]
    platform_data = get_platform_info(train["line_code"], direction, st["id"], st["name"])

    return {
        "train_id": train["train_id"],
        "platform_number": platform_data["platform_number"],
        "platform_name": platform_data["platform_name"],
        "estimated_arrival_time": arrival_dt.strftime("%H:%M:%S" if SIMULATION_MODE == "PRESENTATION" else "%H:%M"),
        "estimated_departure_time": departure_time_str,
        "estimated_passenger_incoming": st_prof["arr_passengers"],
        "estimated_alighting": st_prof["alighting"],
        "estimated_boarding": st_prof["boarding"],
        "estimated_station_passenger_count": st_prof["dep_passengers"],
    }

