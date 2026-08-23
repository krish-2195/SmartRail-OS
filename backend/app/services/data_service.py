from datetime import datetime, timedelta
from app.core.sim_clock import sim_clock
from typing import Iterable

from fastapi import HTTPException

from app.services.metro_engine import (
    BL_DOWN_SCHED,
    BL_UP_SCHED,
    BLUE_LINE_STATIONS,
    COACHES,
    RED_LINE_STATIONS,
    RL_DOWN_SCHED,
    RL_UP_SCHED,
    engine,
)
from app.schemas.rail import (
    LineOut, StationOut, RouteOut, RouteStopOut, CoachOut,
    TrainCatalogueOut, IncomingTrainOut, StationCrowdPredictionOut, AlertOut,
    TrainAtStationOut, TrainCoachOut, JourneySearchItemOut, JourneyStopOut,
)
from app.schemas.occupancy import CoachOccupancyOut, TrainOccupancyOut, StationCrowdOut


class DataService:
    """Adapter layer: transforms metro_engine simulation into API contract schemas."""

    def __init__(self):
        self.engine = engine
        self.resolved_sim_alerts = set()
        self.acknowledged_sim_alerts = set()
        self._lines_cache = None
        self._stations_cache = None
        self._build_cache()

    def _build_cache(self):
        """Build static catalog data once."""
        # Lines
        self._lines_cache = [
            LineOut(id="BL", name="Blue Line", color="#0066CC", description="Main north-south corridor"),
            LineOut(id="RL", name="Red Line", color="#CC0000", description="East-west connector"),
        ]

        # Stations
        self._stations_cache = []
        for sid, name, _, _ in BLUE_LINE_STATIONS:
            self._stations_cache.append(
                StationOut(id=sid, name=name, code=sid, line_name="Blue Line", is_interchange=name in ["Old High Court", "Kalupur Metro Station"])
            )
        for sid, name, _, _ in RED_LINE_STATIONS:
            self._stations_cache.append(
                StationOut(id=sid, name=name, code=sid, line_name="Red Line", is_interchange=name in ["Old High Court", "Sabarmati Rly Station"])
            )

    def list_lines(self) -> list[LineOut]:
        """Fetch all transit lines."""
        return self._lines_cache

    def list_stations(self) -> list[StationOut]:
        """Fetch all stations."""
        return self._stations_cache

    def list_routes(self) -> list[RouteOut]:
        """Fetch all routes from the simulator timetable."""
        return [
            self._route_from_schedule("BL-UP", "Blue Line", "Vastral Gam", "Thaltej Gam", BL_UP_SCHED),
            self._route_from_schedule("BL-DOWN", "Blue Line", "Thaltej Gam", "Vastral Gam", BL_DOWN_SCHED),
            self._route_from_schedule("RL-UP", "Red Line", "APMC", "Motera Stadium", RL_UP_SCHED),
            self._route_from_schedule("RL-DOWN", "Red Line", "Motera Stadium", "APMC", RL_DOWN_SCHED),
        ]

    def list_trains(self, now: datetime = None) -> list[TrainCatalogueOut]:
        """Fetch all active trains with catalog format."""
        now = now or sim_clock.now()
        metro_trains = self.engine.all_trains(now)

        result = []
        for mt in metro_trains:
            if mt.get("status") == "NOT_IN_SERVICE":
                continue

            coaches = [
                CoachOut(
                    coach_number=c["id"],
                    coach_type="ladies" if c["type"] == "LADIES" else "standard",
                    capacity=c["capacity"],
                    description=c["name"]
                )
                for c in COACHES
            ]

            result.append(
                TrainCatalogueOut(
                    train_id=mt.get("train_id", ""),
                    train_name=mt.get("display_name") or self._train_name(mt),
                    line_name=self._line_name(mt),
                    direction=self._direction_label(mt.get("direction", "")),
                    current_station=mt.get("current_station", ""),
                    next_station=mt.get("next_station") or "",
                    arrival_time=self._time_to_iso(now, mt.get("arrived_at_station")),
                    departure_time=self._time_to_iso(now, mt.get("departs_station_at")),
                    current_occupancy=mt.get("train_current_passengers", 0),
                    platform_number=mt.get("platform_number"),
                    platform_name=mt.get("platform_name"),
                    coaches=coaches,
                )
            )

        return result

    def list_train_occupancy(self, now: datetime = None) -> list[TrainOccupancyOut]:
        """Fetch occupancy details for all trains."""
        now = now or sim_clock.now()
        metro_trains = self.engine.all_trains(now)

        result = []
        for mt in metro_trains:
            if mt.get("status") == "NOT_IN_SERVICE":
                continue

            coaches = []
            metro_coaches = mt.get("coaches", [])

            for i, coach_info in enumerate(metro_coaches):
                coaches.append(CoachOccupancyOut(
                    coach_number=coach_info.get("coach_id", f"C{i+1}"),
                    coach_type=self._coach_type(coach_info),
                    capacity=coach_info.get("capacity", 400),
                    current_passenger_count=coach_info.get("current_passengers", 0),
                    occupancy_percentage=int(round(coach_info.get("occupancy_pct", 0))),
                    occupancy_status=self._crowding_to_status(coach_info.get("crowd_level", "EMPTY")),
                ))

            result.append(
                TrainOccupancyOut(
                    train_id=mt.get("train_id", ""),
                    train_name=mt.get("display_name") or self._train_name(mt),
                    station_name=mt.get("current_station", ""),
                    line_name=self._line_name(mt),
                    direction=self._direction_label(mt.get("direction", "")),
                    platform_number=mt.get("platform_number"),
                    platform_name=mt.get("platform_name"),
                    current_station_crowd=self._station_crowd(mt.get("current_station", ""), metro_trains),
                    coaches=coaches,
                    updated_at=now,
                )
            )

        return result

    def get_train_occupancy(self, train_id: str, now: datetime = None) -> TrainOccupancyOut | None:
        """Fetch occupancy for a specific train."""
        now = now or sim_clock.now()
        metro_train = self.engine.query_by_train(train_id, now)

        if not metro_train or "error" in metro_train:
            return None

        coaches = []
        for coach_info in metro_train.get("coaches", []):
            coaches.append(CoachOccupancyOut(
                coach_number=coach_info.get("coach_id", ""),
                coach_type=self._coach_type(coach_info),
                capacity=coach_info.get("capacity", 400),
                current_passenger_count=coach_info.get("current_passengers", 0),
                occupancy_percentage=int(round(coach_info.get("occupancy_pct", 0))),
                occupancy_status=self._crowding_to_status(coach_info.get("crowd_level", "EMPTY")),
            ))

        return TrainOccupancyOut(
            train_id=metro_train.get("train_id", ""),
            train_name=metro_train.get("display_name") or self._train_name(metro_train),
            station_name=metro_train.get("current_station", ""),
            line_name=self._line_name(metro_train),
            direction=self._direction_label(metro_train.get("direction", "")),
            platform_number=metro_train.get("platform_number"),
            platform_name=metro_train.get("platform_name"),
            current_station_crowd=self._station_crowd(metro_train.get("current_station", ""), self.engine.all_trains(now)),
            coaches=coaches,
            updated_at=now
        )

    def list_station_crowds(self, now: datetime = None) -> list[StationCrowdOut]:
        """Fetch crowd predictions for all stations."""
        now = now or sim_clock.now()

        metro_trains = self.engine.all_trains(now)
        station_crowds = {station.name: 0 for station in self._stations_cache}

        for mt in metro_trains:
            if mt.get("status") == "NOT_IN_SERVICE":
                continue
            station = mt.get("current_station", "")
            if station:
                station_crowds[station] = station_crowds.get(station, 0) + mt.get("train_current_passengers", 0)

        result = []
        for station, current in station_crowds.items():
            result.append(StationCrowdOut(
                station_name=station,
                current_station_crowd=current,
                predicted_5_min=int(current * 1.1),
                predicted_15_min=int(current * 1.25),
                predicted_30_min=int(current * 1.4)
            ))

        return result

    def get_station_crowds(self, now: datetime = None) -> list[StationCrowdOut]:
        """Alias for list_station_crowds."""
        return self.list_station_crowds(now)

    def get_incoming_trains_at_station(self, station_name: str, now: datetime = None) -> list[IncomingTrainOut]:
        """Get trains arriving at a station in next 30 minutes."""
        now = now or sim_clock.now()
        station_query = self.engine.query_by_station(station_name, now)
        if station_query.get("trains_found", 0) == 0 and not self._station_exists(station_name):
            return []

        result = []
        for train in station_query.get("upcoming_trains", []):
            eta_min = train.get("arrives_in_min", 0)

            # Only include if arriving within 30 min
            if eta_min > 30:
                continue

            capacity = train.get("train_capacity", 1200)
            current_pax = train.get("train_current_passengers", 0)
            pred_count = min(capacity, int(current_pax * 1.1))
            pred_pct = int((pred_count / capacity) * 100) if capacity > 0 else 0

            result.append(IncomingTrainOut(
                train_id=train.get("train_id", ""),
                train_name=train.get("display_name") or self._train_name(train),
                line_name=self._line_name(train),
                eta_minutes=int(eta_min),
                route=self._route_label(train, station_name),
                current_occupancy=current_pax,
                platform_number=train.get("platform_number"),
                platform_name=train.get("platform_name"),
                predicted_occupancy_at_station=pred_pct,
                predicted_boarding_count=max(0, int(self._crowd_at_station(station_name, now) * 0.08)),
                predicted_deboarding_count=max(0, int(current_pax * 0.06)),
            ))

        return sorted(result, key=lambda x: x.eta_minutes)

    def get_trains_at_station(self, station_name: str, now: datetime = None) -> list[TrainAtStationOut]:
        """Get current and next-arriving trains for a station."""
        now = now or sim_clock.now()
        station_query = self.engine.query_by_station(station_name, now)
        if station_query.get("trains_found", 0) == 0 and not self._station_exists(station_name):
            return []

        trains = []
        for train in station_query.get("upcoming_trains", []):
            arr_sec = train.get("arrives_in_sec", 0)
            capacity = train.get("train_capacity", 1200)
            pax = train.get("train_current_passengers", 0)
            status_val = "At Station" if arr_sec == 0 else "Approaching" if arr_sec <= 60 else "En Route"
            trains.append(
                TrainAtStationOut(
                    train_id=train.get("train_id", ""),
                    train_name=train.get("display_name") or self._train_name(train),
                    line_name=self._line_name(train),
                    direction=self._direction_label(train.get("direction", "")),
                    arrival_time=self._time_to_iso(now, train.get("arrived_at_station")) if arr_sec == 0 else self._offset_to_iso(now, arr_sec),
                    departure_time=self._time_to_iso(now, train.get("departs_station_at")),
                    current_station=train.get("current_station", ""),
                    current_station_id=train.get("current_station_id"),
                    next_station=train.get("next_station") or "",
                    next_station_id=train.get("next_station_id"),
                    platform_number=train.get("platform_number"),
                    platform_name=train.get("platform_name"),
                    platform_level=train.get("platform_level"),
                    coaches=self._train_coaches(train.get("coaches", [])),
                    journey_completed_pct=train.get("journey_completed_pct"),
                    current_position=train.get("current_position"),
                    status=status_val,
                    eta_seconds=arr_sec,
                    origin_station_id=train.get("origin_station_id"),
                    destination_station_id=train.get("destination_station_id"),
                    predicted_boarding_count=0 if pax == 0 else max(15, int(pax * 0.12)),
                    predicted_deboarding_count=0 if pax == 0 else max(10, int(pax * 0.08)),
                    predicted_occupancy=0 if pax == 0 else min(100, int((min(capacity, int(pax + max(15, int(pax * 0.12)) - max(10, int(pax * 0.08)))) / max(capacity, 1)) * 100)),
                    estimated_departure_passengers=0 if pax == 0 else int(min(capacity, int(pax + max(15, int(pax * 0.12)) - max(10, int(pax * 0.08))))),
                    estimated_departure_occupancy=0 if pax == 0 else min(100, int((min(capacity, int(pax + max(15, int(pax * 0.12)) - max(10, int(pax * 0.08)))) / max(capacity, 1)) * 100)),
                )
            )
        return trains

    def get_all_trains_live(self, now: datetime = None) -> list[TrainAtStationOut]:
        """Get all trains across the network in live format."""
        now = now or sim_clock.now()
        trains = []
        for train in self.engine.all_trains(now):
            status = train.get("status", "")
            if status == "NOT_IN_SERVICE":
                continue
            eta_sec = max(0, train.get("eta_to_next_station_sec", 0))
            if train.get("status") in ("AT_STATION", "WAITING_AT_TERMINAL"):
                arr_time = self._time_to_hhmm(now, train.get("arrived_at_station"))
                status_val = "At Station"
            else:
                arr_time = self._offset_to_hhmm(now, eta_sec)
                status_val = "En Route" if eta_sec > 60 else "Approaching"
            
            if train.get("delay_minutes", 0) > 0:
                status_val = "Delayed"
            elif train.get("status") == "DEPARTING":
                status_val = "Departing"
                
            capacity = train.get("train_capacity", 1200)
            pax = train.get("train_current_passengers", 0)

            trains.append(
                TrainAtStationOut(
                    train_id=train.get("train_id", ""),
                    train_name=train.get("display_name") or self._train_name(train),
                    line_name=self._line_name(train),
                    direction=self._direction_label(train.get("direction", "")),
                    arrival_time=arr_time,
                    departure_time=self._time_to_hhmm(now, train.get("departs_station_at")),
                    current_station=train.get("current_station", ""),
                    current_station_id=train.get("current_station_id"),
                    next_station=train.get("next_station") or "",
                    next_station_id=train.get("next_station_id"),
                    platform_number=train.get("platform_number"),
                    platform_name=train.get("platform_name"),
                    platform_level=train.get("platform_level"),
                    status=status_val,
                    eta_seconds=eta_sec,
                    coaches=self._train_coaches(train.get("coaches", [])),
                    journey_completed_pct=train.get("journey_completed_pct"),
                    current_position=train.get("current_position"),
                    origin_station_id=train.get("origin_station_id"),
                    destination_station_id=train.get("destination_station_id"),
                    predicted_boarding_count=max(0, int(pax * 0.08)),
                    predicted_deboarding_count=max(0, int(pax * 0.06)),
                    predicted_occupancy=int((min(capacity, int(pax * 1.06)) / max(capacity, 1)) * 100),
                    estimated_departure_passengers=int(min(capacity, int(pax * 1.06))),
                    estimated_departure_occupancy=int((min(capacity, int(pax * 1.06)) / max(capacity, 1)) * 100),
                )
            )
        return trains

    def get_current_trains_at_station(self, station_name: str, now: datetime = None) -> list[TrainAtStationOut]:
        now = now or sim_clock.now()
        return [
            train
            for train in self.get_trains_at_station(station_name, now)
            if train.current_station.lower() == station_name.lower()
        ]

    def get_station_crowd_prediction(self, station_name: str, now: datetime = None) -> StationCrowdPredictionOut | None:
        now = now or sim_clock.now()
        needle = station_name.lower().strip()
        for crowd in self.list_station_crowds(now):
            if needle in crowd.station_name.lower():
                return StationCrowdPredictionOut(
                    current_station_crowd=crowd.current_station_crowd,
                    predicted_5_min=crowd.predicted_5_min,
                    predicted_15_min=crowd.predicted_15_min,
                    predicted_30_min=crowd.predicted_30_min,
                )
        return None

    def list_alerts(self, now: datetime = None, station_name: str | None = None) -> list[AlertOut]:
        now = now or sim_clock.now()
        alerts = []
        station_filter = station_name.lower() if station_name else None

        for crowd in self.list_station_crowds(now):
            if station_filter and crowd.station_name.lower() != station_filter:
                continue
            if crowd.current_station_crowd >= 600:
                alert_id = f"platform-{self._slug(crowd.station_name)}"
                alerts.append(AlertOut(
                    id=alert_id,
                    alert_type="platform_congestion",
                    severity="high" if crowd.current_station_crowd < 900 else "critical",
                    title="Platform Congestion",
                    message=f"{crowd.station_name} crowd is at {crowd.current_station_crowd} passengers.",
                    station_name=crowd.station_name,
                    train_id=None,
                    created_at=now,
                    acknowledged=alert_id in self.acknowledged_sim_alerts,
                    resolved=alert_id in self.resolved_sim_alerts,
                ))

        for train in self.engine.all_trains(now):
            if train.get("status") == "NOT_IN_SERVICE":
                continue
            if train.get("train_occupancy_pct", 0) >= 85:
                alert_id = f"train-{train.get('train_id', '').lower()}"
                alerts.append(AlertOut(
                    id=alert_id,
                    alert_type="prediction_alert",
                    severity="critical",
                    title="Train Capacity Critical",
                    message=f"Train occupancy is {train.get('train_occupancy_pct')}% (exceeds 85% capacity).",
                    station_name=train.get("current_station"),
                    train_id=train.get("train_id"),
                    created_at=now,
                    acknowledged=alert_id in self.acknowledged_sim_alerts,
                    resolved=alert_id in self.resolved_sim_alerts,
                ))
        return alerts

    def parse_sim_time(self, sim_time: str | None) -> datetime:
        if not sim_time:
            return sim_clock.now()
        try:
            parsed = datetime.strptime(sim_time, "%H:%M")
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="Invalid sim_time format. Use HH:MM, for example 09:15.") from exc
        today = sim_clock.now().date()
        return datetime(today.year, today.month, today.day, parsed.hour, parsed.minute)

    @staticmethod
    def _crowding_to_status(label: str) -> str:
        """Convert metro_engine crowd label to API status."""
        mapping = {
            "EMPTY": "empty",
            "MODERATE": "moderate",
            "CROWDED": "high",
            "VERY_CROWDED": "critical"
        }
        return mapping.get(label, "moderate")

    @staticmethod
    def _route_from_schedule(route_id: str, line_name: str, origin: str, destination: str, schedule: Iterable[dict]) -> RouteOut:
        stops = [
            RouteStopOut(
                station_name=segment["station"]["name"],
                stop_order=index + 1,
                arrival_offset_minutes=round(segment["arrive_offset"] / 60),
                departure_offset_minutes=round(segment["depart_offset"] / 60),
            )
            for index, segment in enumerate(schedule)
        ]
        return RouteOut(id=route_id, line_name=line_name, origin_station=origin, destination_station=destination, stops=stops)

    @staticmethod
    def _line_name(train: dict) -> str:
        return train.get("line") or train.get("line_name") or ""

    @staticmethod
    def _train_name(train: dict) -> str:
        return f"{DataService._line_name(train)} {train.get('direction', '')}".strip()

    @staticmethod
    def _direction_label(direction: str) -> str:
        return {"UP": "Up", "DOWN": "Down"}.get(direction.upper(), direction or "Unknown")

    @staticmethod
    def _coach_type(coach: dict) -> str:
        return "ladies" if coach.get("coach_type") == "LADIES" or coach.get("type") == "LADIES" else "standard"

    def _train_coaches(self, coaches: list[dict]) -> list[TrainCoachOut]:
        out = []
        for i, coach in enumerate(coaches):
            cid = coach.get("coach_id") or f"C{i+1}"
            pax = coach.get("current_passengers", 0)
            occ_pct = coach.get("occupancy_pct", 0)

            est_pax = 0 if pax == 0 else max(0, min(400, int(pax * 1.06)))
            est_pct = 0.0 if pax == 0 else round((est_pax / 400.0) * 100.0, 1)
                
            out.append(
                TrainCoachOut(
                    coach_number=cid,
                    coach_type=self._coach_type(coach),
                    capacity=coach.get("capacity", 400),
                    current_passenger_count=int(pax),
                    occupancy_percentage=int(round(occ_pct)),
                    occupancy_status=self._crowding_to_status(coach.get("crowd_level") or ("MODERATE" if occ_pct > 20 else "EMPTY")),
                    estimated_departure_passengers=est_pax,
                    estimated_departure_occupancy_pct=est_pct,
                )
            )
        return out

    @staticmethod
    def _time_to_iso(now: datetime, time_str: str | None) -> str:
        if not time_str:
            return now.isoformat()
        parts = [int(part) for part in str(time_str).strip().split(":")]
        hour = parts[0]
        minute = parts[1] if len(parts) > 1 else 0
        second = parts[2] if len(parts) > 2 else 0
        return datetime(now.year, now.month, now.day, hour, minute, second).isoformat()

    @staticmethod
    def _time_to_hhmm(now: datetime, hhmm: str | None) -> str:
        if not hhmm:
            return now.strftime("%H:%M")
        return str(hhmm).strip()

    @staticmethod
    def _offset_to_hhmm(now: datetime, seconds: int | float) -> str:
        from datetime import timedelta
        return (now + timedelta(seconds=float(seconds))).strftime("%H:%M")

    @staticmethod
    def _offset_to_iso(now: datetime, seconds: int | float) -> str:
        from datetime import timedelta
        return (now + timedelta(seconds=float(seconds))).isoformat()

    @staticmethod
    def _route_label(train: dict, station_name: str) -> str:
        return f"{train.get('terminal_start', '')} -> {station_name} -> {train.get('terminal_end', '')}"

    @staticmethod
    def _station_crowd(station_name: str, trains: list[dict]) -> int:
        return sum(
            train.get("train_current_passengers", 0)
            for train in trains
            if train.get("status") != "NOT_IN_SERVICE" and train.get("current_station", "").lower() == station_name.lower()
        )

    def _crowd_at_station(self, station_name: str, now: datetime) -> int:
        return self._station_crowd(station_name, self.engine.all_trains(now))

    def _station_exists(self, station_name: str) -> bool:
        needle = station_name.lower().strip()
        return any(needle in station.name.lower() for station in self._stations_cache)

    def search_journey(self, from_station: str, to_station: str, now: datetime = None) -> list[JourneySearchItemOut]:
        """
        Searches upcoming trains travelling from from_station to to_station.
        Calculates exact departure, arrival, duration, intermediate timeline, and live occupancy.
        """
        now = now or sim_clock.now()

        # Resolve station IDs / Names
        from_sid = self._resolve_station_id(from_station)
        to_sid = self._resolve_station_id(to_station)

        if not from_sid or not to_sid:
            return []

        if from_sid == to_sid:
            return []

        live_trains = {t["train_id"]: t for t in self.engine.all_trains(now) if t.get("status") != "NOT_IN_SERVICE"}

        results = []
        for train_cfg in self.engine._trains:
            for trip in train_cfg.get("trip_instances", []):
                sched = trip["schedule"]
                # Find indices of from_station and to_station in this trip schedule
                from_idx = next(
                    (i for i, seg in enumerate(sched)
                     if seg["station"]["id"] == from_sid or seg["station"]["name"].lower() == from_station.lower()),
                    None
                )
                to_idx = next(
                    (i for i, seg in enumerate(sched)
                     if seg["station"]["id"] == to_sid or seg["station"]["name"].lower() == to_station.lower()),
                    None
                )

                # Must contain both, and from must come strictly BEFORE to (direction check)
                if from_idx is None or to_idx is None or from_idx >= to_idx:
                    continue

                from_seg = sched[from_idx]
                to_seg = sched[to_idx]
                duration_min = max(1, round((to_seg["arrive_offset"] - from_seg["depart_offset"]) / 60))
                stops_count = to_idx - from_idx

                dep_sec = trip["dep_sec"]
                dep_dt = datetime(now.year, now.month, now.day) + timedelta(seconds=dep_sec)
                dep_from_dt = dep_dt + timedelta(seconds=from_seg["depart_offset"])
                arr_to_dt = dep_dt + timedelta(seconds=to_seg["arrive_offset"])

                eta_sec = int((dep_from_dt - now).total_seconds())
                # Include trains starting from 2 minutes before departure (dwelling) up to 24 hours ahead
                if eta_sec < -120:
                    continue

                eta_min = max(0, round(eta_sec / 60))

                # Check live state for this specific departure slot
                live_state = live_trains.get(train_cfg["train_id"])
                is_live = False
                is_at_platform = False
                if live_state and abs(eta_sec) <= 180:
                    is_live = True
                    if live_state.get("current_station_id") == from_sid and live_state.get("status") in ("AT_STATION", "WAITING_AT_TERMINAL"):
                        is_at_platform = True
                        eta_min = 0

                # Get coaches
                if live_state and live_state.get("coaches"):
                    coaches = self._train_coaches(live_state["coaches"])
                    total_pax = live_state.get("train_current_passengers", 0)
                else:
                    # Timetable occupancy estimation based on time-of-day
                    from app.services.metro_engine import occupancy_base_factor
                    base_factor = occupancy_base_factor(dep_from_dt, train_cfg["train_id"])
                    c1_pax = max(10, min(400, int(400 * base_factor * 0.9)))
                    c2_pax = max(5, min(400, int(400 * base_factor * 0.6)))
                    c3_pax = max(10, min(400, int(400 * base_factor * 0.85)))
                    total_pax = c1_pax + c2_pax + c3_pax
                    coaches = [
                        TrainCoachOut(coach_number="C1", coach_type="standard", capacity=400, current_passenger_count=c1_pax, occupancy_percentage=int(c1_pax / 4), occupancy_status=self._crowding_to_status("MODERATE" if c1_pax > 150 else "EMPTY")),
                        TrainCoachOut(coach_number="C2", coach_type="ladies", capacity=400, current_passenger_count=c2_pax, occupancy_percentage=int(c2_pax / 4), occupancy_status=self._crowding_to_status("MODERATE" if c2_pax > 150 else "EMPTY")),
                        TrainCoachOut(coach_number="C3", coach_type="standard", capacity=400, current_passenger_count=c3_pax, occupancy_percentage=int(c3_pax / 4), occupancy_status=self._crowding_to_status("MODERATE" if c3_pax > 150 else "EMPTY")),
                    ]

                pred_platform_crowd = self._crowd_at_station(from_seg["station"]["name"], dep_from_dt)

                # Build stops_timeline for the complete route
                stops_timeline = []
                elapsed_s = int((now - dep_dt).total_seconds()) if is_live else 0
                for s_idx, seg in enumerate(sched):
                    s_id = seg["station"]["id"]
                    s_name = seg["station"]["name"]
                    arr_time = (dep_dt + timedelta(seconds=seg["arrive_offset"])).strftime("%H:%M")
                    dep_time = (dep_dt + timedelta(seconds=seg["depart_offset"])).strftime("%H:%M")

                    is_passed = False
                    is_current = False
                    if is_live:
                        if seg["depart_offset"] < elapsed_s:
                            is_passed = True
                        elif seg["arrive_offset"] <= elapsed_s <= seg["depart_offset"]:
                            is_current = True
                        elif s_idx > 0 and sched[s_idx-1]["depart_offset"] <= elapsed_s < seg["arrive_offset"]:
                            if live_state and live_state.get("next_station_id") == s_id:
                                is_current = True

                    s_pred_crowd = self._crowd_at_station(s_name, dep_dt + timedelta(seconds=seg["arrive_offset"]))
                    stops_timeline.append(JourneyStopOut(
                        station_id=s_id,
                        station_name=s_name,
                        arrival_time=arr_time,
                        departure_time=dep_time,
                        is_passed=is_passed,
                        is_current=is_current,
                        is_user_origin=(s_id == from_sid),
                        is_user_destination=(s_id == to_sid),
                        predicted_station_crowd=s_pred_crowd,
                        estimated_train_occupancy=total_pax,
                    ))

                results.append(JourneySearchItemOut(
                    train_id=train_cfg["train_id"],
                    train_name=f"{train_cfg['line_name']} · {trip['destination']}",
                    line_name=train_cfg["line_name"],
                    line_code=train_cfg["line_code"],
                    direction=self._direction_label(trip["direction"]),
                    from_station_id=from_seg["station"]["id"],
                    from_station_name=from_seg["station"]["name"],
                    to_station_id=to_seg["station"]["id"],
                    to_station_name=to_seg["station"]["name"],
                    departure_time=dep_from_dt.strftime("%H:%M"),
                    arrival_time=arr_to_dt.strftime("%H:%M"),
                    eta_minutes=eta_min,
                    journey_duration_minutes=duration_min,
                    is_at_platform=is_at_platform,
                    is_live=is_live,
                    current_occupancy=total_pax,
                    predicted_station_crowd=pred_platform_crowd,
                    stops_count=stops_count,
                    coaches=coaches,
                    live_current_station_id=live_state.get("current_station_id") if live_state else None,
                    live_current_station_name=live_state.get("current_station") if live_state else None,
                    live_next_station_id=live_state.get("next_station_id") if live_state else None,
                    live_next_station_name=live_state.get("next_station") if live_state else None,
                    live_status=live_state.get("status", "SCHEDULED") if is_live else "SCHEDULED",
                    journey_progress_pct=live_state.get("journey_completed_pct", 0.0) if is_live else 0.0,
                    stops_timeline=stops_timeline,
                ))

        # If searching late at night and no more departures today, return tomorrow morning's schedule
        if not results:
            tomorrow = now + timedelta(days=1)
            for train_cfg in self.engine._trains:
                for trip in train_cfg.get("trip_instances", []):
                    sched = trip["schedule"]
                    from_idx = next((i for i, seg in enumerate(sched) if seg["station"]["id"] == from_sid or seg["station"]["name"].lower() == from_station.lower()), None)
                    to_idx = next((i for i, seg in enumerate(sched) if seg["station"]["id"] == to_sid or seg["station"]["name"].lower() == to_station.lower()), None)
                    if from_idx is None or to_idx is None or from_idx >= to_idx:
                        continue

                    from_seg = sched[from_idx]
                    to_seg = sched[to_idx]
                    duration_min = max(1, round((to_seg["arrive_offset"] - from_seg["depart_offset"]) / 60))
                    stops_count = to_idx - from_idx

                    dep_sec = trip["dep_sec"]
                    dep_dt = datetime(tomorrow.year, tomorrow.month, tomorrow.day) + timedelta(seconds=dep_sec)
                    dep_from_dt = dep_dt + timedelta(seconds=from_seg["depart_offset"])
                    arr_to_dt = dep_dt + timedelta(seconds=to_seg["arrive_offset"])
                    eta_sec = int((dep_from_dt - now).total_seconds())
                    eta_min = max(0, round(eta_sec / 60))

                    from app.services.metro_engine import occupancy_base_factor
                    base_factor = occupancy_base_factor(dep_from_dt, train_cfg["train_id"])
                    c1_pax = max(10, min(400, int(400 * base_factor * 0.9)))
                    c2_pax = max(5, min(400, int(400 * base_factor * 0.6)))
                    c3_pax = max(10, min(400, int(400 * base_factor * 0.85)))
                    total_pax = c1_pax + c2_pax + c3_pax

                    coaches = [
                        TrainCoachOut(coach_number="C1", coach_type="standard", capacity=400, current_passenger_count=c1_pax, occupancy_percentage=round((c1_pax/400)*100), occupancy_status="MODERATE" if c1_pax > 150 else "EMPTY"),
                        TrainCoachOut(coach_number="C2", coach_type="ladies", capacity=400, current_passenger_count=c2_pax, occupancy_percentage=round((c2_pax/400)*100), occupancy_status="MODERATE" if c2_pax > 150 else "EMPTY"),
                        TrainCoachOut(coach_number="C3", coach_type="standard", capacity=400, current_passenger_count=c3_pax, occupancy_percentage=round((c3_pax/400)*100), occupancy_status="MODERATE" if c3_pax > 150 else "EMPTY"),
                    ]

                    stops_timeline = []
                    for seg_i in range(from_idx, to_idx + 1):
                        seg = sched[seg_i]
                        s_id = seg["station"]["id"]
                        s_arr = dep_dt + timedelta(seconds=seg["arrive_offset"])
                        s_dep = dep_dt + timedelta(seconds=seg["depart_offset"])
                        stops_timeline.append(JourneyStopOut(
                            station_id=s_id,
                            station_name=seg["station"]["name"],
                            line_name=train_cfg["line_name"],
                            arrival_time=s_arr.strftime("%H:%M"),
                            departure_time=s_dep.strftime("%H:%M"),
                            is_passed=False,
                            is_current=False,
                            is_user_origin=(s_id == from_sid),
                            is_user_destination=(s_id == to_sid),
                            predicted_station_crowd=max(20, int(total_pax * 0.25)),
                            estimated_train_occupancy=total_pax,
                        ))

                    results.append(JourneySearchItemOut(
                        train_id=train_cfg["train_id"],
                        train_name=f"{train_cfg['line_name']} · {trip['destination']}",
                        line_name=train_cfg["line_name"],
                        line_code=train_cfg["line_code"],
                        direction=self._direction_label(trip["direction"]),
                        from_station_id=from_seg["station"]["id"],
                        from_station_name=from_seg["station"]["name"],
                        to_station_id=to_seg["station"]["id"],
                        to_station_name=to_seg["station"]["name"],
                        departure_time=dep_from_dt.strftime("%H:%M"),
                        arrival_time=arr_to_dt.strftime("%H:%M"),
                        eta_minutes=eta_min,
                        journey_duration_minutes=duration_min,
                        is_at_platform=False,
                        is_live=False,
                        current_occupancy=total_pax,
                        predicted_station_crowd=max(20, int(total_pax * 0.25)),
                        stops_count=stops_count,
                        coaches=coaches,
                        live_current_station_id=None,
                        live_current_station_name=None,
                        live_next_station_id=None,
                        live_next_station_name=None,
                        live_status="SCHEDULED",
                        journey_progress_pct=0.0,
                        stops_timeline=stops_timeline,
                    ))

        # Sort by: (1) At platform train first, (2) smallest ETA
        results.sort(key=lambda x: (0 if x.is_at_platform else 1, x.eta_minutes))
        return results

    def _resolve_station_id(self, needle: str) -> str | None:
        needle_clean = needle.strip().lower()
        # Check by station ID
        for st in self._stations_cache:
            if st.id.lower() == needle_clean:
                return st.id
        # Check by station name exact or substring
        for st in self._stations_cache:
            if st.name.lower() == needle_clean or needle_clean in st.name.lower():
                return st.id
        return None

    @staticmethod
    def _parse_sim_time(sim_time: str | None) -> datetime:
        now = sim_clock.now()
        if not sim_time:
            return now
        try:
            hour, minute = [int(p) for p in sim_time.split(":", 1)]
            return datetime(now.year, now.month, now.day, hour, minute)
        except Exception:
            return now

    def parse_sim_time(self, sim_time: str | None) -> datetime:
        return self._parse_sim_time(sim_time)

    def _station_exists(self, station_name: str) -> bool:
        needle = station_name.lower().strip()
        return any(needle in station.name.lower() or needle == station.id.lower() for station in self._stations_cache)

    def station_exists(self, station_name: str) -> bool:
        return self._station_exists(station_name)

    @staticmethod
    def _slug(value: str) -> str:
        return value.lower().replace(" ", "-").replace("/", "-")


# Singleton instance
data_service = DataService()
