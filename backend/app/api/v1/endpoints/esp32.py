"""
ESP32 live sensor ingestion & telemetry endpoints.

Receives real-time passenger crossing telemetry (IN/OUT pulses),
sync packets, and distance metrics from:
  1. Standalone ESP32 running Wi-Fi HTTPClient firmware
  2. Python USB serial bridge
  3. Interactive Dashboard Hardware Simulator

Broadcasts instantaneous WebSocket events to web and mobile clients
and maintains real-time in-memory state.
"""

from datetime import datetime
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, status
from pydantic import BaseModel, Field

from app.core.esp32_state import esp32
from app.core.websockets import manager

router = APIRouter()


# ─── Request & Response Schemas ───────────────────────────────────────────────

class Esp32TelemetryPayload(BaseModel):
    direction: Optional[str] = Field(
        None,
        description="Direction of crossing: 'IN' (boarding), 'OUT' (alighting), or 'SYNC'",
    )
    in_delta: int = Field(0, ge=0, description="Number of boarding passengers in this event")
    out_delta: int = Field(0, ge=0, description="Number of alighting passengers in this event")
    occupancy: Optional[int] = Field(
        None,
        ge=0,
        description="Current occupancy override (if calculated on ESP32)",
    )
    total_in: Optional[int] = Field(
        None,
        ge=0,
        description="Cumulative boarded passengers count from device",
    )
    total_out: Optional[int] = Field(
        None,
        ge=0,
        description="Cumulative alighted passengers count from device",
    )
    station_id: Optional[str] = Field(
        None,
        description="Station ID to attach to (e.g. 'BL08'). Omit/null for all stations.",
    )
    coach_id: Optional[str] = Field("C1", description="Coach identifier, default 'C1'")
    coach_capacity: Optional[int] = Field(None, gt=0, description="Coach capacity limit")
    device_id: Optional[str] = Field(None, description="ESP32 hardware device identifier")
    distance_s1: Optional[float] = Field(None, description="Ultrasonic Sensor 1 distance in cm")
    distance_s2: Optional[float] = Field(None, description="Ultrasonic Sensor 2 distance in cm")
    rssi: Optional[int] = Field(None, description="Wi-Fi signal strength in dBm")


class Esp32LiveResponse(BaseModel):
    status: str
    device_id: str
    coach_id: str
    occupancy: int
    occupancy_pct: float
    total_in: int
    total_out: int
    in_rate_per_min: int
    out_rate_per_min: int
    coach_capacity: int
    station_id: Optional[str] = None
    target_station_id: Optional[str] = None
    last_direction: Optional[str] = None
    sensor_s1_distance: float = 999.0
    sensor_s2_distance: float = 999.0
    rssi: Optional[int] = None
    last_updated: datetime
    is_active: bool


class Esp32ConfigPayload(BaseModel):
    target_station_id: Optional[str] = None
    coach_capacity: Optional[int] = Field(None, gt=0)
    coach_id: Optional[str] = None
    device_id: Optional[str] = None


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.post("", response_model=Esp32LiveResponse)
@router.post("/", response_model=Esp32LiveResponse)
@router.post("/telemetry", response_model=Esp32LiveResponse)
@router.post("/esp32", response_model=Esp32LiveResponse)
async def ingest_esp32_telemetry(payload: Esp32TelemetryPayload):
    """
    Ingest live directional passenger crossing event or sync telemetry.
    Instantly updates state and broadcasts to WebSockets.
    """
    if payload.coach_capacity:
        esp32.coach_capacity = payload.coach_capacity

    direction = payload.direction or ("IN" if payload.in_delta > 0 else "OUT" if payload.out_delta > 0 else "SYNC")

    esp32.record_event(
        direction=direction,
        in_delta=payload.in_delta,
        out_delta=payload.out_delta,
        current_occupancy=payload.occupancy,
        total_in_override=payload.total_in,
        total_out_override=payload.total_out,
        station_id=payload.station_id,
        coach_id=payload.coach_id,
        device_id=payload.device_id,
        distance_s1=payload.distance_s1,
        distance_s2=payload.distance_s2,
        rssi=payload.rssi,
    )

    in_rate, out_rate = esp32.compute_flow_rates()

    # Instant WebSocket Broadcast (< 5ms latency to all connected browsers and mobile apps)
    ws_event = {
        "event_type": "esp32_passenger_event",
        "data": {
            "direction": direction,
            "in_delta": payload.in_delta,
            "out_delta": payload.out_delta,
            "occupancy": esp32.occupancy,
            "occupancy_pct": esp32.occupancy_pct,
            "total_in": esp32.total_in,
            "total_out": esp32.total_out,
            "in_rate_per_min": in_rate,
            "out_rate_per_min": out_rate,
            "station_id": esp32.target_station_id,
            "coach_id": esp32.coach_id,
            "device_id": esp32.device_id,
            "distance_s1": esp32.sensor_s1_distance,
            "distance_s2": esp32.sensor_s2_distance,
            "rssi": esp32.rssi,
            "timestamp": esp32.last_updated.isoformat(),
        }
    }
    await manager.broadcast(ws_event)

    # Also broadcast standard occupancy_update for live train views
    await manager.broadcast({
        "event_type": "occupancy_update",
        "data": {
            "train_id": "ESP32_DEMO",
            "station_id": esp32.target_station_id,
            "total_passengers": esp32.occupancy,
            "timestamp": esp32.last_updated.isoformat(),
        }
    })

    return Esp32LiveResponse(
        status="accepted",
        device_id=esp32.device_id,
        coach_id=esp32.coach_id,
        occupancy=esp32.occupancy,
        occupancy_pct=esp32.occupancy_pct,
        total_in=esp32.total_in,
        total_out=esp32.total_out,
        in_rate_per_min=in_rate,
        out_rate_per_min=out_rate,
        coach_capacity=esp32.coach_capacity,
        station_id=esp32.target_station_id,
        target_station_id=esp32.target_station_id,
        last_direction=esp32.last_direction,
        sensor_s1_distance=esp32.sensor_s1_distance,
        sensor_s2_distance=esp32.sensor_s2_distance,
        rssi=esp32.rssi,
        last_updated=esp32.last_updated,
        is_active=esp32.is_active,
    )


