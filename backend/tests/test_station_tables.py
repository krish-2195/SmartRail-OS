import pytest
from datetime import datetime
from fastapi.testclient import TestClient
from app.main import app
from app.services.metro_engine import engine
from app.db.session import SessionLocal
from app.models.estimation import Estimation
from sqlalchemy import delete

@pytest.mark.anyio
async def test_station_endpoints_not_found():
    with TestClient(app) as client:
        # Invalid station ID should return 404
        resp = client.get("/api/v1/stations/INVALID/current")
        assert resp.status_code == 404

        resp2 = client.get("/api/v1/stations/INVALID/feature")
        assert resp2.status_code == 404

@pytest.mark.anyio
async def test_station_current_state():
    # Find a time and station where a train is dwelling:
    found = False
    target_station_id = None
    target_time_str = None
    target_train_id = None

    # Search for an active dwelling train in the engine
    for hour in range(6, 22):
        for minute in (0, 2, 4, 6, 8, 10, 12, 14, 15, 20, 30, 40, 50):
            time_str = f"{hour:02d}:{minute:02d}"
            now = datetime.strptime(time_str, "%H:%M")
            today = datetime.now().date()
            now = datetime(today.year, today.month, today.day, now.hour, now.minute)
            trains = engine.all_trains(now)
            for t in trains:
                if t.get("status") in ("AT_STATION", "WAITING_AT_TERMINAL"):
                    target_station_id = t["current_station_id"]
                    target_time_str = time_str
                    target_train_id = t["train_id"]
                    found = True
                    break
            if found:
                break
        if found:
            break

    assert found, "Could not find a dwelling train in the schedule"

    with TestClient(app) as client:
        # 1. Query when a train is dwelling
        resp = client.get(f"/api/v1/stations/{target_station_id}/current", params={"sim_time": target_time_str})
        assert resp.status_code == 200
        data = resp.json()
        assert data["train_id"] == target_train_id
        assert data["status"] == "at_platform"
        assert data["eta_seconds"] == 0
        assert data["current_passenger_count"] is not None
        assert len(data["coaches"]) == 3
        for coach in data["coaches"]:
            assert coach["coach_id"] in {"C1", "C2", "C3"}
            assert coach["current_passengers"] >= 0
            assert coach["capacity"] == 400
            assert coach["occupancy_pct"] >= 0.0

        # 2. Query at a time/station where NO train is dwelling (e.g. at 05:00 when no trains run)
        resp_empty = client.get(f"/api/v1/stations/{target_station_id}/current", params={"sim_time": "05:00"})
        assert resp_empty.status_code == 200
        data_empty = resp_empty.json()
        assert data_empty["train_id"] is None
        assert data_empty["status"] == "none"
        assert data_empty["coaches"] == []

        # 3. Test station current state fallback for a specific station
        resp_departed = client.get("/api/v1/stations/BL08/current", params={"sim_time": "09:30"})
        assert resp_departed.status_code == 200
        data_dep = resp_departed.json()
        assert data_dep["train_id"] is not None
        assert data_dep["status"] in ("just_departed", "arriving", "at_platform")
        assert data_dep["eta_seconds"] >= 0
        assert len(data_dep["coaches"]) == 3

