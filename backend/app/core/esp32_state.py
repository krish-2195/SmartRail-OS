"""
Global in-process store for ESP32 live sensor state.

The serial bridge or direct ESP32 Wi-Fi POSTs updates here via:
    POST /api/v1/esp32/telemetry (or /api/v1/ingestion/esp32)

Every simulation tick reads from this store and injects the ESP32 dummy
train row into station tables so the mobile app can see live sensor data.
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any


@dataclass
class Esp32State:
    """Single shared object holding the latest ESP32 sensor reading and directional telemetry."""

    # Device & Location identification
    device_id: str = "ESP32_COACH_01"
    coach_id: str = "C1"
    target_station_id: Optional[str] = None

    # Current occupancy count
    occupancy: int = 0

    # Cumulative directional counters
    total_in: int = 0
    total_out: int = 0

    # Coach capacity for occupancy % calculation
    coach_capacity: int = 400

    # Last detected direction: "IN", "OUT", "SYNC", or None
    last_direction: Optional[str] = None

    # Live ultrasonic distances (in cm)
    sensor_s1_distance: float = 999.0
    sensor_s2_distance: float = 999.0
    rssi: Optional[int] = None

    # Last update timestamp
    last_updated: datetime = field(default_factory=datetime.now)

    # Whether we have received at least one reading
    is_active: bool = False

    # Per-station occupancy overrides
    per_station_occupancy: Dict[str, int] = field(default_factory=dict)

    # Rolling window of recent events (max 100)
    recent_events: List[Dict[str, Any]] = field(default_factory=list)

    @property
    def occupancy_pct(self) -> float:
        if self.coach_capacity <= 0:
            return 0.0
        return round(min(100.0, (self.occupancy / self.coach_capacity) * 100), 1)

    def get_station_occupancy(self, station_id: str) -> int:
        if self.target_station_id is not None:
            return self.per_station_occupancy.get(station_id, 0)
        return self.occupancy

    def get_station_occupancy_pct(self, station_id: str) -> float:
        occ = self.get_station_occupancy(station_id)
        if self.coach_capacity <= 0:
            return 0.0
        return round(min(100.0, (occ / self.coach_capacity) * 100), 1)

    def compute_flow_rates(self) -> tuple[int, int]:
        """Compute rolling boarding (IN) and alighting (OUT) rate per minute over the last 60 seconds."""
        cutoff = datetime.now() - timedelta(seconds=60)
        recent = [e for e in self.recent_events if e.get("timestamp_dt", datetime.min) >= cutoff]
        in_count = sum(e.get("in_delta", 0) for e in recent)
        out_count = sum(e.get("out_delta", 0) for e in recent)
        return in_count, out_count

    def record_event(
        self,
        direction: str,
        in_delta: int = 0,
        out_delta: int = 0,
        current_occupancy: Optional[int] = None,
        total_in_override: Optional[int] = None,
        total_out_override: Optional[int] = None,
        station_id: Optional[str] = None,
        coach_id: Optional[str] = None,
        device_id: Optional[str] = None,
        distance_s1: Optional[float] = None,
        distance_s2: Optional[float] = None,
        rssi: Optional[int] = None,
    ):
        """Record an incoming directional pulse or sync telemetry packet."""
        now = datetime.now()
        self.last_updated = now
        self.is_active = True
        self.last_direction = direction

        if device_id:
            self.device_id = device_id
        if coach_id:
            self.coach_id = coach_id
        if station_id is not None:
            from app.core.station_mapping import translate_station_id
            self.target_station_id = translate_station_id(station_id) if station_id else None
        if distance_s1 is not None:
            self.sensor_s1_distance = distance_s1
        if distance_s2 is not None:
            self.sensor_s2_distance = distance_s2
        if rssi is not None:
            self.rssi = rssi

        # Apply counter updates
        if total_in_override is not None:
            self.total_in = total_in_override
        else:
            self.total_in += max(0, in_delta)

        if total_out_override is not None:
            self.total_out = total_out_override
        else:
            self.total_out += max(0, out_delta)

        if current_occupancy is not None:
            self.occupancy = max(0, current_occupancy)
        else:
            self.occupancy = max(0, self.occupancy + in_delta - out_delta)

        if self.target_station_id:
            self.per_station_occupancy[self.target_station_id] = self.occupancy
        else:
            self.per_station_occupancy.clear()

        # Append to rolling event history
        event_record = {
            "id": len(self.recent_events) + 1,
            "direction": direction,
            "in_delta": in_delta,
            "out_delta": out_delta,
            "occupancy": self.occupancy,
            "occupancy_pct": self.occupancy_pct,
            "total_in": self.total_in,
            "total_out": self.total_out,
            "station_id": self.target_station_id,
            "coach_id": self.coach_id,
            "device_id": self.device_id,
            "distance_s1": self.sensor_s1_distance,
            "distance_s2": self.sensor_s2_distance,
            "timestamp": now.isoformat(),
            "timestamp_dt": now,
        }
        self.recent_events.append(event_record)
        if len(self.recent_events) > 100:
            self.recent_events.pop(0)

    def reset(self):
        """Reset all counters to zero."""
        self.occupancy = 0
        self.total_in = 0
        self.total_out = 0
        self.last_direction = None
        self.per_station_occupancy.clear()
        self.recent_events.clear()
        self.last_updated = datetime.now()


# Module-level singleton — imported everywhere
esp32 = Esp32State()


