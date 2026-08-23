"""Database seeder — populates stations, routes, route_stops, and trains on first run."""

from datetime import datetime, timedelta
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.station import Station
from app.models.route import Route, RouteStop
from app.models.train import Train, TrainCoach
from app.models.alert import Alert, AlertType, SeverityLevel
from app.models.user import User
from app.core.security import hash_password
from app.services.metro_engine import (
    BLUE_LINE_STATIONS,
    RED_LINE_STATIONS,
    BL_UP_SCHED,
    BL_UP_DUR,
    BL_DOWN_SCHED,
    BL_DOWN_DUR,
    RL_UP_SCHED,
    RL_UP_DUR,
    RL_DOWN_SCHED,
    RL_DOWN_DUR,
    COACHES,
)


async def seed_default_users(db: AsyncSession) -> None:
    """Seed initial IT Admin, Station Operators, and Passenger demo users."""
    user_count = await db.scalar(select(func.count()).select_from(User))
    if user_count and user_count > 0:
        return

    default_users = [
        User(
            user_id_code="ADMIN01",
            email="admin@smartrail.os",
            full_name="IT Administrator",
            hashed_password=hash_password("admin123"),
            role="admin",
            station_id=None,
            is_active=True,
        ),
        User(
            user_id_code="OP_BL11",
            email="operator.bl11@smartrail.os",
            full_name="Old High Court Operator",
            hashed_password=hash_password("operator123"),
            role="operator",
            station_id="BL11",
            is_active=True,
        ),
        User(
            user_id_code="OP_BL01",
            email="operator.bl01@smartrail.os",
            full_name="Vastral Gam Operator",
            hashed_password=hash_password("operator123"),
            role="operator",
            station_id="BL01",
            is_active=True,
        ),
        User(
            user_id_code="PASS101",
            email="passenger@smartrail.os",
            full_name="Rahul Sharma",
            hashed_password=hash_password("pass123"),
            role="passenger",
            station_id=None,
            is_active=True,
        ),
    ]
    for u in default_users:
        db.add(u)
    await db.commit()


