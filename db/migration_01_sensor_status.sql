-- ============================================================================
-- Migração: Adicionar suporte a status lógico baseado em last_seen_at
-- ============================================================================
-- Adiciona colunas expected_interval_s e last_seen_at à tabela sensor
-- Remove dependência da tabela ambient_status (mantida por compatibilidade)
-- Renomeia ambient_telemetry para telemetry (tabela híbrida para todos os tipos)
-- ============================================================================

BEGIN;

-- 1. Adicionar colunas à tabela sensor
ALTER TABLE sensor 
  ADD COLUMN IF NOT EXISTS expected_interval_s INTEGER NOT NULL DEFAULT 3600 
    CHECK (expected_interval_s >= 60 AND expected_interval_s <= 86400),
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

COMMENT ON COLUMN sensor.expected_interval_s IS 'Intervalo esperado entre leituras em segundos (60-86400)';
COMMENT ON COLUMN sensor.last_seen_at IS 'Timestamp da última telemetria recebida';

-- 2. Renomear tabela ambient_telemetry para telemetry
ALTER TABLE IF EXISTS ambient_telemetry RENAME TO telemetry;

-- 3. Recriar índice com novo nome da tabela
DROP INDEX IF EXISTS idx_ambient_telemetry_sensor_time;
CREATE INDEX IF NOT EXISTS idx_telemetry_sensor_time
  ON telemetry (sensor_id, received_at DESC);

-- 4. Atualizar last_seen_at com base nos dados existentes
UPDATE sensor s
SET last_seen_at = (
  SELECT MAX(t.received_at)
  FROM telemetry t
  WHERE t.sensor_id = s.id
)
WHERE EXISTS (
  SELECT 1 FROM telemetry t WHERE t.sensor_id = s.id
);

-- 5. Criar função para atualizar last_seen_at automaticamente
CREATE OR REPLACE FUNCTION update_sensor_last_seen()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE sensor
  SET last_seen_at = NEW.received_at
  WHERE id = NEW.sensor_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Criar trigger para atualizar last_seen_at
DROP TRIGGER IF EXISTS trg_update_sensor_last_seen ON telemetry;
CREATE TRIGGER trg_update_sensor_last_seen
  AFTER INSERT ON telemetry
  FOR EACH ROW
  EXECUTE FUNCTION update_sensor_last_seen();

-- 7. Criar função helper para calcular status lógico
CREATE OR REPLACE FUNCTION get_sensor_status(
  p_last_seen_at TIMESTAMPTZ,
  p_expected_interval_s INTEGER
) RETURNS TEXT AS $$
DECLARE
  v_delta_seconds NUMERIC;
  v_threshold_active NUMERIC;
  v_threshold_delayed NUMERIC;
BEGIN
  -- Se last_seen_at é NULL, sensor nunca enviou dados
  IF p_last_seen_at IS NULL THEN
    RETURN 'OFFLINE';
  END IF;

  -- Calcular diferença em segundos
  v_delta_seconds := EXTRACT(EPOCH FROM (now() - p_last_seen_at));
  
  -- Calcular thresholds
  v_threshold_active := p_expected_interval_s * 2;
  v_threshold_delayed := p_expected_interval_s * 3;

  -- Determinar status
  IF v_delta_seconds <= v_threshold_active THEN
    RETURN 'ATIVO';
  ELSIF v_delta_seconds <= v_threshold_delayed THEN
    RETURN 'ATRASADO';
  ELSE
    RETURN 'OFFLINE';
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMIT;

-- ============================================================================
-- Mensagem de sucesso
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migração concluída com sucesso!';
  RAISE NOTICE '- Colunas expected_interval_s e last_seen_at adicionadas';
  RAISE NOTICE '- Tabela ambient_telemetry renomeada para telemetry';
  RAISE NOTICE '- Trigger para atualizar last_seen_at criado';
  RAISE NOTICE '- Função get_sensor_status() disponível';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
END $$;
