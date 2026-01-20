-- ============================================================================
-- Hidro-AI - Inicialização completa do banco de dados
-- ============================================================================
-- Script consolidado para criar todas as tabelas em ordem correta
--
-- Uso:
--   psql -U postgres -d hidro_ai -f init_database.sql
-- ============================================================================

-- Habilita extensões úteis
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------------------------------------------------------
-- Tabela: greenhouse (Estufas)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS greenhouse (
  id          BIGSERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  location    TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- Tabela: sensor (Sensores)
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- Telemetria: Sensores Ambientais (SHT31)
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- Status: Sensores Ambientais
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ambient_status (
  sensor_id  BIGINT PRIMARY KEY REFERENCES sensor(id) ON DELETE CASCADE,
  status     TEXT NOT NULL CHECK (status IN ('online','offline')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ambient_status_updated_at
  ON ambient_status (updated_at DESC);

-- ----------------------------------------------------------------------------
-- Views: Monitoramento
-- ----------------------------------------------------------------------------

-- Última telemetria de cada sensor
CREATE OR REPLACE VIEW vw_ambient_last_telemetry AS
SELECT DISTINCT ON (s.id)
  s.id AS sensor_id,
  s.device_key,
  s.name AS sensor_name,
  g.name AS greenhouse_name,
  at.received_at,
  at.temp_c,
  at.hum_pct,
  at.rssi,
  at.uptime_s,
  EXTRACT(EPOCH FROM (now() - at.received_at)) AS seconds_ago
FROM sensor s
JOIN greenhouse g ON g.id = s.greenhouse_id
LEFT JOIN ambient_telemetry at ON at.sensor_id = s.id
WHERE s.sensor_type = 'ambient'
ORDER BY s.id, at.received_at DESC;

-- Visão geral dos sensores
CREATE OR REPLACE VIEW vw_ambient_sensor_overview AS
SELECT
  s.id,
  s.device_key,
  s.name,
  g.name AS greenhouse_name,
  ast.status,
  ast.updated_at AS status_updated_at,
  lt.received_at AS last_telemetry_at,
  lt.temp_c AS last_temp_c,
  lt.hum_pct AS last_hum_pct,
  lt.rssi AS last_rssi
FROM sensor s
JOIN greenhouse g ON g.id = s.greenhouse_id
LEFT JOIN ambient_status ast ON ast.sensor_id = s.id
LEFT JOIN vw_ambient_last_telemetry lt ON lt.sensor_id = s.id
WHERE s.sensor_type = 'ambient'
ORDER BY s.id;

-- Sensores offline há mais de 10 minutos
CREATE OR REPLACE VIEW vw_ambient_alert_offline_10m AS
SELECT
  s.id,
  s.device_key,
  s.name,
  g.name AS greenhouse_name,
  ast.status,
  ast.updated_at,
  EXTRACT(EPOCH FROM (now() - ast.updated_at)) / 60 AS minutes_offline
FROM sensor s
JOIN greenhouse g ON g.id = s.greenhouse_id
LEFT JOIN ambient_status ast ON ast.sensor_id = s.id
WHERE s.sensor_type = 'ambient'
  AND (
    ast.status = 'offline'
    OR ast.updated_at < (now() - INTERVAL '10 minutes')
    OR ast.status IS NULL
  )
ORDER BY ast.updated_at;

-- ----------------------------------------------------------------------------
-- Dados de exemplo (opcional - comente se não quiser)
-- ----------------------------------------------------------------------------

-- Insere estufa de exemplo
INSERT INTO greenhouse (name, location)
VALUES ('Estufa Principal', 'Galpão A')
ON CONFLICT DO NOTHING;

-- Insere sensor de exemplo
INSERT INTO sensor (greenhouse_id, device_key, sensor_type, name)
SELECT 1, 'estufa-sht31-01', 'ambient', 'Sensor Temperatura/Umidade #1'
WHERE NOT EXISTS (
  SELECT 1 FROM sensor WHERE device_key = 'estufa-sht31-01'
);

-- ----------------------------------------------------------------------------
-- Permissões (opcional - para usuário dedicado)
-- ----------------------------------------------------------------------------
-- CREATE USER hidro_collector WITH PASSWORD 'senha_forte_aqui';
-- GRANT CONNECT ON DATABASE hidro_ai TO hidro_collector;
-- GRANT SELECT ON sensor TO hidro_collector;
-- GRANT INSERT ON ambient_telemetry TO hidro_collector;
-- GRANT UPDATE, INSERT ON ambient_status TO hidro_collector;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO hidro_collector;

-- ----------------------------------------------------------------------------
-- Mensagem de sucesso
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Banco de dados Hidro-AI inicializado!';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
END $$;
