-- ====================================================================
-- SmartRail OS — TimescaleDB Production Migration Schema
-- Target: PostgreSQL 15+ with TimescaleDB Extension
-- ====================================================================

-- 1. Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

-- 2. Clean teardown (for fresh deployments)
DROP TABLE IF EXISTS occupancy_snapshots CASCADE;
DROP TABLE IF EXISTS station_crowd_snapshots CASCADE;
DROP TABLE IF EXISTS ingestion_sensor_events CASCADE;

-- 3. Ingestion Sensor Events Table
CREATE TABLE ingestion_sensor_events (
    id BIGSERIAL,
    sensor_id VARCHAR(64) NOT NULL,
    station_id VARCHAR(32) NOT NULL,
    coach_id VARCHAR(32),
    event_type VARCHAR(16) NOT NULL, -- 'ENTRY' | 'EXIT'
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB,
    PRIMARY KEY (id, timestamp)
);

-- Convert to TimescaleDB Hypertable (1-day chunk interval)
SELECT create_hypertable('ingestion_sensor_events', 'timestamp', chunk_time_interval => INTERVAL '1 day');

CREATE INDEX idx_sensor_events_station_time ON ingestion_sensor_events (station_id, timestamp DESC);
CREATE INDEX idx_sensor_events_coach_time ON ingestion_sensor_events (coach_id, timestamp DESC);

-- 4. High-frequency Train Occupancy Snapshots Table
CREATE TABLE occupancy_snapshots (
    id BIGSERIAL,
    train_id VARCHAR(64) NOT NULL,
    line_code VARCHAR(16) NOT NULL,
    total_passengers INT NOT NULL DEFAULT 0,
    avg_occupancy_pct NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    coach_c1_pax INT DEFAULT 0,
    coach_c2_pax INT DEFAULT 0,
    coach_c3_pax INT DEFAULT 0,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, timestamp)
);

-- Convert to Hypertable (1-day chunk interval)
SELECT create_hypertable('occupancy_snapshots', 'timestamp', chunk_time_interval => INTERVAL '1 day');

CREATE INDEX idx_occupancy_snapshots_train_time ON occupancy_snapshots (train_id, timestamp DESC);

-- 5. Station Platform Crowd Snapshots Table
CREATE TABLE station_crowd_snapshots (
    id BIGSERIAL,
    station_id VARCHAR(32) NOT NULL,
    station_name VARCHAR(128) NOT NULL,
    current_crowd INT NOT NULL DEFAULT 0,
    predicted_15_min INT DEFAULT 0,
    predicted_60_min INT DEFAULT 0,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, timestamp)
);

-- Convert to Hypertable (1-day chunk interval)
SELECT create_hypertable('station_crowd_snapshots', 'timestamp', chunk_time_interval => INTERVAL '1 day');

CREATE INDEX idx_station_crowd_station_time ON station_crowd_snapshots (station_id, timestamp DESC);

-- 6. Continuous Aggregate View: 5-Minute Station Inflow/Outflow Rollups
CREATE MATERIALIZED VIEW station_crowd_5min_summary
WITH (timescaledb.continuous) AS
SELECT
    station_id,
    time_bucket('5 minutes', timestamp) AS bucket,
    AVG(current_crowd) AS avg_crowd,
    MAX(current_crowd) AS peak_crowd,
    MIN(current_crowd) AS min_crowd
FROM station_crowd_snapshots
GROUP BY station_id, bucket;

-- 7. Continuous Aggregate Policy (Refresh every 1 minute)
SELECT add_continuous_aggregate_policy('station_crowd_5min_summary',
    start_offset => INTERVAL '1 day',
    end_offset => INTERVAL '1 minute',
    schedule_interval => INTERVAL '1 minute');

-- 8. Data Retention Policy (Drop raw sensor events older than 90 days)
SELECT add_retention_policy('ingestion_sensor_events', INTERVAL '90 days');
SELECT add_retention_policy('occupancy_snapshots', INTERVAL '180 days');

COMMENT ON TABLE ingestion_sensor_events IS 'Raw IR/optical IoT passenger break-beam events stored in TimescaleDB hypertables.';
COMMENT ON TABLE occupancy_snapshots IS 'Time-series snapshots of real-time train coach loadings.';