async def seed_database(db: AsyncSession) -> None:
    """Populate reference tables and default users if they are empty."""
    await seed_default_users(db)

    count = await db.scalar(select(func.count()).select_from(Station))
    if count and count > 0:
        return  # Already seeded

    # ── Stations ──────────────────────────────────
    # Blue Line: all 18 stations
    for idx, (sid, name, km, busy) in enumerate(BLUE_LINE_STATIONS):
        db.add(Station(
            station_id=sid, name=name, line_id="BL",
            is_interchange=(name in ("Old High Court", "Kalupur Metro Station")),
            is_busy=busy, cumulative_km=km, sort_order=idx,
        ))

    # Red Line: all 15 stations.
    # Old High Court (RL07) is a real interchange with Blue Line (BL11).
    # Both station IDs must exist in the stations table so route_stops FK
    # references are never broken.  RL07 is stored with a disambiguated name
    # suffix so the unique-name constraint on `stations.name` is not violated.
    for idx, (sid, name, km, busy) in enumerate(RED_LINE_STATIONS):
        stored_name = f"{name} (RL)" if name == "Old High Court" else name
        db.add(Station(
            station_id=sid, name=stored_name, line_id="RL",
            is_interchange=(name in ("Old High Court", "Sabarmati Rly Station")),
            is_busy=busy, cumulative_km=km, sort_order=idx,
        ))

    # ── Routes & Route Stops ─────────────────────
    route_configs = [
        ("BL-UP", "BL", "UP", "BL01", "BL18", max(1, round(BL_UP_DUR / 60)), BL_UP_SCHED),
        ("BL-DOWN", "BL", "DOWN", "BL18", "BL01", max(1, round(BL_DOWN_DUR / 60)), BL_DOWN_SCHED),
        ("RL-UP", "RL", "UP", "RL01", "RL15", max(1, round(RL_UP_DUR / 60)), RL_UP_SCHED),
        ("RL-DOWN", "RL", "DOWN", "RL15", "RL01", max(1, round(RL_DOWN_DUR / 60)), RL_DOWN_SCHED),
    ]
    for route_id, line_id, direction, origin, dest, runtime, schedule in route_configs:
        db.add(Route(
            route_id=route_id, line_id=line_id, direction=direction,
            origin_station_id=origin, destination_station_id=dest,
            runtime_minutes=runtime,
        ))
        for idx, seg in enumerate(schedule):
            db.add(RouteStop(
                route_id=route_id,
                station_id=seg["station"]["id"],
                stop_order=idx + 1,
                arrival_offset_minutes=round(seg["arrive_offset"] / 60),
                departure_offset_minutes=round(seg["depart_offset"] / 60),
                dwell_minutes=max(1, round((seg["depart_offset"] - seg["arrive_offset"]) / 60)),
            ))

    # ── Circulating Trains & Coaches ─────────────
    # 12 Blue Line rakes (BL-01..BL-12) & 12 Red Line rakes (RL-01..RL-12)
    line_configs = [
        ("BL", "Blue Line", 12),
        ("RL", "Red Line", 12),
    ]

    for line_id, line_name, count in line_configs:
        for i in range(count):
            train_id = f"{line_id}-{i + 1:02d}"
            train_name = f"{line_name} Rake {i + 1:02d}"
            train = Train(
                train_id=train_id,
                train_name=train_name,
                line_id=line_id,
                direction="UP",
                capacity=1200,
                status="ACTIVE",
            )
            db.add(train)

            # Attach coaches
            for coach in COACHES:
                db.add(TrainCoach(
                    train_id=train_id,
                    coach_number=coach["id"],
                    coach_type=coach["type"],
                    capacity=coach["capacity"],
                ))

    # ── ESP32 Dummy Train ────────────────────────
    esp32_train = Train(
        train_id="ESP32_DEMO",
        train_name="ESP32 Sensor Train",
        line_id="BL",
        direction="UP",
        current_station_id="BL01",
        capacity=1200,
        status="ACTIVE",
    )
    db.add(esp32_train)

    for coach in COACHES:
        db.add(TrainCoach(
            train_id="ESP32_DEMO",
            coach_number=coach["id"],
            coach_type=coach["type"],
            capacity=coach["capacity"],
        ))

    # ── Operational Alerts ───────────────────────
    now = datetime.now()
    default_alerts = [
        Alert(
            id="alt-emg-01",
            alert_type=AlertType.PLATFORM_CONGESTION,
            severity=SeverityLevel.CRITICAL,
            title="Critical Crowd Surge at Old High Court",
            message="Platform 1 & 2 crowd exceeds 850 passengers. Immediate turnstile metering recommended.",
            station_id="BL11",
            train_id=None,
            created_at=now - timedelta(minutes=15),
            resolved_at=now - timedelta(minutes=5),
            payload={"acknowledged": True},
        ),
        Alert(
            id="alt-wrn-02",
            alert_type=AlertType.PREDICTION_ALERT,
            severity=SeverityLevel.HIGH,
            title="Train Capacity Warning (BL-UP-03)",
            message="Train BL-UP-03 coach 3 approaching 92% critical occupancy near Kalupur Metro Station.",
            station_id="BL08",
            train_id="BL-UP-03",
            created_at=now - timedelta(minutes=25),
            resolved_at=now - timedelta(minutes=10),
            payload={"acknowledged": True},
        ),
        Alert(
            id="alt-dly-03",
            alert_type=AlertType.TRAIN_DELAY,
            severity=SeverityLevel.MEDIUM,
            title="Minor Dwell Delay at Motera Stadium",
            message="Train RL-UP-04 experienced +2m dwell delay due to heavy platform boarding flow.",
            station_id="RL15",
            train_id="RL-UP-04",
            created_at=now - timedelta(minutes=45),
            resolved_at=now - timedelta(minutes=20),
            payload={"acknowledged": True},
        ),
    ]
    for alert in default_alerts:
        db.add(alert)

    await db.commit()