@router.get("", response_model=Esp32LiveResponse)
@router.get("/", response_model=Esp32LiveResponse)
@router.get("/live", response_model=Esp32LiveResponse)
@router.get("/status", response_model=Esp32LiveResponse)
async def get_esp32_live():
    """Returns the comprehensive real-time ESP32 sensor state and metrics."""
    in_rate, out_rate = esp32.compute_flow_rates()
    return Esp32LiveResponse(
        status="active" if esp32.is_active else "no_data",
        device_id=esp32.device_id,
        coach_id=esp32.coach_id,
        occupancy=esp32.occupancy,
        occupancy_pct=esp32.occupancy_pct,
        total_in=esp32.total_in,
        total_out=esp32.total_out,
        in_rate_per_min=in_rate,
        out_rate_per_min=out_rate,
        coach_capacity=esp32.coach_capacity,
        station_id=esp32.target_station_id,
        target_station_id=esp32.target_station_id,
        last_direction=esp32.last_direction,
        sensor_s1_distance=esp32.sensor_s1_distance,
        sensor_s2_distance=esp32.sensor_s2_distance,
        rssi=esp32.rssi,
        last_updated=esp32.last_updated,
        is_active=esp32.is_active,
    )


@router.get("/events", response_model=List[Dict[str, Any]])
async def get_esp32_events():
    """Returns the rolling log of recent passenger crossing events (last 100)."""
    return list(reversed(esp32.recent_events))


@router.post("/reset", response_model=Esp32LiveResponse)
async def reset_esp32_counters():
    """Resets occupancy, total_in, total_out, and event history."""
    esp32.reset()
    await manager.broadcast({
        "event_type": "esp32_passenger_event",
        "data": {
            "direction": "RESET",
            "in_delta": 0,
            "out_delta": 0,
            "occupancy": 0,
            "occupancy_pct": 0.0,
            "total_in": 0,
            "total_out": 0,
            "in_rate_per_min": 0,
            "out_rate_per_min": 0,
            "station_id": esp32.target_station_id,
            "coach_id": esp32.coach_id,
            "device_id": esp32.device_id,
            "timestamp": esp32.last_updated.isoformat(),
        }
    })
    return await get_esp32_live()


@router.post("/config", response_model=Esp32LiveResponse)
async def update_esp32_config(payload: Esp32ConfigPayload):
    """Updates device configuration (target station, coach capacity, etc.)."""
    if payload.target_station_id is not None:
        from app.core.station_mapping import translate_station_id
        esp32.target_station_id = translate_station_id(payload.target_station_id) if payload.target_station_id else None
    if payload.coach_capacity is not None:
        esp32.coach_capacity = payload.coach_capacity
    if payload.coach_id is not None:
        esp32.coach_id = payload.coach_id
    if payload.device_id is not None:
        esp32.device_id = payload.device_id

    return await get_esp32_live()


@router.get("/per-station", response_model=Dict[str, int])
async def get_esp32_per_station():
    """Returns the map of per-station occupancies."""
    return esp32.per_station_occupancy



