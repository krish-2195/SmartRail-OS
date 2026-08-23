import asyncio
import logging
from datetime import datetime, timedelta

from app.db.session import SessionLocal
from app.services.domain.occupancy_service import OccupancyService
from app.repositories.base import (
    OccupancyRepository,
    StationRepository,
    TrainRepository,
    AlertRepository,
)
from app.services.engine.alert_engine import AlertEngine
from app.services.ingestion_service import IngestionService
from app.schemas.ingestion import SensorEvent, CoachData
from app.services.metro_engine import engine
from app.services.domain import estimation_service
from app.models.estimation import Estimation
from app.core.sim_clock import sim_clock

logger = logging.getLogger(__name__)

# Track last database vacuum execution date (runs once a day)
_last_vacuum_date = None

async def start_simulation_runner(interval_seconds: float = 5.0):
    """
    Background simulation loop. Runs every interval_seconds, gets train states 
    from the MetroEngine timetable, and updates the database via IngestionService.
    """
    logger.info("Starting background Metro Engine simulation runner...")
    while True:
        try:
            await run_simulation_step()
        except Exception as e:
            logger.error(f"Error in background simulation step: {e}", exc_info=True)
        await asyncio.sleep(interval_seconds)

async def run_simulation_step():
    now = sim_clock.now()
    train_states = engine.all_trains(now)
    
    async with SessionLocal() as db:
        # Construct repositories
        occupancy_repo = OccupancyRepository(db)
        station_repo = StationRepository(db)
        train_repo = TrainRepository(db)
        alert_repo = AlertRepository(db)
        
        # Construct services
        occupancy_service = OccupancyService(db, occupancy_repo, station_repo, train_repo)
        alert_engine = AlertEngine(db, alert_repo)
        ingestion_service = IngestionService(db, occupancy_service, alert_engine)
        
        for t_state in train_states:
            train_id = t_state["train_id"]
            status = t_state.get("status")
            
            # Find the train in DB
            db_train = await train_repo.get_by_train_id(train_id)
            if not db_train:
                continue
                
            if status == "NOT_IN_SERVICE":
                # Update train as inactive/out of service
                if (
                    db_train.status != "INACTIVE"
                    or db_train.current_station_id is not None
                    or db_train.journey_completed_pct != 0.0
                    or db_train.current_position != 0.0
                ):
                    db_train.status = "INACTIVE"
                    db_train.current_station_id = None
                    db_train.next_station_id = None
                    db_train.journey_completed_pct = 0.0
                    db_train.current_position = 0.0
                    db.add(db_train)
                continue
            
            # If in service, update status to ACTIVE
            if db_train.status != "ACTIVE":
                db_train.status = "ACTIVE"
                db.add(db_train)

            # Override dwelling train's C1 coach with live ESP32 sensor occupancy if active/targeted
            from app.core.esp32_state import esp32 as _esp32
            current_station_id = t_state.get("current_station_id")
            is_dwelling = status in ("AT_STATION", "WAITING_AT_TERMINAL")
            is_esp_target = (
                _esp32.is_active
                and is_dwelling
                and (_esp32.target_station_id is None or _esp32.target_station_id == current_station_id)
            )
            if is_esp_target:
                tot_pax = 0
                for c in t_state.get("coaches", []):
                    if c.get("coach_id") == "C1":
                        c["current_passengers"] = _esp32.occupancy
                        c["occupancy_pct"] = _esp32.occupancy_pct
                    tot_pax += c.get("current_passengers", 0)
                t_state["train_current_passengers"] = tot_pax

            # Process ingestion event
            coaches = [
                CoachData(
                    coach_id=c["coach_id"],
                    coach_type=c.get("coach_type", "GENERAL"),
                    passenger_count=c["current_passengers"],
                    occupancy_percentage=c["occupancy_pct"]
                )
                for c in t_state.get("coaches", [])
            ]
            
            event = SensorEvent(
                timestamp=now,
                train_id=train_id,
                station_id=t_state.get("current_station_id"),
                event_type="occupancy_update",
                coaches=coaches,
                delay_minutes=0
            )
            
            # Call ingestion service to update positions, create snapshots, check alerts and broadcast
            await ingestion_service.process_event(
                event,
                next_station_id=t_state.get("next_station_id"),
                journey_completed_pct=t_state.get("journey_completed_pct"),
                current_position=t_state.get("current_position"),
            )
        
        # Calculate and persist station crowd snapshots
        station_crowds = {}
        all_stations = await station_repo.get_all()
        for s in all_stations:
            station_crowds[s.station_id] = 0

        for t_state in train_states:
            status = t_state.get("status")
            if status == "NOT_IN_SERVICE":
                continue
            sid = t_state.get("current_station_id")
            pax = t_state.get("train_current_passengers", 0)
            if sid in station_crowds:
                station_crowds[sid] += pax

        from app.models.route import StationCrowdSnapshot
        is_overnight = (now.hour >= 23 or now.hour < 6)
        for sid, crowd in station_crowds.items():
            pred_5 = 0 if (is_overnight or crowd == 0) else int(crowd * 1.1)
            pred_15 = 0 if (is_overnight or crowd == 0) else int(crowd * 1.25)
            pred_30 = 0 if (is_overnight or crowd == 0) else int(crowd * 1.4)
            db.add(StationCrowdSnapshot(
                station_id=sid,
                timestamp=now,
                current_crowd=crowd,
                predicted_5_min=pred_5,
                predicted_15_min=pred_15,
                predicted_30_min=pred_30,
            ))

        # ── Per-Station Current & Feature Snapshots ──────────────────────────
        # Each station gets its own pair of tables (station_{id}_current and
        # station_{id}_feature) that always hold exactly ONE row: the live state
        # at the moment datetime.now() is evaluated by the engine.
        #
        # station_{id}_current  ─ most relevant train RIGHT NOW:
        #   AT_STATION (dwelling) → IN_TRANSIT within 120s (just departed) → next arriving
        #   includes arrival/departure times + coach-wise passengers & occupancy %
        #
        # station_{id}_feature  ─ NEXT upcoming train prediction:
        #   exact arrival/departure from engine timetable
        #   estimated coach-wise load at arrival AND at departure (after board/alight)
        from app.models.station import STATION_CURRENT_TABLES, STATION_FEATURE_TABLES
        from sqlalchemy import insert as sa_insert
        from datetime import timedelta as _td

        schedules_map = {t_raw["train_id"]: t_raw["schedule"] for t_raw in engine._trains}

        CAP = 400  # coach capacity

        def _offset_to_hhmm(terminal_dep_str: str, offset_s: int) -> str | None:
            """Compute HH:MM for (terminal departure time + offset_s seconds)."""
            if not terminal_dep_str:
                return None
            try:
                h, m = map(int, terminal_dep_str.split(":"))
                dt = datetime(now.year, now.month, now.day, h, m) + _td(seconds=offset_s)
                return dt.strftime("%H:%M")
            except (ValueError, OverflowError):
                return None

        def _coaches(t_state: dict) -> tuple[dict, dict, dict]:
            """Extract C1/C2/C3 coach dicts from a train state."""
            coaches = t_state.get("coaches", []) if t_state else []
            c1 = next((c for c in coaches if c.get("coach_id") == "C1"), {})
            c2 = next((c for c in coaches if c.get("coach_id") == "C2"), {})
            c3 = next((c for c in coaches if c.get("coach_id") == "C3"), {})
            return c1, c2, c3

        for station in all_stations:
            sid = station.station_id
            cur_tbl  = STATION_CURRENT_TABLES.get(sid)
            feat_tbl = STATION_FEATURE_TABLES.get(sid)
            if cur_tbl is None or feat_tbl is None:
                continue

            # ── Table 1: most relevant current train ──────────────────────
            target_train = None
            status_label = "none"
            eta_sec      = None
            sched_idx    = None   # schedule index of sid for target_train

            # Priority 1 – dwelling at platform (AT_STATION / WAITING_AT_TERMINAL)
            for t in train_states:
                if t.get("status") in ("AT_STATION", "WAITING_AT_TERMINAL") and t.get("current_station_id") == sid:
                    target_train = t
                    status_label = "at_platform"
                    sched = schedules_map.get(t["train_id"], [])
                    sched_idx = next((i for i, seg in enumerate(sched) if seg["station"]["id"] == sid), None)
                    
                    eta_sec = 0
                    if sched_idx is not None:
                        dep_str = t.get("departed_terminal_at") or t.get("departs_station_at")
                        if dep_str:
                            try:
                                dep_h, dep_m = map(int, dep_str.split(":"))
                                dep_dt = datetime(now.year, now.month, now.day, dep_h, dep_m)
                                target_dep = dep_dt + _td(seconds=sched[sched_idx]["depart_offset"])
                                eta_sec = int((target_dep - now).total_seconds())
                                if eta_sec < 0:
                                    eta_sec = 0
                            except ValueError:
                                pass
                    break

            # Priority 2 – just departed (IN_TRANSIT, left this station ≤120 s ago)
            if not target_train:
                for t in train_states:
                    if t.get("status") != "IN_TRANSIT" or t.get("current_station_id") != sid:
                        continue
                    sched = schedules_map.get(t["train_id"], [])
                    c_idx = next((i for i, seg in enumerate(sched) if seg["station"]["id"] == sid), None)
                    if c_idx is None:
                        continue
                    dep_str = t.get("departed_terminal_at")
                    if not dep_str:
                        continue
                    try:
                        dep_h, dep_m = map(int, dep_str.split(":"))
                        dep_dt  = datetime(now.year, now.month, now.day, dep_h, dep_m)
                        elapsed = int((now - dep_dt).total_seconds())
                        since_dep = elapsed - sched[c_idx]["depart_offset"]
                        if 0 <= since_dep <= 120:
                            target_train = t
                            status_label = "just_departed"
                            eta_sec      = since_dep
                            sched_idx    = c_idx
                            break
                    except ValueError:
                        pass

            # Priority 3 – next arriving train (smallest positive ETA)
            if not target_train:
                candidates = []
                for t in train_states:
                    if t.get("status") == "NOT_IN_SERVICE":
                        continue
                    sched = schedules_map.get(t["train_id"], [])
                    t_idx = next((i for i, seg in enumerate(sched) if seg["station"]["id"] == sid), None)
                    c_idx = next((i for i, seg in enumerate(sched) if seg["station"]["id"] == t.get("current_station_id")), None)
                    if t_idx is None or c_idx is None or t_idx <= c_idx:
                        continue
                    dep_str = t.get("departed_terminal_at") or t.get("departs_station_at")
                    if not dep_str:
                        continue
                    try:
                        dep_h, dep_m = map(int, dep_str.split(":"))
                        dep_dt  = datetime(now.year, now.month, now.day, dep_h, dep_m)
                        arr_dt  = dep_dt + _td(seconds=sched[t_idx]["arrive_offset"])
                        eta     = int((arr_dt - now).total_seconds())
                        if eta > 0:
                            candidates.append((t, eta, t_idx))
                    except ValueError:
                        pass
                if candidates:
                    candidates.sort(key=lambda x: x[1])
                    target_train, eta_sec, sched_idx = candidates[0]
                    status_label = "arriving"

            # Compute exact arrival / departure times from timetable
            arr_time = dep_time = None
            if target_train and sched_idx is not None:
                dep_str = target_train.get("departed_terminal_at") or target_train.get("departs_station_at")
                sched   = schedules_map.get(target_train["train_id"], [])
                if dep_str and sched_idx < len(sched):
                    arr_time = _offset_to_hhmm(dep_str, sched[sched_idx]["arrive_offset"])
                    dep_time = _offset_to_hhmm(dep_str, sched[sched_idx]["depart_offset"])
                # Fallback to engine-provided strings
                if not arr_time:
                    arr_time = target_train.get("arrived_at_station")
                if not dep_time:
                    dep_time = target_train.get("departs_station_at")

            # Extract coach data for the current train
            c1, c2, c3 = _coaches(target_train)

            # DELETE old single row, INSERT fresh one
            await db.execute(cur_tbl.delete())
            if target_train:
                await db.execute(cur_tbl.insert().values(
                    train_id        = target_train["train_id"],
                    platform_number = target_train.get("platform_number"),
                    platform_name   = target_train.get("platform_name"),
                    train_status    = status_label,
                    eta_seconds     = eta_sec,
                    arrival_time    = arr_time,
                    departure_time  = dep_time,
                    total_passengers= target_train.get("train_current_passengers"),
                    c1_passengers   = c1.get("current_passengers"),
                    c1_pct          = round(c1.get("occupancy_pct", 0.0), 1),
                    c2_passengers   = c2.get("current_passengers"),
                    c2_pct          = round(c2.get("occupancy_pct", 0.0), 1),
                    c3_passengers   = c3.get("current_passengers"),
                    c3_pct          = round(c3.get("occupancy_pct", 0.0), 1),
                    timestamp       = now,
                ))
            else:
                await db.execute(cur_tbl.insert().values(
                    train_id        = None,
                    platform_number = None,
                    platform_name   = None,
                    train_status    = "none",
                    eta_seconds     = None,
                    arrival_time    = None,
                    departure_time  = None,
                    total_passengers= 0,
                    c1_passengers   = 0,
                    c1_pct          = 0.0,
                    c2_passengers   = 0,
                    c2_pct          = 0.0,
                    c3_passengers   = 0,
                    c3_pct          = 0.0,
                    timestamp       = now,
                ))

            # ── Table 2: next upcoming train + estimated coach load ────────
            upcoming_trips = []
            for train in engine._trains:
                for trip in train.get("trip_instances", []):
                    sched = trip["schedule"]
                    t_idx = next((i for i, seg in enumerate(sched) if seg["station"]["id"] == sid), None)
                    if t_idx is None:
                        continue
                    dep_sec = trip["dep_sec"]
                    dep_dt = datetime(now.year, now.month, now.day) + _td(seconds=dep_sec)
                    arr_dt = dep_dt + _td(seconds=sched[t_idx]["arrive_offset"])
                    dep_stn = dep_dt + _td(seconds=sched[t_idx]["depart_offset"])
                    eta = int((arr_dt - now).total_seconds())
                    # Only include future arrivals
                    if eta > 0:
                        upcoming_trips.append((train, trip, dep_dt, arr_dt, dep_stn, t_idx))

            # If a train is already at platform, exclude it from upcoming
            # (it's the "current" train — upcoming should be the ones after)
            if target_train and status_label == "at_platform":
                upcoming_trips = [(t, tr, d_dt, a, d, i) for t, tr, d_dt, a, d, i in upcoming_trips if t["train_id"] != target_train["train_id"]]

            upcoming_trips.sort(key=lambda x: x[3])

            upcoming_rows = []
            from app.services.metro_engine import get_platform_info, get_trip_passenger_profile, SIMULATION_MODE
            for feat_t, feat_trip, feat_dep_dt, feat_arr, feat_dep, t_idx in upcoming_trips:
                sched = feat_trip["schedule"]
                direction = feat_trip["direction"]
                st_prof = get_trip_passenger_profile(feat_t["train_id"], sched, direction, feat_dep_dt)[t_idx]
                p_info = get_platform_info(feat_t["line_code"], direction, sid, station.name)

                arr_total = st_prof["arr_passengers"]
                dep_total = st_prof["dep_passengers"]
                from app.services.metro_engine import LADIES_COACH_FACTOR
                ladies_share  = LADIES_COACH_FACTOR / (2 + LADIES_COACH_FACTOR)
                general_share = 1.0 / (2 + LADIES_COACH_FACTOR)

                arr_c2 = int(arr_total * ladies_share)
                arr_c1 = int(arr_total * general_share)
                arr_c3 = arr_total - arr_c1 - arr_c2

                dep_c2 = int(dep_total * ladies_share)
                dep_c1 = int(dep_total * general_share)
                dep_c3 = dep_total - dep_c1 - dep_c2

                time_fmt = "%H:%M:%S" if SIMULATION_MODE == "PRESENTATION" else "%H:%M"
                upcoming_rows.append({
                    "train_id":                 feat_t["train_id"],
                    "platform_number":          p_info["platform_number"],
                    "platform_name":            p_info["platform_name"],
                    "estimated_arrival_time":   feat_arr.strftime(time_fmt),
                    "estimated_departure_time": feat_dep.strftime(time_fmt),
                    "arr_total_passengers":     arr_total,
                    "arr_c1_passengers":        arr_c1,
                    "arr_c1_pct":               round(arr_c1 / CAP * 100, 1),
                    "arr_c2_passengers":        arr_c2,
                    "arr_c2_pct":               round(arr_c2 / CAP * 100, 1),
                    "arr_c3_passengers":        arr_c3,
                    "arr_c3_pct":               round(arr_c3 / CAP * 100, 1),
                    "dep_total_passengers":     dep_total,
                    "dep_c1_passengers":        dep_c1,
                    "dep_c1_pct":               round(dep_c1 / CAP * 100, 1),
                    "dep_c2_passengers":        dep_c2,
                    "dep_c2_pct":               round(dep_c2 / CAP * 100, 1),
                    "dep_c3_passengers":        dep_c3,
                    "dep_c3_pct":               round(dep_c3 / CAP * 100, 1),
                    "timestamp":                now,
                })

            await db.execute(feat_tbl.delete())
            if upcoming_rows:
                await db.execute(sa_insert(feat_tbl), upcoming_rows)

        # ── ESP32 Dummy Train Injection ──────────────────────────────────────
        # If the ESP32 serial bridge has posted at least one occupancy reading,
        # write the ESP32_DEMO row into station_*_current tables so the mobile
        # app sees live sensor data at every station (or just target_station_id
        # if one was specified in the POST payload).
        from app.core.esp32_state import esp32 as _esp32
        if _esp32.is_active:
            _target_sid = _esp32.target_station_id  # None → inject into ALL stations

            for station in all_stations:
                sid = station.station_id
                cur_tbl = STATION_CURRENT_TABLES.get(sid)
                if cur_tbl is None:
                    continue

                # Only inject if no real train is currently at this station
                # (priority 1: real trains always win; ESP32 fills the gap)
                real_train_here = any(
                    t.get("status") in ("AT_STATION", "WAITING_AT_TERMINAL")
                    and t.get("current_station_id") == sid
                    for t in train_states
                )
                
                is_targeted = (_target_sid is not None and sid == _target_sid)
                if not is_targeted and real_train_here:
                    # If this station is not targeted and a real train is dwelling at platform,
                    # keep the real train. Otherwise overwrite with ESP32 dummy train.
                    continue

                _occ  = _esp32.get_station_occupancy(sid)
                _pct  = _esp32.get_station_occupancy_pct(sid)

                await db.execute(cur_tbl.delete())
                await db.execute(cur_tbl.insert().values(
                    train_id        = "ESP32_DEMO",
                    train_status    = "at_platform",
                    eta_seconds     = 0,
                    arrival_time    = now.strftime("%H:%M"),
                    departure_time  = now.strftime("%H:%M"),
                    total_passengers= _occ,
                    c1_passengers   = _occ,   # all pax attributed to Coach 1
                    c1_pct          = _pct,
                    c2_passengers   = 0,
                    c2_pct          = 0.0,
                    c3_passengers   = 0,
                    c3_pct          = 0.0,
                    timestamp       = now,
                ))

        # ── Data Retention Cleanup ───────────────────────────────────────────
        # Per-station tables always have ≤1 row (DELETE+INSERT each tick),
        # so only the shared transactional tables need the 24-h purge.
        cutoff = now - timedelta(hours=24)
        from sqlalchemy import delete
        from app.models.train import OccupancySnapshot
        await db.execute(
            delete(OccupancySnapshot).where(OccupancySnapshot.timestamp < cutoff)
        )
        await db.execute(
            delete(StationCrowdSnapshot).where(StationCrowdSnapshot.timestamp < cutoff)
        )
        await db.execute(
            delete(Estimation).where(Estimation.created_at < cutoff)
        )
        logger.debug(f"Cleanup: removed snapshots older than {cutoff}")

        await db.commit()


    # ── Passenger Estimations ────────────────────────────────────────────────
    # Run the ML model in a thread (CPU-bound) so it doesn't block the event loop.
    # Results are written in a separate DB session.
    try:
        import asyncio
        loop = asyncio.get_event_loop()
        estimation_rows = await loop.run_in_executor(
            None,
            estimation_service.estimate_for_train_states,
            train_states,
            now,
        )
        if estimation_rows:
            async with SessionLocal() as est_db:
                for row in estimation_rows:
                    est_db.add(Estimation(**row))
                await est_db.commit()
            logger.debug(f"Estimation: wrote {len(estimation_rows)} rows for {now}")
    except Exception as exc:
        logger.error(f"Estimation step failed: {exc}", exc_info=True)

    # ── Database Defragmentation (Daily VACUUM) ─────────────────────────────
    # Run VACUUM daily to reclaim space from old deleted snapshot rows.
    # Runs outside the main transaction to avoid SQLite operational conflicts.
    global _last_vacuum_date
    if _last_vacuum_date is None:
        _last_vacuum_date = now.date()  # Initialize on startup
    elif _last_vacuum_date != now.date():
        try:
            from app.db.session import engine as db_engine
            from sqlalchemy import text
            async with db_engine.connect() as conn:
                autocommit_conn = conn.execution_options(isolation_level="AUTOCOMMIT")
                await autocommit_conn.execute(text("VACUUM"))
            _last_vacuum_date = now.date()
            logger.info("Daily database vacuum completed successfully (reclaimed fragmented space).")
        except Exception as vacuum_exc:
            logger.warning(f"Daily database vacuum failed: {vacuum_exc}")

    # ── Real-Time WebSocket Broadcast (Direct Cache Hydration) ───────────────
    try:
        from app.core.websockets import manager
        if manager.active_connections:
            from app.services.data_service import data_service
            live_trains_out = [t.model_dump() for t in data_service.get_all_trains_live(now)]
            interchange_trains = [t.model_dump() for t in data_service.get_trains_at_station("Old High Court", now)]
            incoming_trains = [t.model_dump() for t in data_service.get_incoming_trains_at_station("Old High Court", now)]
            crowd_pred = data_service.get_station_crowd_prediction("Old High Court", now)
            crowd_dump = crowd_pred.model_dump() if crowd_pred else {
                "current_station_crowd": 0, "predicted_5_min": 0, "predicted_15_min": 0, "predicted_30_min": 0
            }
            
            await manager.broadcast({
                "event_type": "simulation_tick",
                "data": {
                    "timestamp": now.isoformat(),
                    "trains": live_trains_out,
                    "snapshot": {
                        "current_trains": interchange_trains,
                        "incoming_trains": incoming_trains,
                        "crowd_prediction": crowd_dump,
                        "alerts": [],
                        "recommendations": []
                    },
                    "station_crowds": station_crowds,
                }
            })
    except Exception as ws_broadcast_exc:
        logger.debug(f"WS simulation_tick broadcast notice: {ws_broadcast_exc}")
