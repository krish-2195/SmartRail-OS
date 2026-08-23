"""Occupancy service with repository pattern and simulation fallback."""

from datetime import datetime
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import Depends

from app.repositories.base import (
    OccupancyRepository,
    StationRepository,
    TrainRepository,
)
from app.schemas.occupancy import (
    TrainOccupancyOut,
    CoachOccupancyOut,
    StationCrowdOut,
)
from app.services.data_service import data_service


class OccupancyService:
    """Service for occupancy operations with fallback to simulation."""

    def __init__(
        self,
        db: AsyncSession,
        occupancy_repo: OccupancyRepository = Depends(),
        station_repo: StationRepository = Depends(),
        train_repo: TrainRepository = Depends(),
    ):
        self.db = db
        self.occupancy_repo = occupancy_repo
        self.station_repo = station_repo
        self.train_repo = train_repo
        self.sim_service = data_service  # fallback to simulation

    async def get_train_occupancy(
        self, train_id: str, sim_time: str | None = None
    ) -> Optional[TrainOccupancyOut]:
        """Get occupancy for a specific train."""
        now = self.sim_service.parse_sim_time(sim_time)
        # Try DB first
        occupancy_db = await self.occupancy_repo.get_latest_by_train(train_id, now)
        if occupancy_db:
            # Convert DB model to API schema
            train = await self.train_repo.get_by_train_id(train_id)
            station = await self.station_repo.get_by_id(
                occupancy_db.station_id
            ) if occupancy_db.station_id else None

            line_name = f"{'Blue Line' if train.line_id == 'BL' else 'Red Line'}" if train else ""
            direction = train.direction if train else ""
            
            # Simple coach mapping
            coaches_out = []
            if occupancy_db.coach_data:
                for c_data in occupancy_db.coach_data:
                    coaches_out.append(CoachOccupancyOut(
                        coach_number=c_data.get("coach_number") or c_data.get("coach_id"),
                        coach_type=c_data.get("coach_type", "standard").lower(),
                        capacity=c_data.get("capacity", 400),
                        current_passenger_count=c_data.get("current_passenger_count") or c_data.get("current_passengers", 0),
                        occupancy_percentage=int(round(float(c_data.get("occupancy_percentage") or c_data.get("occupancy_pct") or 0))),
                        occupancy_status=c_data.get("occupancy_status", "moderate"),
                    ))

            # Query the actual station crowd snapshot
            station_crowd = 0
            if station:
                from app.models.route import StationCrowdSnapshot
                res = await self.db.execute(
                    select(StationCrowdSnapshot)
                    .where(StationCrowdSnapshot.station_id == station.station_id)
                    .where(StationCrowdSnapshot.timestamp <= occupancy_db.timestamp)
                    .order_by(StationCrowdSnapshot.timestamp.desc())
                    .limit(1)
                )
                snap = res.scalar_one_or_none()
                if snap:
                    station_crowd = snap.current_crowd

            return TrainOccupancyOut(
                train_id=occupancy_db.train_id,
                train_name=train.train_name if train else "",
                station_name=station.name if station else "",
                line_name=line_name,
                direction=direction,
                current_station_crowd=station_crowd,
                coaches=coaches_out,
                updated_at=occupancy_db.timestamp,
            )
        # Fallback to simulation
        return self.sim_service.get_train_occupancy(train_id, now)

    async def get_all_train_occupancy(self, sim_time: str | None = None) -> List[TrainOccupancyOut]:
        """Get occupancy for all trains from DB with simulation fallback."""
        now = self.sim_service.parse_sim_time(sim_time)
        trains = await self.train_repo.get_all_active()
        
        results = []
        if trains:
            for t in trains:
                occ = await self.get_train_occupancy(t.train_id, sim_time)
                if occ:
                    results.append(occ)
        
        if not results:
            return self.sim_service.list_train_occupancy(now)
        return results

    async def get_station_crowds(self, sim_time: str | None = None) -> List[StationCrowdOut]:
        """Get crowd data for all stations from DB."""
        from app.models.route import StationCrowdSnapshot
        now = self.sim_service.parse_sim_time(sim_time)
        stations = await self.station_repo.get_all()
        if not stations:
            return self.sim_service.list_station_crowds(now)
        
        result = []
        for s in stations:
            res = await self.db.execute(
                select(StationCrowdSnapshot)
                .where(StationCrowdSnapshot.station_id == s.station_id)
                .where(StationCrowdSnapshot.timestamp <= now)
                .order_by(StationCrowdSnapshot.timestamp.desc())
                .limit(1)
            )
            snap = res.scalar_one_or_none()
            if snap:
                result.append(StationCrowdOut(
                    station_name=s.name,
                    current_station_crowd=snap.current_crowd,
                    predicted_5_min=snap.predicted_5_min,
                    predicted_15_min=snap.predicted_15_min,
                    predicted_30_min=snap.predicted_30_min
                ))
            else:
                sim_crowd = self.sim_service._crowd_at_station(s.name, now)
                result.append(StationCrowdOut(
                    station_name=s.name,
                    current_station_crowd=sim_crowd,
                    predicted_5_min=int(sim_crowd * 1.1),
                    predicted_15_min=int(sim_crowd * 1.25),
                    predicted_30_min=int(sim_crowd * 1.4)
                ))
        return result

    async def create_occupancy_snapshot(
        self,
        train_id: str,
        station_id: str,
        total_passengers: int,
        coach_data: Optional[dict] = None,
    ) -> TrainOccupancyOut:
        """Create a new occupancy snapshot from sensor/ingestion."""
        from app.models.train import OccupancySnapshot

        snapshot = OccupancySnapshot(
            train_id=train_id,
            station_id=station_id,
            total_passengers=total_passengers,
            coach_data=coach_data,
        )
        self.db.add(snapshot)
        await self.db.commit()
        await self.db.refresh(snapshot)

        # Return API schema
        train = await self.train_repo.get_by_train_id(train_id)
        station = await self.station_repo.get_by_id(station_id)

        line_name = f"{'Blue Line' if train.line_id == 'BL' else 'Red Line'}" if train else ""
        direction = train.direction if train else ""
        
        coaches_out = []
        if snapshot.coach_data:
            for c_data in snapshot.coach_data:
                coaches_out.append(CoachOccupancyOut(
                    coach_number=c_data.get("coach_number") or c_data.get("coach_id"),
                    coach_type=c_data.get("coach_type", "standard").lower(),
                    capacity=c_data.get("capacity", 400),
                    current_passenger_count=c_data.get("current_passenger_count") or c_data.get("current_passengers", 0),
                    occupancy_percentage=int(round(float(c_data.get("occupancy_percentage") or c_data.get("occupancy_pct") or 0))),
                    occupancy_status=c_data.get("occupancy_status", "moderate"),
                ))

        # Query the latest station crowd snapshot
        station_crowd = 0
        if station:
            from app.models.route import StationCrowdSnapshot
            res = await self.db.execute(
                select(StationCrowdSnapshot)
                .where(StationCrowdSnapshot.station_id == station.station_id)
                .where(StationCrowdSnapshot.timestamp <= snapshot.timestamp)
                .order_by(StationCrowdSnapshot.timestamp.desc())
                .limit(1)
            )
            snap = res.scalar_one_or_none()
            if snap:
                station_crowd = snap.current_crowd

        return TrainOccupancyOut(
            train_id=snapshot.train_id,
            train_name=train.train_name if train else "",
            station_name=station.name if station else "",
            line_name=line_name,
            direction=direction,
            current_station_crowd=station_crowd,
            coaches=coaches_out,
            updated_at=snapshot.timestamp,
        )


from app.db.session import get_db

async def get_occupancy_service(
    db: AsyncSession = Depends(get_db),
) -> OccupancyService:
    """Get occupancy service instance."""
    return OccupancyService(
        db=db,
        occupancy_repo=OccupancyRepository(db),
        station_repo=StationRepository(db),
        train_repo=TrainRepository(db),
    )
