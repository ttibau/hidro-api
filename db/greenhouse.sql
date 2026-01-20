CREATE TABLE IF NOT EXISTS greenhouse (
  id          BIGSERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  location    TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sensor (
  id            BIGSERIAL PRIMARY KEY,
  greenhouse_id BIGINT NOT NULL REFERENCES greenhouse(id) ON DELETE CASCADE,
  device_key    TEXT NOT NULL UNIQUE, -- ex: "estufa-sht31-01"
  sensor_type   TEXT NOT NULL,        -- ex: "ambient", "ph", "solution_temp"
  name          TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sensor_greenhouse
  ON sensor (greenhouse_id);