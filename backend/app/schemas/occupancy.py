from datetime import datetime
from pydantic import BaseModel


class CoachOccupancyOut(BaseModel):
    coach_number: str
    coach_type: str
    capacity: int
    current_passenger_count: int
    occupancy_percentage: int
    occupancy_status: str


class TrainOccupancyOut(BaseModel):
    train_id: str
    train_name: str
    station_name: str
    line_name: str
    direction: str
    platform_number: int | None = None
    platform_name: str | None = None
    current_station_crowd: int
    coaches: list[CoachOccupancyOut]
    updated_at: datetime


class StationCrowdOut(BaseModel):
    station_name: str
    current_station_crowd: int
    predicted_5_min: int
    predicted_15_min: int
    predicted_30_min: int
