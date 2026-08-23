from typing import List
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from fastapi import Depends

from app.db.session import get_db
from app.repositories.base import AlertRepository
from app.schemas.rail import AlertOut
from app.models.alert import Alert, AlertType, SeverityLevel
from app.models.station import Station
from app.core.sim_clock import sim_clock
from app.services.data_service import data_service

class AlertService:
    def __init__(self, db: AsyncSession, alert_repo: AlertRepository | None = None):
        self.db = db
        self.alert_repo = alert_repo or AlertRepository(db)
        self.sim_service = data_service

    async def list_alerts(self, station_name: str | None = None) -> List[AlertOut]:
        """Fetch active and historical alerts, resolving station names and prioritizing genuine emergencies."""
        db_alerts = await self.alert_repo.get_active_alerts(limit=100)
        
        st_res = await self.db.execute(select(Station))
        stations_map = {s.station_id: s.name for s in st_res.scalars().all()}

        now = sim_clock.now()
        # Off-peak hours where crowd surge emergencies cannot physically occur (06:00-07:30, 21:30-23:00, or overnight)
        is_off_peak = (now.hour < 7 or (now.hour == 7 and now.minute < 30) or now.hour >= 22 or (now.hour == 21 and now.minute >= 30))

        results = []
        for alert in db_alerts:
            st_name = None
            if alert.station_id:
                st_name = stations_map.get(alert.station_id, alert.station_id)
            
            if station_name:
                if alert.station_id != station_name and st_name != station_name:
                    continue

            is_ack = False
            if alert.payload and isinstance(alert.payload, dict):
                is_ack = bool(alert.payload.get("acknowledged", False))

            # Auto-resolve stale / off-peak dummy alerts
            type_val = (getattr(alert.alert_type, "value", str(alert.alert_type)) or "").lower()
            is_stale = alert.created_at and (now - alert.created_at).total_seconds() > 900
            is_offpeak_crowd = is_off_peak and type_val in ("platform_congestion", "prediction_alert", "train_delay")
            is_res = alert.resolved_at is not None or is_stale or is_offpeak_crowd

            results.append(
                AlertOut(
                    id=alert.id,
                    alert_type=alert.alert_type.value if hasattr(alert.alert_type, "value") else str(alert.alert_type),
                    severity=alert.severity.value if hasattr(alert.severity, "value") else str(alert.severity),
                    title=alert.title,
                    message=alert.message,
                    station_name=st_name,
                    station_id=alert.station_id,
                    train_id=alert.train_id,
                    created_at=alert.created_at,
                    acknowledged=is_ack,
                    resolved=is_res,
                )
            )
            
        sim_alerts = self.sim_service.list_alerts(station_name=station_name)
        for sa in sim_alerts:
            if not any(r.id == sa.id or (r.train_id and r.train_id == sa.train_id) for r in results):
                results.append(sa)

        severity_rank = {
            "critical": 0,
            "emergency": 0,
            "high": 1,
            "platform_congestion": 1,
            "medium": 2,
            "warning": 2,
            "low": 3,
        }

        results.sort(key=lambda a: (
            1 if a.resolved else 0,
            severity_rank.get(a.severity.lower(), 99),
            -a.created_at.timestamp() if a.created_at else 0
        ))

        return results

    async def get_emergency_status(self) -> bool:
        """Check if there are any CRITICAL or EMERGENCY severity alerts active right now."""
        alerts = await self.list_alerts()
        for alert in alerts:
            if not alert.resolved and alert.severity.lower() in ["critical", "emergency"]:
                return True
        return False

    async def acknowledge_alert(self, alert_id: str) -> bool:
        """Mark an alert as acknowledged by an operator and persist to SQLite / memory state."""
        alert = await self.alert_repo.get_by_id(alert_id)
        if alert:
            meta = dict(alert.payload or {})
            meta["acknowledged"] = True
            meta["acknowledged_at"] = datetime.now().isoformat()
            alert.payload = meta
            alert.acknowledged_at = datetime.now()
            self.db.add(alert)
            await self.db.commit()
            await self.db.refresh(alert)
            return True

        sim_alerts = self.sim_service.list_alerts()
        for sa in sim_alerts:
            if sa.id == alert_id:
                self.sim_service.acknowledged_sim_alerts.add(alert_id)
                return True
        return False

    async def resolve_alert(self, alert_id: str) -> bool:
        """Mark an alert as resolved and persist to SQLite / memory state."""
        alert = await self.alert_repo.get_by_id(alert_id)
        if alert:
            alert.resolved_at = datetime.now()
            self.db.add(alert)
            await self.db.commit()
            await self.db.refresh(alert)
            return True

        sim_alerts = self.sim_service.list_alerts()
        for sa in sim_alerts:
            if sa.id == alert_id:
                self.sim_service.resolved_sim_alerts.add(alert_id)
                return True
        return False

async def get_alert_service(
    db: AsyncSession = Depends(get_db),
) -> AlertService:
    return AlertService(db)
