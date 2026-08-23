import logging
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.session import get_db
from app.schemas.ingestion import SensorEvent
from app.models.train import Train
from app.services.domain.occupancy_service import OccupancyService, get_occupancy_service

logger = logging.getLogger(__name__)

class IngestionService:
    def __init__(self, db: AsyncSession, occupancy_service: OccupancyService, alert_engine: 'AlertEngine'):
        self.db = db
        self.occupancy_service = occupancy_service
        self.alert_engine = alert_engine

    async def process_event(
        self,
        event: SensorEvent,
        next_station_id: str | None = None,
        journey_completed_pct: float | None = None,
        current_position: float | None = None,
    ) -> bool:
        """
        Processes an incoming sensor event and persists it to the database.
        """
        logger.info(f"Ingested event: {event.event_type} for train {event.train_id} at {event.timestamp}")
        
        try:
            # Update the Train's current station
            result = await self.db.execute(select(Train).where(Train.train_id == event.train_id))
            train = result.scalar_one_or_none()
            
            # Calculate total passengers from coaches
            total_passengers = sum(c.passenger_count for c in event.coaches)
            
            # Format coach data for JSON storage
            coach_data = [
                {
                    "coach_number":           c.coach_id,
                    "coach_type":             c.coach_type,          # GENERAL or LADIES
                    "capacity":               400,
                    "current_passenger_count": c.passenger_count,
                    "occupancy_percentage":   c.occupancy_percentage,
                    "occupancy_status": (
                        "very_crowded" if c.occupancy_percentage >= 85 else
                        "crowded"      if c.occupancy_percentage >= 60 else
                        "moderate"     if c.occupancy_percentage >= 35 else
                        "empty"
                    ),
                }
                for c in event.coaches
            ]

            if train:
                train.current_station_id = event.station_id
                if next_station_id is not None:
                    train.next_station_id = next_station_id
                if journey_completed_pct is not None:
                    train.journey_completed_pct = journey_completed_pct
                if current_position is not None:
                    train.current_position = current_position

                # ── Write live coach counts directly onto the Train row ──────
                coaches_list = event.coaches
                if len(coaches_list) >= 1:
                    train.c1_passengers    = coaches_list[0].passenger_count
                    train.c1_occupancy_pct = coaches_list[0].occupancy_percentage
                if len(coaches_list) >= 2:
                    train.c2_passengers    = coaches_list[1].passenger_count
                    train.c2_occupancy_pct = coaches_list[1].occupancy_percentage
                if len(coaches_list) >= 3:
                    train.c3_passengers    = coaches_list[2].passenger_count
                    train.c3_occupancy_pct = coaches_list[2].occupancy_percentage
                self.db.add(train)

            # Persist the Occupancy Snapshot
            station_id_val = event.station_id or (train.current_station_id if train else None)
            await self.occupancy_service.create_occupancy_snapshot(
                train_id=event.train_id,
                station_id=station_id_val,
                total_passengers=total_passengers,
                coach_data=coach_data
            )
            
            await self.db.commit()
            
            # Broadcast the live event to any connected WebSocket clients
            from app.core.websockets import manager
            await manager.broadcast({
                "event_type": "occupancy_update",
                "data": {
                    "train_id": event.train_id,
                    "station_id": station_id_val,
                    "total_passengers": total_passengers,
                    "timestamp": event.timestamp.isoformat() if hasattr(event.timestamp, "isoformat") else str(event.timestamp)
                }
            })
            
            # Evaluate rules via Alert Engine
            await self.alert_engine.evaluate_occupancy_snapshot(event, total_passengers)
                
            return True
        except Exception as e:
            logger.error(f"Error processing ingestion event: {e}")
            await self.db.rollback()
            return False

from app.services.engine.alert_engine import AlertEngine, get_alert_engine

async def get_ingestion_service(
    db: AsyncSession = Depends(get_db),
    occupancy_service: OccupancyService = Depends(get_occupancy_service),
    alert_engine: AlertEngine = Depends(get_alert_engine)
) -> IngestionService:
    return IngestionService(db, occupancy_service, alert_engine)
