from datetime import datetime
from fastapi import APIRouter, Query, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.rail import AlertOut, IncomingTrainOut, StationCrowdPredictionOut, TrainAtStationOut, KpiHistoryOut, KpiSnapshot
from app.schemas.realtime import DashboardSnapshot
from app.services.domain.dashboard_service import DashboardService, get_dashboard_service
from app.db.session import get_db

router = APIRouter()

def _extract_status(t) -> str:
    if hasattr(t, "status"):
        return str(t.status or "")
    if isinstance(t, dict):
        return str(t.get("status", "") or "")
    return ""

def _extract_pax(t) -> int:
    if hasattr(t, "coaches") and t.coaches:
        return sum(getattr(c, "current_passenger_count", 0) for c in t.coaches)
    if isinstance(t, dict):
        return t.get("train_current_passengers", 0)
    return 0


@router.get("/snapshot", response_model=DashboardSnapshot)
async def get_dashboard_snapshot(
    station_name: str = Query("Old High Court"),
    sim_time: str | None = Query(None, description="Simulate time as HH:MM", pattern=r"^(?:[01]\d|2[0-3]):[0-5]\d$"),
    dashboard_service: DashboardService = Depends(get_dashboard_service)
) -> DashboardSnapshot:
    return await dashboard_service.get_dashboard_snapshot(station_name, sim_time)


@router.get("/kpi-history", response_model=KpiHistoryOut)
async def get_kpi_history(db: AsyncSession = Depends(get_db)) -> KpiHistoryOut:
    """Return real-time database KPI snapshot plus the same snapshot from ~60 minutes ago."""
    from datetime import timedelta
    from sqlalchemy import select, func, and_
    from app.models.train import OccupancySnapshot
    from app.models.route import StationCrowdSnapshot
    from app.core.sim_clock import sim_clock
    from app.services.data_service import data_service

    now = sim_clock.now()

    async def _get_latest_db_snapshot() -> KpiSnapshot | None:
        try:
            # Subquery for latest timestamp per train
            train_subq = (
                select(
                    OccupancySnapshot.train_id,
                    func.max(OccupancySnapshot.timestamp).label("max_ts")
                )
                .group_by(OccupancySnapshot.train_id)
                .subquery()
            )

            train_stmt = (
                select(
                    func.count(OccupancySnapshot.train_id),
                    func.sum(OccupancySnapshot.total_passengers)
                )
                .join(
                    train_subq,
                    and_(
                        OccupancySnapshot.train_id == train_subq.c.train_id,
                        OccupancySnapshot.timestamp == train_subq.c.max_ts
                    )
                )
            )
            t_res = await db.execute(train_stmt)
            row = t_res.one_or_none()
            active_trains = row[0] if row else 0
            total_pax = int(row[1] or 0) if row and row[1] is not None else 0

            # Subquery for latest crowd per station
            crowd_subq = (
                select(
                    StationCrowdSnapshot.station_id,
                    func.max(StationCrowdSnapshot.timestamp).label("max_ts")
                )
                .group_by(StationCrowdSnapshot.station_id)
                .subquery()
            )

            crowd_stmt = (
                select(func.sum(StationCrowdSnapshot.current_crowd))
                .join(
                    crowd_subq,
                    and_(
                        StationCrowdSnapshot.station_id == crowd_subq.c.station_id,
                        StationCrowdSnapshot.timestamp == crowd_subq.c.max_ts
                    )
                )
            )
            c_res = await db.execute(crowd_stmt)
            total_crowd = int(c_res.scalar() or 0)

            if active_trains > 0 or total_pax > 0:
                avg_occ = round((total_pax / (active_trains * 800)) * 100, 1) if active_trains > 0 else 0.0
                return KpiSnapshot(
                    active_trains=active_trains,
                    passengers_in_transit=total_pax,
                    avg_occupancy_pct=avg_occ,
                    total_station_crowd=total_crowd,
                    captured_at=now,
                )
        except Exception:
            pass
        return None

    current = await _get_latest_db_snapshot()

    if current is None:
        live_trains = data_service.get_all_trains_live(now)
        active_t = [t for t in live_trains if _extract_status(t) not in ("NOT_IN_SERVICE", "WAITING_AT_TERMINAL")]
        n_active = len(active_t)
        total_pax = sum(_extract_pax(t) for t in active_t)
        avg_occ = round((total_pax / (max(1, n_active) * 800)) * 100, 1) if n_active > 0 else 0.0
        
        station_crowds = data_service.list_station_crowds(now)
        total_crowd = sum(c.current_station_crowd for c in station_crowds)
        
        current = KpiSnapshot(
            active_trains=n_active,
            passengers_in_transit=total_pax,
            avg_occupancy_pct=avg_occ,
            total_station_crowd=total_crowd,
            captured_at=now,
        )

    # Historical 1-hour ago comparison from simulation dataset
    h_ago_dt = now - timedelta(minutes=60)
    h_trains = data_service.get_all_trains_live(h_ago_dt)
    h_active_t = [t for t in h_trains if _extract_status(t) not in ("NOT_IN_SERVICE", "WAITING_AT_TERMINAL")]
    h_n_active = len(h_active_t)
    h_total_pax = sum(_extract_pax(t) for t in h_active_t)
    h_avg_occ = round((h_total_pax / (max(1, h_n_active) * 800)) * 100, 1) if h_n_active > 0 else 0.0
    h_crowds = data_service.list_station_crowds(h_ago_dt)
    h_total_crowd = sum(c.current_station_crowd for c in h_crowds)
    
    hour_ago = KpiSnapshot(
        active_trains=h_n_active,
        passengers_in_transit=h_total_pax,
        avg_occupancy_pct=h_avg_occ,
        total_station_crowd=h_total_crowd,
        captured_at=h_ago_dt,
    )

    return KpiHistoryOut(current=current, hour_ago=hour_ago)

