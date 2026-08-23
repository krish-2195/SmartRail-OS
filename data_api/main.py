"""
MetroPulse — Ahmedabad Metro Simulation API
Run: uvicorn main:app --reload --port 8000
Docs: http://localhost:8000/docs
"""

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
from typing import Optional
try:
    from data_api.metro_engine_shared import engine
except ImportError:
    from metro_engine_shared import engine

app = FastAPI(
    title="🚇 MetroPulse — Ahmedabad Metro API",
    description="""
Simulates real-time Ahmedabad Metro (GMRC Phase-1) data for **Blue Line** and **Red Line**.

Based on official timetable:
- Blue Line: 06:20 – 22:05 | Peak 9 min | Non-peak 10 min | Weekend 12 min
- Red Line: 06:20 – 22:09 | Peak 10 min | Non-peak/Weekend 12 min

**Quick start:**
- `/trains` → all 21 trains live
- `/trains/{train_id}` → e.g. `BL-UP-03`
- `/station/{station_name}` → e.g. `Old High Court`
- `/summary` → admin dashboard
    """,
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── helpers ──────────────────────────────────

def parse_sim_time(sim_time: Optional[str]) -> datetime:
    """
    If sim_time provided (HH:MM or HH:MM:SS), simulate at that time today.
    Otherwise use real now(). Useful for testing peak/off-peak behaviour.
    """
    if sim_time:
        try:
            today = datetime.now().date()
            t = datetime.strptime(sim_time, "%H:%M")
            return datetime(today.year, today.month, today.day, t.hour, t.minute)
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail="Invalid sim_time format. Use HH:MM e.g. '09:15' or '17:30'"
            )
    return datetime.now()


# ══════════════════════════════════════════════
#  ROUTES
# ══════════════════════════════════════════════

@app.get("/", tags=["Info"], summary="API overview")
def root():
    """Health check and list of all endpoints."""
    return {
        "app": "MetroPulse",
        "status": "running",
        "server_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "lines": {
            "BL": "Blue Line — Vastral Gam ↔ Thaltej Gam (18 stations, 11 trains)",
            "RL": "Red Line  — APMC ↔ Motera Stadium (15 stations, 10 trains)",
        },
        "endpoints": {
            "GET /trains":                    "All 21 trains live state",
            "GET /trains/{train_id}":         "Single train by ID e.g. BL-UP-03",
            "GET /trains/line/{line_code}":   "All trains on BL or RL",
            "GET /station/{station_name}":    "All upcoming trains at a station",
            "GET /stations":                  "All stations for both lines",
            "GET /stations/{line_code}":      "Stations for BL or RL",
            "GET /summary":                   "Admin dashboard — crowd & overload alerts",
        },
        "tip": "Add ?sim_time=HH:MM to any endpoint to simulate a specific time of day.",
    }


# ── /trains ───────────────────────────────────

@app.get("/trains", tags=["Trains"], summary="All trains — live state")
def get_all_trains(
    line: Optional[str]      = Query(None, description="Filter by line code: BL or RL"),
    direction: Optional[str] = Query(None, description="Filter by direction: UP or DOWN"),
    status: Optional[str]    = Query(None, description="Filter by status: AT_STATION | IN_TRANSIT | WAITING_AT_TERMINAL"),
    crowd: Optional[str]     = Query(None, description="Filter by crowd: EMPTY | MODERATE | CROWDED | VERY_CROWDED"),
    sim_time: Optional[str]  = Query(None, description="Simulate time HH:MM e.g. 09:15"),
):
    """
    Returns live state of all 21 trains (11 Blue + 10 Red).

    Each train includes:
    - Current station, previous station, next station
    - Status: AT_STATION / IN_TRANSIT / WAITING_AT_TERMINAL
    - Departed terminal at, arrives/departs current station
    - ETA to next station (seconds + minutes)
    - Occupancy count, %, crowd level
    """
    now = parse_sim_time(sim_time)
    trains = engine.all_trains(now)

    if line:
        trains = [t for t in trains if t.get("line_code") == line.upper()]
    if direction:
        trains = [t for t in trains if t.get("direction") == direction.upper()]
    if status:
        trains = [t for t in trains if t.get("status") == status.upper()]
    if crowd:
        trains = [t for t in trains if t.get("crowd_level") == crowd.upper()]

    return {
        "timestamp":   now.strftime("%Y-%m-%d %H:%M:%S"),
        "total":       len(trains),
        "filters_applied": {k: v for k, v in
                            {"line": line, "direction": direction,
                             "status": status, "crowd": crowd}.items() if v},
        "trains": trains,
    }


@app.get("/trains/line/{line_code}", tags=["Trains"], summary="Trains by line")
def get_trains_by_line(
    line_code: str,
    sim_time: Optional[str] = Query(None, description="Simulate time HH:MM"),
):
    """
    All trains on a specific line.
    - `BL` → Blue Line (11 trains)
    - `RL` → Red Line (10 trains)
    """
    now = parse_sim_time(sim_time)
    code = line_code.upper()
    if code not in ("BL", "RL"):
        raise HTTPException(status_code=404, detail="Invalid line code. Use BL or RL.")

    trains = [t for t in engine.all_trains(now) if t.get("line_code") == code]
    line_name = "Blue Line" if code == "BL" else "Red Line"

    return {
        "line":      line_name,
        "line_code": code,
        "timestamp": now.strftime("%Y-%m-%d %H:%M:%S"),
        "total":     len(trains),
        "trains":    trains,
    }


