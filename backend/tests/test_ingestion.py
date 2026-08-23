from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_ingestion_endpoint():
    payload = {
        "timestamp": "2026-06-10T14:31:00Z",
        "train_id": "BL-01",
        "station_id": "BL05",
        "event_type": "occupancy_update",
        "coaches": [
            {
                "coach_id": "C1",
                "passenger_count": 120,
                "occupancy_percentage": 30.0
            }
        ],
        "delay_minutes": 2
    }
    
    with TestClient(app) as client:
        response = client.post("/api/v1/ingestion/events", json=payload)
        assert response.status_code == 202
        assert response.json() == {"status": "accepted", "processed_events": 1}

def test_esp32_endpoints():
    with TestClient(app) as client:
        # 1. Check default status
        status_resp = client.get("/api/v1/ingestion/esp32/status")
        assert status_resp.status_code == 200
        status_data = status_resp.json()
        assert status_data["status"] == "no_data"
        assert status_data["occupancy"] == 0

        # 2. Post global occupancy
        post_resp = client.post(
            "/api/v1/ingestion/esp32",
            json={"occupancy": 45, "coach_capacity": 400}
        )
        assert post_resp.status_code == 200
        post_data = post_resp.json()
        assert post_data["occupancy"] == 45
        assert post_data["occupancy_pct"] == 11.2
        assert post_data["station_id"] is None

        # 3. Post targeted occupancy
        post_target_resp = client.post(
            "/api/v1/ingestion/esp32",
            json={"occupancy": 20, "station_id": "BL04", "coach_capacity": 400}
        )
        assert post_target_resp.status_code == 200
        post_target_data = post_target_resp.json()
        assert post_target_data["occupancy"] == 20
        assert post_target_data["occupancy_pct"] == 5.0
        assert post_target_data["station_id"] == "BL04"

        # 4. Check per-station occupancies
        per_station_resp = client.get("/api/v1/ingestion/esp32/per-station")
        assert per_station_resp.status_code == 200
        per_station_data = per_station_resp.json()
        assert per_station_data["BL04"] == 20

        # 5. Post global occupancy to reset overrides
        post_reset_resp = client.post(
            "/api/v1/ingestion/esp32",
            json={"occupancy": 0, "coach_capacity": 400}
        )
        assert post_reset_resp.status_code == 200
        
def test_esp32_directional_telemetry_and_events():
    with TestClient(app) as client:
        # Reset counters
        reset_resp = client.post("/api/v1/esp32/reset")
        assert reset_resp.status_code == 200
        assert reset_resp.json()["occupancy"] == 0
        assert reset_resp.json()["total_in"] == 0
        assert reset_resp.json()["total_out"] == 0

        # Post Boarding (IN)
        in_resp = client.post(
            "/api/v1/esp32/telemetry",
            json={
                "direction": "IN",
                "in_delta": 3,
                "out_delta": 0,
                "station_id": "BL08",
                "coach_id": "C1",
                "distance_s1": 12.5,
                "distance_s2": 45.0,
            }
        )
        assert in_resp.status_code == 200
        in_data = in_resp.json()
        assert in_data["occupancy"] == 3
        assert in_data["total_in"] == 3
        assert in_data["total_out"] == 0
        assert in_data["last_direction"] == "IN"

        # Post Alighting (OUT)
        out_resp = client.post(
            "/api/v1/esp32/telemetry",
            json={
                "direction": "OUT",
                "in_delta": 0,
                "out_delta": 1,
                "station_id": "BL08",
                "coach_id": "C1",
                "distance_s1": 35.0,
                "distance_s2": 15.0,
            }
        )
        assert out_resp.status_code == 200
        out_data = out_resp.json()
        assert out_data["occupancy"] == 2
        assert out_data["total_in"] == 3
        assert out_data["total_out"] == 1
        assert out_data["last_direction"] == "OUT"

        # Fetch Live
        live_resp = client.get("/api/v1/esp32/live")
        assert live_resp.status_code == 200
        live_data = live_resp.json()
        assert live_data["occupancy"] == 2
        assert live_data["total_in"] == 3
        assert live_data["total_out"] == 1
        assert live_data["status"] == "active"

        # Fetch Events log
        events_resp = client.get("/api/v1/esp32/events")
        assert events_resp.status_code == 200
        events = events_resp.json()
        assert len(events) >= 2
        assert events[0]["direction"] == "OUT"
        assert events[1]["direction"] == "IN"



def test_dynamic_train_ingestion():
    payload = {
        "timestamp": "2026-06-10T14:35:00Z",
        "train_id": "ESP32_DEMO",
        "station_id": "BL08",
        "event_type": "occupancy_update",
        "coaches": [
            {"coach_id": "C1", "coach_type": "GENERAL", "passenger_count": 85, "occupancy_percentage": 21.25},
            {"coach_id": "C2", "coach_type": "LADIES", "passenger_count": 40, "occupancy_percentage": 10.0},
            {"coach_id": "C3", "coach_type": "GENERAL", "passenger_count": 75, "occupancy_percentage": 18.75},
        ],
        "delay_minutes": 0
    }
    with TestClient(app) as client:
        response = client.post("/api/v1/ingestion/events", json=payload)
        assert response.status_code == 202
        assert response.json()["status"] == "accepted"