@pytest.mark.anyio
async def test_station_feature_predictions():
    # Find a time and station where a train is upcoming:
    found_upcoming = False
    upcoming_station_id = None
    upcoming_time_str = None
    upcoming_train_id = None

    for hour in range(6, 22):
        for minute in (0, 2, 4, 6, 8, 10, 12, 14, 15, 20, 30, 40, 50):
            time_str = f"{hour:02d}:{minute:02d}"
            now = datetime.strptime(time_str, "%H:%M")
            today = datetime.now().date()
            now = datetime(today.year, today.month, today.day, now.hour, now.minute)
            trains = engine.all_trains(now)
            schedules_map = {t_raw["train_id"]: t_raw["schedule"] for t_raw in engine._trains}
            for t in trains:
                if t.get("status") in ("IN_TRANSIT", "WAITING_AT_TERMINAL"):
                    sched = schedules_map.get(t["train_id"], [])
                    curr_id = t.get("current_station_id")
                    curr_idx = next((i for i, seg in enumerate(sched) if seg["station"]["id"] == curr_id), None)
                    if curr_idx is not None and curr_idx < len(sched) - 1:
                        upcoming_station_id = sched[curr_idx + 1]["station"]["id"]
                        upcoming_time_str = time_str
                        upcoming_train_id = t["train_id"]
                        found_upcoming = True
                        break
            if found_upcoming:
                break
        if found_upcoming:
            break

    assert found_upcoming, "Could not find an upcoming train in the schedule"

    # Clean any existing estimations for this train/station from the DB first
    async with SessionLocal() as db:
        await db.execute(
            delete(Estimation)
            .where(Estimation.train_id == upcoming_train_id)
            .where(Estimation.next_station_id == upcoming_station_id)
        )
        await db.commit()

        with TestClient(app) as client:
            # 1. Query prediction endpoint with NO estimations in the DB -> Fallback path
            resp_fallback = client.get(f"/api/v1/stations/{upcoming_station_id}/feature", params={"sim_time": upcoming_time_str})
            assert resp_fallback.status_code == 200
            data_fallback = [t for t in resp_fallback.json() if t.get("train_id") != "ESP32_DEMO"]
            assert isinstance(data_fallback, list)
            assert len(data_fallback) > 0
            first_fallback = data_fallback[0]
            assert first_fallback["train_id"] == upcoming_train_id
        assert first_fallback["estimated_arrival_time"] is not None
        assert first_fallback["estimated_passenger_incoming"] >= 0
        assert len(first_fallback["coaches"]) == 3
        for coach in first_fallback["coaches"]:
            assert coach["coach_id"] in {"C1", "C2", "C3"}
            assert coach["capacity"] == 400
            assert coach["arrival_passengers"] >= 0
            assert coach["departure_passengers"] >= 0

        # 2. Insert mock estimations in the DB to test the DB path
        now_dt = datetime.now()
        async with SessionLocal() as db:
            for coach in ["C1", "C2", "C3"]:
                db.add(Estimation(
                    train_id=upcoming_train_id,
                    line_id="BL",
                    direction="UP",
                    current_station_id="BL01",
                    next_station_id=upcoming_station_id,
                    coach_id=coach,
                    coach_type="GENERAL" if coach != "C2" else "LADIES",
                    current_passengers=150 if coach != "C2" else 100,  # total incoming = 400
                    estimated_boarding=20,  # total boarding = 60
                    estimated_alighting=10,  # total alighting = 30
                    estimated_next_passengers=160 if coach != "C2" else 110,  # total departure = 430
                    weather="Sunny",
                    temperature=32.0,
                    is_holiday=False,
                    created_at=now_dt
                ))
            await db.commit()

        # Query again -> Should fetch from DB estimations
        resp_db = client.get(f"/api/v1/stations/{upcoming_station_id}/feature", params={"sim_time": upcoming_time_str})
        assert resp_db.status_code == 200
        data_db = [t for t in resp_db.json() if t.get("train_id") != "ESP32_DEMO"]
        assert isinstance(data_db, list)
        assert len(data_db) > 0
        first_db = data_db[0]
        assert first_db["train_id"] == upcoming_train_id
        assert first_db["estimated_passenger_incoming"] == 400
        assert first_db["estimated_boarding"] == 60
        assert first_db["estimated_alighting"] == 30
        assert first_db["estimated_station_passenger_count"] == 430
        assert len(first_db["coaches"]) == 3
        for coach in first_db["coaches"]:
            if coach["coach_id"] == "C2":
                assert coach["arrival_passengers"] == 100
                assert coach["departure_passengers"] == 110
            else:
                assert coach["arrival_passengers"] == 150
                assert coach["departure_passengers"] == 160
