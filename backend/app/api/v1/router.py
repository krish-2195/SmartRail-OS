from fastapi import APIRouter

from app.api.v1.endpoints import alerts, auth, catalog, dashboard, occupancy, stations, trains, ingestion, ws, predictions, users, announcements, esp32, analytics, sim_time

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(catalog.router, prefix="/catalog", tags=["catalog"])
api_router.include_router(occupancy.router, prefix="/occupancy", tags=["occupancy"])
api_router.include_router(stations.router, prefix="/stations", tags=["stations"])
api_router.include_router(trains.router, prefix="/trains", tags=["trains"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
api_router.include_router(alerts.router, prefix="/alerts", tags=["alerts"])
api_router.include_router(ingestion.router, prefix="/ingestion", tags=["ingestion"])
api_router.include_router(esp32.router, prefix="/esp32", tags=["esp32"])
api_router.include_router(esp32.router, prefix="/ingestion/esp32", tags=["esp32"])
api_router.include_router(predictions.router, prefix="/predictions", tags=["predictions"])
api_router.include_router(ws.router, prefix="/ws", tags=["websocket"])
api_router.include_router(announcements.router, prefix="/announcements", tags=["announcements"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(analytics.router, prefix="/analytics", tags=["analytics"])
api_router.include_router(sim_time.router, prefix="/sim/time", tags=["simulation"])
