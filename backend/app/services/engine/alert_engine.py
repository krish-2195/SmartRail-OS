import logging
import uuid
from datetime import datetime
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.repositories.base import AlertRepository
from app.models.alert import Alert, AlertType, SeverityLevel
from app.schemas.ingestion import SensorEvent
from app.core.websockets import manager

logger = logging.getLogger(__name__)

class AlertEngine:
    def __init__(self, db: AsyncSession, alert_repo: AlertRepository):
        self.db = db
        self.alert_repo = alert_repo

    async def _has_active_alert(self, station_id: str, alert_type: AlertType) -> bool:
        active_alerts = await self.alert_repo.get_active_alerts(limit=100)
        for alert in active_alerts:
            if alert.station_id == station_id and alert.alert_type == alert_type:
                return True
        return False

    async def _has_active_alert_for_train(self, train_id: str, alert_type: AlertType) -> bool:
        """Check if an unresolved alert of this type was created for this train in the last 2 hours."""
        from datetime import timedelta
        from sqlalchemy import select
        cutoff = datetime.now() - timedelta(hours=2)
        try:
            result = await self.db.execute(
                select(Alert).where(
                    Alert.train_id == train_id,
                    Alert.alert_type == alert_type,
                    Alert.resolved_at == None,
                    Alert.created_at >= cutoff
                ).limit(1)
            )
            return result.scalar_one_or_none() is not None
        except Exception:
            return False

    async def evaluate_occupancy_snapshot(self, event: SensorEvent, total_passengers: int):
        """Evaluate real-time ingestion data against operational rules."""
        
        # 1. Train Capacity Alert (Overcrowding Rule)
        # 85% of train capacity (1200) = 1020 passengers
        if total_passengers >= 1020:
            if not await self._has_active_alert_for_train(event.train_id, AlertType.PREDICTION_ALERT):
                alert_id = f"alt-{uuid.uuid4().hex[:8]}"
                occupancy_pct = (total_passengers / 1200) * 100
                alert = Alert(
                    id=alert_id,
                    alert_type=AlertType.PREDICTION_ALERT,
                    severity=SeverityLevel.CRITICAL,
                    title="Train Capacity Critical",
                    message=f"Train {event.train_id} has exceeded critical occupancy at {total_passengers} passengers ({occupancy_pct:.1f}%).",
                    station_id=event.station_id,
                    train_id=event.train_id,
                    created_at=datetime.now()
                )
                await self.alert_repo.create(alert)
                await self.db.commit()
                logger.info(f"Generated alert: {alert_id} for Train Overcrowding")
                
                # Broadcast over WebSocket
                await manager.broadcast({
                    "event_type": "alert_issued",
                    "data": {
                        "id": alert.id,
                        "alert_type": alert.alert_type.value,
                        "severity": alert.severity.value,
                        "title": alert.title,
                        "message": alert.message,
                        "station_name": alert.station_id,
                        "train_id": alert.train_id,
                        "created_at": alert.created_at.isoformat()
                    }
                })

        # 2. Train Delay Rule
        if event.delay_minutes and event.delay_minutes > 5:
            if not await self._has_active_alert_for_train(event.train_id, AlertType.TRAIN_DELAY):
                alert_id = f"alt-{uuid.uuid4().hex[:8]}"
                alert = Alert(
                    id=alert_id,
                    alert_type=AlertType.TRAIN_DELAY,
                    severity=SeverityLevel.MEDIUM,
                    title="Train Delayed",
                    message=f"Train delayed by {event.delay_minutes} minutes.",
                    station_id=event.station_id,
                    train_id=event.train_id,
                    created_at=datetime.now()
                )
                await self.alert_repo.create(alert)
                await self.db.commit()
                logger.info(f"Generated alert: {alert_id} for Train Delay")
                
                await manager.broadcast({
                    "event_type": "alert_issued",
                    "data": {
                        "id": alert.id,
                        "alert_type": alert.alert_type.value,
                        "severity": alert.severity.value,
                        "title": alert.title,
                        "message": alert.message,
                        "station_name": alert.station_id,
                        "train_id": alert.train_id,
                        "created_at": alert.created_at.isoformat()
                    }
                })

async def get_alert_engine(db: AsyncSession = Depends(get_db)) -> AlertEngine:
    return AlertEngine(db, AlertRepository(db))
