"""Station domain models and per-station snapshot table definitions."""

from datetime import datetime
from sqlalchemy import Table, Column, Integer, String, Float, DateTime, Boolean
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base


class Station(Base):
    """Station master data."""

    __tablename__ = "stations"
    id = None

    station_id: Mapped[str] = mapped_column(String(8), primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True)
    line_id: Mapped[str] = mapped_column(String(8))
    is_interchange: Mapped[bool] = mapped_column(Boolean, default=False)
    is_busy: Mapped[bool] = mapped_column(Boolean, default=False)
    cumulative_km: Mapped[float] = mapped_column(Float)
    sort_order: Mapped[int] = mapped_column(Integer)


# ─────────────────────────────────────────────────────────────────────────────
# Per-Station Live Snapshot Tables
# ─────────────────────────────────────────────────────────────────────────────
# One pair of tables per station (66 tables total):
#
#   station_{id}_current  ── always 1 row: the most relevant train RIGHT NOW
#                            (AT_STATION → just_departed within 120s → next arriving)
#                            + coach-wise passenger count & occupancy %
#
#   station_{id}_feature  ── always 1 row: the NEXT upcoming train's prediction
#                            arrival time, departure time, and estimated coach-wise
#                            passenger load at arrival and at departure from this stop
#
# Both tables are REPLACED (DELETE + INSERT) every 5-second simulation tick so
# they always reflect the exact current moment derived from datetime.now().
# ─────────────────────────────────────────────────────────────────────────────

# All 33 station IDs in the Ahmedabad Metro GMRC Phase-1 network
STATION_IDS: list[str] = (
    [f"BL{i:02d}" for i in range(1, 19)] +   # Blue line: BL01 – BL18
    [f"RL{i:02d}" for i in range(1, 16)]      # Red  line: RL01 – RL15
)


def _make_current_table(station_id: str) -> Table:
    """Create and register a station_<id>_current Core Table in Base.metadata."""
    tname = f"station_{station_id.lower()}_current"
    return Table(
        tname,
        Base.metadata,
        # ── Identity ─────────────────────────────────────────────────────────
        Column("id", Integer, primary_key=True, autoincrement=True),
        # ── Which train ──────────────────────────────────────────────────────
        Column("train_id",        String(32),  nullable=True),
        Column("platform_number", Integer,     nullable=True),
        Column("platform_name",   String(100), nullable=True),
        # "at_platform" | "just_departed" | "arriving" | "none"
        Column("train_status", String(20), nullable=True),
        Column("eta_seconds",  Integer,    nullable=True),   # 0 if at platform
        # ── Schedule times (HH:MM) ───────────────────────────────────────────
        Column("arrival_time",   String(16), nullable=True),
        Column("departure_time", String(16), nullable=True),
        # ── Aggregate ────────────────────────────────────────────────────────
        Column("total_passengers", Integer, nullable=True),
        # ── Coach C1 (General) ───────────────────────────────────────────────
        Column("c1_passengers", Integer, nullable=True),
        Column("c1_pct",        Float,   nullable=True),
        # ── Coach C2 (Ladies) ────────────────────────────────────────────────
        Column("c2_passengers", Integer, nullable=True),
        Column("c2_pct",        Float,   nullable=True),
        # ── Coach C3 (General) ───────────────────────────────────────────────
        Column("c3_passengers", Integer, nullable=True),
        Column("c3_pct",        Float,   nullable=True),
        # ── Meta ─────────────────────────────────────────────────────────────
        Column("timestamp",  DateTime, default=datetime.now),
    )


def _make_feature_table(station_id: str) -> Table:
    """Create and register a station_<id>_feature Core Table in Base.metadata."""
    tname = f"station_{station_id.lower()}_feature"
    return Table(
        tname,
        Base.metadata,
        # ── Identity ─────────────────────────────────────────────────────────
        Column("id", Integer, primary_key=True, autoincrement=True),
        # ── Which upcoming train ──────────────────────────────────────────────
        Column("train_id",        String(32),  nullable=True),
        Column("platform_number", Integer,     nullable=True),
        Column("platform_name",   String(100), nullable=True),
        # ── Schedule (exact from engine timetable, HH:MM) ────────────────────
        Column("estimated_arrival_time",   String(16), nullable=True),
        Column("estimated_departure_time", String(16), nullable=True),
        # ── Passenger state AT ARRIVAL at this stop ───────────────────────────
        Column("arr_total_passengers", Integer, nullable=True),
        Column("arr_c1_passengers",    Integer, nullable=True),
        Column("arr_c1_pct",           Float,   nullable=True),
        Column("arr_c2_passengers",    Integer, nullable=True),
        Column("arr_c2_pct",           Float,   nullable=True),
        Column("arr_c3_passengers",    Integer, nullable=True),
        Column("arr_c3_pct",           Float,   nullable=True),
        # ── Passenger state AT DEPARTURE from this stop (after boarding/alight) ─
        Column("dep_total_passengers", Integer, nullable=True),
        Column("dep_c1_passengers",    Integer, nullable=True),
        Column("dep_c1_pct",           Float,   nullable=True),
        Column("dep_c2_passengers",    Integer, nullable=True),
        Column("dep_c2_pct",           Float,   nullable=True),
        Column("dep_c3_passengers",    Integer, nullable=True),
        Column("dep_c3_pct",           Float,   nullable=True),
        # ── Meta ─────────────────────────────────────────────────────────────
        Column("timestamp", DateTime, default=datetime.now),
    )


# Build the registry — this runs once at import time and registers all 66
# Table objects in Base.metadata so that init_db.py's create_all picks them up.
STATION_CURRENT_TABLES: dict[str, Table] = {
    sid: _make_current_table(sid) for sid in STATION_IDS
}
STATION_FEATURE_TABLES: dict[str, Table] = {
    sid: _make_feature_table(sid) for sid in STATION_IDS
}