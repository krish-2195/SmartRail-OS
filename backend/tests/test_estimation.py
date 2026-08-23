import pytest
from datetime import datetime
from sqlalchemy import select
from app.db.session import SessionLocal
from app.models.estimation import Estimation
from app.services.domain import estimation_service


@pytest.mark.anyio
async def test_estimation_pipeline():
    # 1. Setup mock train states matching simulation format
    mock_train_states = [
        {
            "train_id": "BL-01",
            "line_code": "BL",
            "direction": "UP",
            "current_station_id": "BL05",
            "current_station": "Vastral Gam",
            "next_station_id": "BL06",
            "next_station": "Nirant Cross Road",
            "journey_completed_pct": 25.0,
            "current_position": 25.0,
            "delay_minutes": 1,
            "eta_to_next_station_min": 2,
            "departed_terminal_at": "08:15",
            "coaches": [
                {"coach_id": "C1", "current_passengers": 150, "occupancy_pct": 37.5},
                {"coach_id": "C2", "current_passengers": 80, "occupancy_pct": 20.0},
                {"coach_id": "C3", "current_passengers": 120, "occupancy_pct": 30.0},
            ],
            "status": "ACTIVE"
        }
    ]

    now = datetime(2026, 6, 12, 8, 17, 0)  # Friday morning

    # 2. Run the estimation service (CPU-bound)
    results = estimation_service.estimate_for_train_states(mock_train_states, now)

    # 3. Assert predictions were generated for all 3 coaches
    assert len(results) == 3
    for row in results:
        assert row["train_id"] == "BL-01"
        assert row["line_id"] == "BL"
        assert row["direction"] == "UP"
        assert row["current_station_id"] == "BL05"
        assert row["next_station_id"] == "BL06"
        assert row["coach_id"] in {"C1", "C2", "C3"}
        assert row["estimated_alighting"] >= 0
        assert row["estimated_boarding"] >= 0
        assert row["estimated_next_passengers"] >= 0
        assert row["temperature"] > 0
        assert row["weather"] in {"Sunny", "Cloudy", "Rainy"}
        assert row["is_holiday"] is False

    # 4. Persist to test database
    async with SessionLocal() as db:
        for row in results:
            db.add(Estimation(**row))
        await db.commit()

    # 5. Retrieve from DB and verify fields
    async with SessionLocal() as db:
        stmt = select(Estimation).where(Estimation.train_id == "BL-01")
        db_rows = (await db.execute(stmt)).scalars().all()
        assert len(db_rows) == 3
        for row in db_rows:
            assert row.train_id == "BL-01"
            assert row.coach_id in {"C1", "C2", "C3"}
            assert row.estimated_alighting is not None
            assert row.estimated_boarding is not None
            assert row.estimated_next_passengers is not None
            assert row.train_time == "08:15"


from fastapi.testclient import TestClient
from app.main import app

@pytest.mark.anyio
async def test_dashboard_snapshot_with_estimations():
    # 1. Create dummy estimations in the database for BL-11 approaching Nirant Cross Road (BL02)
    async with SessionLocal() as db:
        from app.models.estimation import Estimation
        from sqlalchemy import delete
        await db.execute(delete(Estimation))
        now = datetime(2026, 6, 14, 8, 17, 0)
        for coach in ["C1", "C2", "C3"]:
            db.add(Estimation(
                train_id="BL-11",
                line_id="BL",
                direction="UP",
                current_station_id="BL01",
                current_station_name="Vastral Gam",
                next_station_id="BL02",
                next_station_name="Nirant Cross Road",
                coach_id=coach,
                coach_type="GENERAL" if coach != "C2" else "LADIES",
                current_passengers=100,
                estimated_boarding=10,
                estimated_alighting=5,
                estimated_next_passengers=105,
                weather="Sunny",
                temperature=32.0,
                is_holiday=False,
                created_at=now
            ))
        await db.commit()

    from unittest.mock import patch
    import datetime as dt_module

    class MockDatetime(dt_module.datetime):
        @classmethod
        def now(cls, tz=None):
            return dt_module.datetime(2026, 6, 14, 8, 17, 0)
            
    with patch("app.services.data_service.datetime", MockDatetime), \
         patch("data_api.metro_engine_shared.datetime", MockDatetime):
        
        from app.services.metro_engine import engine, build_train_roster
        engine._trains = build_train_roster(now)
        
        with TestClient(app) as client:
            response = client.get("/api/v1/dashboard/snapshot", params={"station_name": "Nirant Cross Road", "sim_time": "08:17"})
            assert response.status_code == 200
            data = response.json()

            # Check if the incoming train BL-11 has the summed predictions from the DB:
            # Boarding: 10 + 10 + 10 = 30
            # Deboarding: 5 + 5 + 5 = 15
            # Next Total Pax: 105 + 105 + 105 = 315
            # Predicted Occupancy % = int((315 / 1200) * 100) = 26%
            train_data = None
            for t in data["incoming_trains"]:
                if t["train_id"] == "BL-11":
                    train_data = t
                    break

            assert train_data is not None
            assert train_data["predicted_boarding_count"] == 30
            assert train_data["predicted_deboarding_count"] == 15
            assert train_data["predicted_occupancy_at_station"] == 26

