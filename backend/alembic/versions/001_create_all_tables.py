"""Create all initial database tables for railway entities."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import Enum

revision = "001"
down_revision = None
branch_labels = None
depends_on = None

# Enums for PostgreSQL (will be skipped for SQLite)
alert_types = Enum(
    "PLATFORM_CONGESTION", "TRAIN_DELAY", "OPERATIONAL_ISSUE", "PREDICTION_ALERT", "SYSTEM_WARNING",
    name="alert_types"
)
severity_levels = Enum("LOW", "MEDIUM", "HIGH", "CRITICAL", name="severity_levels")


def upgrade():
    # Create users table
    op.create_table(
        "users",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False, unique=True),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("full_name", sa.String(255), nullable=False),
        sa.Column("role", sa.String(50), nullable=False, server_default="passenger"),
        sa.Column("refresh_token", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
    )

    # Create lines table
    op.create_table(
        "lines",
        sa.Column("id", sa.String(32), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False, unique=True),
        sa.Column("color", sa.String(7), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
    )

    # Create stations table
    op.create_table(
        "stations",
        sa.Column("station_id", sa.String(8), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False, unique=True),
        sa.Column("line_id", sa.String(32), sa.ForeignKey("lines.id"), nullable=False),
        sa.Column("is_interchange", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("cumulative_km", sa.Float, nullable=False),
        sa.Column("sort_order", sa.Integer, nullable=True),
    )

    # Create routes table
    op.create_table(
        "routes",
        sa.Column("route_id", sa.String(16), primary_key=True),
        sa.Column("line_id", sa.String(32), sa.ForeignKey("lines.id"), nullable=False),
        sa.Column("direction", sa.String(8), nullable=False),
        sa.Column("origin_station_id", sa.String(8), nullable=False),
        sa.Column("destination_station_id", sa.String(8), nullable=False),
        sa.Column("runtime_minutes", sa.Integer, nullable=False),
    )

    # Create route_stops table
    op.create_table(
        "route_stops",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("route_id", sa.String(16), sa.ForeignKey("routes.route_id"), nullable=False),
        sa.Column("station_id", sa.String(8), sa.ForeignKey("stations.station_id"), nullable=False),
        sa.Column("stop_order", sa.Integer, nullable=False),
        sa.Column("arrival_offset_minutes", sa.Integer, nullable=False),
        sa.Column("departure_offset_minutes", sa.Integer, nullable=False),
        sa.Column("dwell_minutes", sa.Integer, server_default="1"),
    )

    # Create coaches table
    op.create_table(
        "coaches",
        sa.Column("coach_id", sa.String(32), primary_key=True),
        sa.Column("coach_number", sa.String(8), nullable=False),
        sa.Column("coach_type", sa.String(16), nullable=False),
        sa.Column("capacity", sa.Integer, nullable=False),
        sa.Column("description", sa.String(255), nullable=True),
    )

    # Create trains table
    op.create_table(
        "trains",
        sa.Column("train_id", sa.String(32), primary_key=True),
        sa.Column("train_name", sa.String(100), nullable=False),
        sa.Column("line_id", sa.String(32), sa.ForeignKey("lines.id"), nullable=False),
        sa.Column("direction", sa.String(16), nullable=False),
        sa.Column("current_station_id", sa.String(8), sa.ForeignKey("stations.station_id"), nullable=True),
        sa.Column("next_station_id", sa.String(8), sa.ForeignKey("stations.station_id"), nullable=True),
        sa.Column("capacity", sa.Integer, nullable=False, server_default="1200"),
        sa.Column("status", sa.String(16), nullable=False, server_default="ACTIVE"),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
    )

    # Create train_coaches junction table
    op.create_table(
        "train_coaches",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("train_id", sa.String(32), sa.ForeignKey("trains.train_id"), nullable=False),
        sa.Column("coach_number", sa.String(8), nullable=False),
        sa.Column("coach_type", sa.String(16), nullable=False),
        sa.Column("capacity", sa.Integer, nullable=False),
        sa.Column("description", sa.String(255), nullable=True),
    )

    # Create occupancy_snapshots table
    op.create_table(
        "occupancy_snapshots",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("train_id", sa.String(32), sa.ForeignKey("trains.train_id"), nullable=False),
        sa.Column("station_id", sa.String(8), sa.ForeignKey("stations.station_id"), nullable=False),
        sa.Column("timestamp", sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column("total_passengers", sa.Integer, nullable=False),
        sa.Column("coach_data", postgresql.JSON(astext_type=sa.Text()), nullable=True),
    )

    # Create station_crowd_snapshots table
    op.create_table(
        "station_crowd_snapshots",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("station_id", sa.String(8), sa.ForeignKey("stations.station_id"), nullable=False),
        sa.Column("timestamp", sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column("current_crowd", sa.Integer, nullable=False),
        sa.Column("predicted_5_min", sa.Integer, nullable=False),
        sa.Column("predicted_15_min", sa.Integer, nullable=False),
        sa.Column("predicted_30_min", sa.Integer, nullable=False),
    )

    # Create alerts table
    op.create_table(
        "alerts",
        sa.Column("id", sa.String(32), primary_key=True),
        sa.Column("alert_type", sa.String(32), nullable=False),
        sa.Column("severity", sa.String(16), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("message", sa.String(500), nullable=False),
        sa.Column("station_id", sa.String(8), sa.ForeignKey("stations.station_id"), nullable=True),
        sa.Column("train_id", sa.String(32), sa.ForeignKey("trains.train_id"), nullable=True),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column("resolved_at", sa.DateTime, nullable=True),
        sa.Column("metadata", postgresql.JSON(astext_type=sa.Text()), nullable=True),
    )

    # Create predictions table
    op.create_table(
        "predictions",
        sa.Column("id", sa.String(32), primary_key=True),
        sa.Column("train_id", sa.String(32), sa.ForeignKey("trains.train_id"), nullable=False),
        sa.Column("station_name", sa.String(100), nullable=False),
        sa.Column("predicted_occupancy", sa.Integer, nullable=False),
        sa.Column("predicted_5_min", sa.Integer, nullable=False),
        sa.Column("predicted_15_min", sa.Integer, nullable=False),
        sa.Column("predicted_30_min", sa.Integer, nullable=False),
        sa.Column("confidence", sa.Float, nullable=False),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
    )


def downgrade():
    op.drop_table("predictions")
    op.drop_table("station_crowd_snapshots")
    op.drop_table("alerts")
    op.drop_table("occupancy_snapshots")
    op.drop_table("train_coaches")
    op.drop_table("trains")
    op.drop_table("coaches")
    op.drop_table("route_stops")
    op.drop_table("routes")
    op.drop_table("stations")
    op.drop_table("lines")
    op.drop_table("users")