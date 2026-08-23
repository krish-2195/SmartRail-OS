from fastapi.testclient import TestClient
from app.main import app

def test_announcements_full_lifecycle():
    with TestClient(app) as client:
        # 1. Fetch initial active announcements
        res = client.get("/api/v1/announcements/active")
        assert res.status_code == 200
        assert isinstance(res.json(), list)

        # 2. Broadcast a new announcement
        payload = {
            "text": "Platform 1 train approaching Kalupur Interchange",
            "context_info": "Operational notice"
        }
        res_bc = client.post("/api/v1/announcements/broadcast", json=payload)
        assert res_bc.status_code == 200
        data = res_bc.json()
        assert data["text"] == payload["text"]
        assert data["is_active"] is True
        ann_id = data["id"]

        # 3. Check that it appears in active announcements
        res_active = client.get("/api/v1/announcements/active")
        assert res_active.status_code == 200
        active_ids = [a["id"] for a in res_active.json()]
        assert ann_id in active_ids

        # 4. Deactivate the announcement
        res_deact = client.patch(f"/api/v1/announcements/{ann_id}/deactivate")
        assert res_deact.status_code == 200
        assert res_deact.json()["message"] == "Announcement deactivated successfully"

        # 5. Check that it is no longer in active announcements
        res_after = client.get("/api/v1/announcements/active")
        assert res_after.status_code == 200
        after_ids = [a["id"] for a in res_after.json()]
        assert ann_id not in after_ids
