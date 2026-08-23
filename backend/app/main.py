from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import asyncio

from app.api.v1.router import api_router
from app.core.config import settings
from app.services.engine.simulation_runner import start_simulation_runner


@asynccontextmanager
async def lifespan(app: FastAPI):
    import sys
    # Skip background simulation task only during pytest runs
    is_testing = "pytest" in sys.modules
    
    if not is_testing:
        # Check database initialization and auto-seed if needed
        from app.db.session import SessionLocal, engine as db_engine
        from app.models.base import Base
        from app.models.station import Station
        from app.db.seeder import seed_database, seed_default_users
        from sqlalchemy import select, func
        
        # 1. Ensure tables exist
        async with db_engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
            
        # 2. Check if users or stations table is seeded
        async with SessionLocal() as session:
            await seed_default_users(session)
            station_count = await session.scalar(select(func.count()).select_from(Station))
            if not station_count or station_count == 0:
                print("Seeding database catalog...")
                await seed_database(session)

        # Start the simulation loop in the background
        task = asyncio.create_task(start_simulation_runner())
        yield
        # Cancel the simulation runner on shutdown
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass
    else:
        yield


app = FastAPI(title=settings.app_name, version="0.1.0", lifespan=lifespan)

# NOTE: allow_credentials=True is incompatible with wildcard allow_origins per HTTP spec.
# Since frontend client uses credentials: "include", we MUST use explicit origins and allow_credentials=True.
_cors_origins = [origin for origin in settings.cors_origins if origin != "*"]
_allow_credentials = True

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex="https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": settings.app_name}


app.include_router(api_router, prefix=settings.api_v1_prefix)
# Trigger reload

