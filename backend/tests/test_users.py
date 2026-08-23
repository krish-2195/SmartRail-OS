import pytest
from fastapi.testclient import TestClient
from app.main import app


def test_user_registration_and_login():
    with TestClient(app) as client:
        # 1. Register a new passenger with a user_id_code
        reg_payload = {
            "user_id_code": "PASS999",
            "email": "passenger.test@smartrail.os",
            "full_name": "Test Commuter",
            "password": "passSecure123",
            "role": "passenger",
        }
        res_reg = client.post("/api/v1/auth/register", json=reg_payload)
        assert res_reg.status_code == 201
        user_data = res_reg.json()
        assert user_data["user_id_code"] == "PASS999"
        assert user_data["email"] == "passenger.test@smartrail.os"
        assert user_data["full_name"] == "Test Commuter"
        assert user_data["role"] == "passenger"
        assert "id" in user_data

        # 2. Prevent duplicate registrations by email or user_id_code
        res_dup = client.post("/api/v1/auth/register", json=reg_payload)
        assert res_dup.status_code == 400

        # 3. Login using Passenger ID code (identifier)
        login_payload_id = {
            "identifier": "PASS999",
            "password": "passSecure123",
        }
        res_login_id = client.post("/api/v1/auth/login", json=login_payload_id)
        assert res_login_id.status_code == 200
        token_data = res_login_id.json()
        assert "access_token" in token_data
        assert "refresh_token" in token_data
        assert token_data["token_type"] == "bearer"
        assert token_data["user"]["user_id_code"] == "PASS999"
        assert token_data["user"]["role"] == "passenger"

        # 4. Login using Email
        login_payload_email = {
            "email": "passenger.test@smartrail.os",
            "password": "passSecure123",
        }
        res_login_email = client.post("/api/v1/auth/login", json=login_payload_email)
        assert res_login_email.status_code == 200
        assert res_login_email.json()["user"]["email"] == "passenger.test@smartrail.os"

        # 5. Access /me endpoint with Bearer token
        headers = {"Authorization": f"Bearer {token_data['access_token']}"}
        res_me = client.get("/api/v1/auth/me", headers=headers)
        assert res_me.status_code == 200
        me_data = res_me.json()
        assert me_data["user_id_code"] == "PASS999"
        assert me_data["role"] == "passenger"


def test_operator_and_admin_roles():
    with TestClient(app) as client:
        # 1. Register a Station Operator assigned to BL11
        op_payload = {
            "user_id_code": "OP_TEST_BL11",
            "email": "operator.test@smartrail.os",
            "full_name": "Old High Court Station Master",
            "password": "operatorPass123",
            "role": "operator",
            "station_id": "BL11",
        }
        res_op = client.post("/api/v1/auth/register", json=op_payload)
        assert res_op.status_code == 201
        assert res_op.json()["role"] == "operator"
        assert res_op.json()["station_id"] == "BL11"

        # 2. Login as Operator
        res_login_op = client.post(
            "/api/v1/auth/login",
            json={"identifier": "OP_TEST_BL11", "password": "operatorPass123"},
        )
        assert res_login_op.status_code == 200
        op_token = res_login_op.json()["access_token"]
        assert res_login_op.json()["user"]["station_id"] == "BL11"

        # 3. Check /me for Operator
        res_op_me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {op_token}"})
        assert res_op_me.status_code == 200
        assert res_op_me.json()["role"] == "operator"
        assert res_op_me.json()["station_id"] == "BL11"

        # 4. Register IT Administrator
        admin_payload = {
            "user_id_code": "ADMIN_TEST",
            "email": "admin.test@smartrail.os",
            "full_name": "Chief IT Admin",
            "password": "adminSecret123",
            "role": "admin",
        }
        res_admin = client.post("/api/v1/auth/register", json=admin_payload)
        assert res_admin.status_code == 201
        assert res_admin.json()["role"] == "admin"


def test_saved_routes():
    with TestClient(app) as client:
        # Register a real user first to get a valid UUID
        reg_payload = {
            "email": "jane.doe@example.com",
            "full_name": "Jane Doe",
            "password": "superSecurePassword123",
            "role": "passenger",
        }
        res_reg = client.post("/api/v1/auth/register", json=reg_payload)
        assert res_reg.status_code == 201
        user_id = res_reg.json()["id"]

        # 1. Initially user should have no saved routes
        res_get = client.get(f"/api/v1/users/{user_id}/saved-routes")
        assert res_get.status_code == 200
        assert res_get.json() == []

        # 2. Save a route preference
        route_payload = {
            "lineId": "BL",
            "fromStationId": "BL03",
            "toStationId": "BL11",
            "label": "Home Commute",
        }
        res_post = client.post(f"/api/v1/users/{user_id}/saved-routes", json=route_payload)
        assert res_post.status_code == 201
        assert res_post.json()["status"] == "success"

        # 3. Fetch routes again
        res_get_again = client.get(f"/api/v1/users/{user_id}/saved-routes")
        assert res_get_again.status_code == 200
        saved_list = res_get_again.json()
        assert len(saved_list) == 1
        assert saved_list[0]["lineId"] == "BL"
        assert saved_list[0]["fromStationId"] == "BL03"
        assert saved_list[0]["toStationId"] == "BL11"
        assert saved_list[0]["label"] == "Home Commute"
        assert "id" in saved_list[0]