@app.get("/trains/{train_id}", tags=["Trains"], summary="Single train by ID")
def get_train_by_id(
    train_id: str,
    sim_time: Optional[str] = Query(None, description="Simulate time HH:MM"),
):
    """
    Live state of one train by ID.

    **Valid IDs:**
    - Blue Line UP:   `BL-UP-01` to `BL-UP-06`
    - Blue Line DOWN: `BL-DO-01` to `BL-DO-05`
    - Red Line UP:    `RL-UP-01` to `RL-UP-05`
    - Red Line DOWN:  `RL-DO-01` to `RL-DO-05`
    """
    now = parse_sim_time(sim_time)
    result = engine.query_by_train(train_id, now)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result)
    return result


# ── /station ──────────────────────────────────

@app.get("/station/{station_name}", tags=["Stations"], summary="Upcoming trains at a station")
def get_trains_at_station(
    station_name: str,
    sim_time: Optional[str] = Query(None, description="Simulate time HH:MM"),
):
    """
    All trains currently AT or arriving NEXT at the given station.

    Results sorted by arrival time (soonest first).

    **Example station names:**
    `Old High Court`, `Kalupur Metro Station`, `Gujarat University`,
    `APMC`, `Motera Stadium`, `Gandhigram`, `Sabarmati Rly Station`
    """
    now = parse_sim_time(sim_time)
    result = engine.query_by_station(station_name, now)

    if result["trains_found"] == 0:
        raise HTTPException(
            status_code=404,
            detail={
                "message": f"No trains found for station '{station_name}'. "
                           "Check spelling or try a partial name.",
                "blue_line_stations": [
                    "Vastral Gam","Nirant Cross Road","Vastral","Rabari Colony",
                    "Amraivadi","Apparel Park","Kankaria East","Kalupur Metro Station",
                    "Ghee Kanta","Shahpur","Old High Court","S P Stadium",
                    "Commerce Six Road","Gujarat University","Gurukul Road",
                    "Doordarshan Kendra","Thaltej","Thaltej Gam"
                ],
                "red_line_stations": [
                    "APMC","Jivraj Park","Rajivnagar","Shreyas","Paldi",
                    "Gandhigram","Old High Court","Usmanpura","Vijay Nagar",
                    "Vadaj","Ranip","Sabarmati Rly Station","AEC",
                    "Sabarmati","Motera Stadium"
                ],
            }
        )
    return result


# ── /stations ─────────────────────────────────

@app.get("/stations", tags=["Stations"], summary="All stations — both lines")
def get_all_stations():
    """Full station list for Blue Line and Red Line with IDs and distances."""
    from metro_engine import BLUE_LINE_STATIONS, RED_LINE_STATIONS
    return {
        "blue_line": {
            "line_code":      "BL",
            "line_name":      "Blue Line (East-West Corridor)",
            "terminal_start": "Vastral Gam",
            "terminal_end":   "Thaltej Gam",
            "total_distance_km": BLUE_LINE_STATIONS[-1][2],
            "station_count":  len(BLUE_LINE_STATIONS),
            "stations": [
                {"index": i+1, "id": s[0], "name": s[1],
                 "distance_from_start_km": s[2], "is_interchange": s[3]}
                for i, s in enumerate(BLUE_LINE_STATIONS)
            ],
        },
        "red_line": {
            "line_code":      "RL",
            "line_name":      "Red Line (North-South Corridor)",
            "terminal_start": "APMC",
            "terminal_end":   "Motera Stadium",
            "total_distance_km": RED_LINE_STATIONS[-1][2],
            "station_count":  len(RED_LINE_STATIONS),
            "stations": [
                {"index": i+1, "id": s[0], "name": s[1],
                 "distance_from_start_km": s[2], "is_interchange": s[3]}
                for i, s in enumerate(RED_LINE_STATIONS)
            ],
        },
    }


@app.get("/stations/{line_code}", tags=["Stations"], summary="Stations for one line")
def get_stations_by_line(line_code: str):
    """Stations for BL (Blue Line) or RL (Red Line)."""
    from metro_engine import BLUE_LINE_STATIONS, RED_LINE_STATIONS
    code = line_code.upper()
    if code == "BL":
        raw, name = BLUE_LINE_STATIONS, "Blue Line (East-West Corridor)"
        start, end = "Vastral Gam", "Thaltej Gam"
    elif code == "RL":
        raw, name = RED_LINE_STATIONS, "Red Line (North-South Corridor)"
        start, end = "APMC", "Motera Stadium"
    else:
        raise HTTPException(status_code=404, detail="Invalid line code. Use BL or RL.")

    return {
        "line_code": code,
        "line_name": name,
        "terminal_start": start,
        "terminal_end":   end,
        "station_count":  len(raw),
        "stations": [
            {"index": i+1, "id": s[0], "name": s[1],
             "distance_from_start_km": s[2], "is_interchange": s[3]}
            for i, s in enumerate(raw)
        ],
    }


# ── /summary ──────────────────────────────────

@app.get("/summary", tags=["Admin"], summary="Admin dashboard summary")
def get_summary(
    sim_time: Optional[str] = Query(None, description="Simulate time HH:MM"),
):
    """
    Admin dashboard — crowd distribution, overloaded trains, headway info, suggestions.

    Use `sim_time` to test different scenarios:
    - `?sim_time=09:00` → morning peak (very crowded)
    - `?sim_time=14:00` → midday (moderate)
    - `?sim_time=18:30` → evening peak (very crowded)
    - `?sim_time=22:30` → last trains / end of service
    """
    now = parse_sim_time(sim_time)
    return engine.summary(now)
