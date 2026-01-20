CREATE TABLE IF NOT EXISTS ambient_telemetry (
  id          BIGSERIAL PRIMARY KEY,
  sensor_id   BIGINT NOT NULL REFERENCES sensor(id) ON DELETE CASCADE,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  temp_c      REAL,
  hum_pct     REAL,
  rssi        INTEGER,
  uptime_s    INTEGER,
  raw         JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ambient_telemetry_sensor_time
  ON ambient_telemetry (sensor_id, received_at DESC);

CREATE TABLE IF NOT EXISTS ambient_status (
  sensor_id  BIGINT PRIMARY KEY REFERENCES sensor(id) ON DELETE CASCADE,
  status     TEXT NOT NULL CHECK (status IN ('online','offline')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ambient_status_updated_at
  ON ambient_status (updated_at DESC);