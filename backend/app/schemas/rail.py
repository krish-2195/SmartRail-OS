from datetime import datetime

from pydantic import BaseModel, Field, model_validator


class StationOut(BaseModel):
    id: str
    name: str
    code: str
    line_name: str
    is_interchange: bool = False

class LineOut(BaseModel):
    id: str
    name: str
    color: str
    description: str | None = None

class RouteStopOut(BaseModel):
    station_name: str
    stop_order: int
    arrival_offset_minutes: int
    departure_offset_minutes: int

class RouteOut(BaseModel):
    id: str
    line_name: str
    origin_station: str
    destination_station: str
    stops: list[RouteStopOut]

class CoachOut(BaseModel):
    coach_number: str
    coach_type: str
    capacity: int
    description: str | None = None

class TrainCatalogueOut(BaseModel):
    train_id: str
    train_name: str
    line_name: str
    direction: str
    current_station: str
    next_station: str
    arrival_time: str
    departure_time: str
    current_occupancy: int
    coaches: list[CoachOut]
    platform_number: int | None = None
    platform_name: str | None = None
    journey_completed_pct: float | None = None
    current_position: float | None = None


class TrainCoachOut(BaseModel):
    coach_number: str
    coach_type: str
    capacity: int
    current_passenger_count: int
    occupancy_percentage: int
    occupancy_status: str
    estimated_departure_passengers: int | None = None
    estimated_departure_occupancy_pct: float | None = None


class TrainAtStationOut(BaseModel):
    train_id: str
    train_name: str
    line_name: str
    direction: str
    arrival_time: str
    departure_time: str
    current_station: str
    current_station_id: str | None = None
    next_station: str
    next_station_id: str | None = None
    platform_number: int | None = None
    platform_name: str | None = None
    platform_level: str | None = None
    coaches: list[TrainCoachOut]
    journey_completed_pct: float | None = None
    current_position: float | None = None
    status: str | None = None
    eta_seconds: int | None = None
    origin_station_id: str | None = None
    destination_station_id: str | None = None
    predicted_boarding_count: int | None = None
    predicted_deboarding_count: int | None = None
    predicted_occupancy: int | None = None
    estimated_departure_passengers: int | None = None
    estimated_departure_occupancy: int | None = None


class IncomingTrainOut(BaseModel):
    train_id: str
    train_name: str
    line_name: str
    eta_minutes: int
    route: str
    current_occupancy: int
    platform_number: int | None = None
    platform_name: str | None = None
    predicted_occupancy_at_station: int
    predicted_boarding_count: int
    predicted_deboarding_count: int


class StationCrowdPredictionOut(BaseModel):
    current_station_crowd: int
    predicted_5_min: int
    predicted_15_min: int
    predicted_30_min: int


class RecommendationOut(BaseModel):
    message: str
    coach_recommended: str | None = None


class AlertOut(BaseModel):
    id: str
    alert_type: str
    severity: str
    title: str
    message: str
    station_name: str | None = None
    train_id: str | None = None
    created_at: datetime
    acknowledged: bool = False
    resolved: bool = False


class ActionExecuteRequest(BaseModel):
    action_id: str
    action_type: str = "recommendation"
    payload: dict | None = None

class AnnouncementCreate(BaseModel):
    text: str
    context_info: str | None = None
    context: str | None = None

    @model_validator(mode="before")
    @classmethod
    def resolve_context(cls, values):
        if isinstance(values, dict):
            ctx = values.get("context_info") or values.get("context") or "System-Wide"
            values["context_info"] = ctx
            values["context"] = ctx
        return values

class AnnouncementOut(BaseModel):
    id: str
    text: str
    context: str
    is_active: bool
    created_at: datetime


class SavedRouteCreate(BaseModel):
    lineId: str
    fromStationId: str
    toStationId: str
    label: str


class SavedRouteOut(BaseModel):
    id: int
    lineId: str
    fromStationId: str
    toStationId: str
    label: str


class CoachStateOut(BaseModel):
    coach_id: str
    coach_type: str
    capacity: int
    current_passengers: int
    occupancy_pct: float


class StationCurrentStateResponse(BaseModel):
    train_id: str | None = None
    current_passenger_count: int | None = None
    arrival_time: str | None = None
    departure_time: str | None = None
    coaches: list[CoachStateOut] = []
    status: str = "none"  # "at_platform", "just_departed", "arriving", "none"
    eta_seconds: int | None = None


class CoachEstimationStateOut(BaseModel):
    coach_id: str
    coach_type: str
    capacity: int
    arrival_passengers: int
    arrival_occupancy_pct: float
    departure_passengers: int
    departure_occupancy_pct: float
    confidence_score: float | None = None
    risk_level: str | None = None


class StationFeatureStateResponse(BaseModel):
    train_id: str | None = None
    estimated_arrival_time: str | None = None
    estimated_departure_time: str | None = None
    estimated_passenger_incoming: int | None = None
    estimated_alighting: int | None = None
    estimated_boarding: int | None = None
    estimated_station_passenger_count: int | None = None
    coaches: list[CoachEstimationStateOut] = []


class KpiSnapshot(BaseModel):
    """A single point-in-time KPI reading."""
    active_trains: int
    passengers_in_transit: int
    avg_occupancy_pct: float
    total_station_crowd: int
    captured_at: datetime


class KpiHistoryOut(BaseModel):
    """Current vs 60-min-ago KPI for delta computation."""
    current: KpiSnapshot
    hour_ago: KpiSnapshot | None = None  # None if DB has < 60 min of data


class JourneyStopOut(BaseModel):
    station_id: str
    station_name: str
    arrival_time: str
    departure_time: str
    is_passed: bool = False
    is_current: bool = False
    is_user_origin: bool = False
    is_user_destination: bool = False
    predicted_station_crowd: int = 0
    estimated_train_occupancy: int = 0


class JourneySearchItemOut(BaseModel):
    train_id: str
    train_name: str
    line_name: str
    line_code: str
    direction: str
    from_station_id: str
    from_station_name: str
    to_station_id: str
    to_station_name: str
    departure_time: str               # HH:MM at origin station
    arrival_time: str                 # HH:MM at destination station
    eta_minutes: int                  # Minutes until departure from origin station
    journey_duration_minutes: int     # Travel time between origin and destination
    is_at_platform: bool = False      # Is train currently dwelling at origin station
    is_live: bool = False             # Is train actively on network
    current_occupancy: int = 0
    predicted_station_crowd: int = 0
    stops_count: int = 0
    coaches: list[TrainCoachOut] = []
    live_current_station_id: str | None = None
    live_current_station_name: str | None = None
    live_next_station_id: str | None = None
    live_next_station_name: str | None = None
    live_status: str = "SCHEDULED"    # AT_STATION | IN_TRANSIT | WAITING_AT_TERMINAL | SCHEDULED
    journey_progress_pct: float = 0.0
    stops_timeline: list[JourneyStopOut] = []
