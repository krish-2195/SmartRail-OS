from fastapi import APIRouter, HTTPException, Query, Depends

from app.schemas.rail import TrainAtStationOut, JourneySearchItemOut
from app.services.domain.train_service import TrainService, get_train_service
from app.services.data_service import data_service

router = APIRouter()

@router.get("/search", response_model=list[JourneySearchItemOut])
async def search_trains_between_stations(
    from_station: str = Query(..., description="Boarding station ID or Name (e.g. BL01 or Vastral Gam)"),
    to_station: str = Query(..., description="Destination station ID or Name (e.g. BL18 or Thaltej Gam)"),
    sim_time: str | None = Query(None, description="Simulate time as HH:MM", pattern=r"^(?:[01]\d|2[0-3]):[0-5]\d$"),
) -> list[JourneySearchItemOut]:
    """
    Search for upcoming trains from origin to destination station.
    Calculates departure time at from_station and arrival time at to_station.
    """
    now = data_service.parse_sim_time(sim_time)
    results = data_service.search_journey(from_station, to_station, now)
    return results

@router.get("/at-station", response_model=list[TrainAtStationOut])
async def list_trains_at_station(
    station_name: str | None = Query(None, description="Optional station filter. Omit to get all active trains."),
    sim_time: str | None = Query(None, description="Simulate time as HH:MM", pattern=r"^(?:[01]\d|2[0-3]):[0-5]\d$"),
    train_service: TrainService = Depends(get_train_service)
) -> list[TrainAtStationOut]:
    
    trains = await train_service.get_trains_at_station(station_name, sim_time)
    if not trains and station_name is not None and not data_service.station_exists(station_name):
        raise HTTPException(status_code=404, detail=f"Station '{station_name}' not found.")
    return trains
