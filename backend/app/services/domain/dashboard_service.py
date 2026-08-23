from fastapi import Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.realtime import DashboardSnapshot
from app.services.domain.train_service import TrainService, get_train_service
from app.services.domain.occupancy_service import OccupancyService, get_occupancy_service
from app.services.domain.alert_service import AlertService, get_alert_service
from app.services.data_service import data_service

from app.services.engine.prediction_service import PredictionService, get_prediction_service

class DashboardService:
    def __init__(
        self,
        train_service: TrainService = Depends(get_train_service),
        occupancy_service: OccupancyService = Depends(get_occupancy_service),
        alert_service: AlertService = Depends(get_alert_service),
        prediction_service: PredictionService = Depends(get_prediction_service),
    ):
        self.train_service = train_service
        self.occupancy_service = occupancy_service
        self.alert_service = alert_service
        self.prediction_service = prediction_service
        self.sim_service = data_service

    async def get_dashboard_snapshot(self, station_name: str, sim_time: str | None = None) -> DashboardSnapshot:
        # Step 1: Immediate station validation guard (Bug 6 fix)
        if not self.sim_service.station_exists(station_name):
            raise HTTPException(status_code=404, detail=f"Station '{station_name}' not found.")

        now = self.sim_service.parse_sim_time(sim_time)

        incoming = self.sim_service.get_incoming_trains_at_station(station_name, now)
        current = self.sim_service.get_current_trains_at_station(station_name, now)
        
        # Step 2: Safe crowd extraction (Bug 1 fix)
        try:
            station_crowds = await self.occupancy_service.get_station_crowds(sim_time)
        except Exception:
            station_crowds = self.sim_service.list_station_crowds(now)
            
        current_crowd = 0
        station_id_for_alerts = None
        
        station_obj = await self.occupancy_service.station_repo.get_by_name(station_name)
        if station_obj:
            station_id_for_alerts = station_obj.station_id
            
            # Fetch actual ML predictions from the estimations table for incoming trains
            from sqlalchemy import select, func
            from app.models.estimation import Estimation
            
            for train in incoming:
                # 1. Get the latest created_at timestamp for this train and next station stop
                latest_ts_stmt = (
                    select(func.max(Estimation.created_at))
                    .where(
                        Estimation.train_id == train.train_id,
                        Estimation.next_station_id == station_obj.station_id
                    )
                )
                latest_ts = (await self.occupancy_service.db.execute(latest_ts_stmt)).scalar()
                
                if latest_ts:
                    # 2. Sum the per-coach estimations for this prediction run
                    pred_stmt = (
                        select(
                            func.sum(Estimation.estimated_boarding),
                            func.sum(Estimation.estimated_alighting),
                            func.sum(Estimation.estimated_next_passengers)
                        )
                        .where(
                            Estimation.train_id == train.train_id,
                            Estimation.next_station_id == station_obj.station_id,
                            Estimation.created_at == latest_ts
                        )
                    )
                    pred_res = (await self.occupancy_service.db.execute(pred_stmt)).first()
                    if pred_res and pred_res[0] is not None:
                        from app.models.train import Train
                        train_obj_stmt = select(Train).where(Train.train_id == train.train_id)
                        train_obj = (await self.occupancy_service.db.execute(train_obj_stmt)).scalar()
                        cap = train_obj.capacity if train_obj else 1200
                        train.predicted_boarding_count = int(pred_res[0])
                        train.predicted_deboarding_count = int(pred_res[1])
                        train.predicted_occupancy_at_station = int((int(pred_res[2]) / max(cap, 1)) * 100)

        for crowd in station_crowds:
            if crowd.station_name.lower() == station_name.lower():
                current_crowd = crowd.current_station_crowd
                break
                
        crowd_prediction = await self.prediction_service.get_station_crowd_prediction(current_crowd, now)

        # Retrieve live alert data from DB
        alerts = await self.alert_service.list_alerts(station_name=station_id_for_alerts)

        recommendations = []
        if crowd_prediction and crowd_prediction.current_station_crowd > 500:
            recommendations.append("Open additional platform flow control gates")
        if crowd_prediction and crowd_prediction.predicted_15_min > crowd_prediction.current_station_crowd * 1.2:
            recommendations.append("Prepare crowd management staff for rising demand")
        if incoming and incoming[0].eta_minutes <= 3:
            recommendations.append("Incoming train arriving shortly, prepare platforms")

        return DashboardSnapshot(
            station_name=station_name,
            current_trains=current,
            incoming_trains=incoming,
            crowd_prediction=crowd_prediction,
            recommendations=recommendations,
            alerts=alerts,
        )

async def get_dashboard_service(
    train_service: TrainService = Depends(get_train_service),
    occupancy_service: OccupancyService = Depends(get_occupancy_service),
    alert_service: AlertService = Depends(get_alert_service),
    prediction_service: PredictionService = Depends(get_prediction_service),
) -> DashboardService:
    return DashboardService(train_service, occupancy_service, alert_service, prediction_service)
