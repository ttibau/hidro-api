-- ============================================================================
-- Script de Teste - Sistema de Status Lógico
-- ============================================================================
-- Este script cria dados de teste para validar o sistema de status lógico
-- ============================================================================

BEGIN;

-- Limpar dados de teste anteriores (se existirem)
DELETE FROM estufa.telemetry WHERE sensor_id IN (
  SELECT id FROM estufa.sensor WHERE device_key LIKE 'test-%'
);
DELETE FROM estufa.sensor WHERE device_key LIKE 'test-%';

-- Criar estufa de teste (se não existir)
INSERT INTO estufa.greenhouse (name, location)
VALUES ('Estufa de Teste', 'Ambiente de Testes')
ON CONFLICT DO NOTHING;

-- Pegar ID da estufa de teste
DO $$
DECLARE
  v_greenhouse_id BIGINT;
BEGIN
  SELECT id INTO v_greenhouse_id 
  FROM estufa.greenhouse 
  WHERE name = 'Estufa de Teste' 
  LIMIT 1;

  -- ============================================================================
  -- Cenário 1: Sensor ATIVO (última leitura há 50 minutos, intervalo = 1h)
  -- ============================================================================
  INSERT INTO estufa.sensor (greenhouse_id, device_key, sensor_type, name, expected_interval_s, last_seen_at)
  VALUES (
    v_greenhouse_id,
    'test-sensor-ativo-01',
    'ambient',
    'Sensor Teste - ATIVO',
    3600,  -- 1 hora
    NOW() - INTERVAL '50 minutes'
  );

  -- Adicionar telemetria para o sensor ativo
  INSERT INTO estufa.telemetry (sensor_id, received_at, temp_c, hum_pct, rssi, uptime_s, raw)
  SELECT 
    s.id,
    NOW() - INTERVAL '50 minutes',
    25.5,
    65.0,
    -72,
    3000,
    '{"test": true}'::jsonb
  FROM estufa.sensor s
  WHERE s.device_key = 'test-sensor-ativo-01';

  -- ============================================================================
  -- Cenário 2: Sensor ATRASADO (última leitura há 2h10min, intervalo = 1h)
  -- ============================================================================
  INSERT INTO estufa.sensor (greenhouse_id, device_key, sensor_type, name, expected_interval_s, last_seen_at)
  VALUES (
    v_greenhouse_id,
    'test-sensor-atrasado-01',
    'ambient',
    'Sensor Teste - ATRASADO',
    3600,  -- 1 hora
    NOW() - INTERVAL '2 hours 10 minutes'
  );

  -- Adicionar telemetria para o sensor atrasado
  INSERT INTO estufa.telemetry (sensor_id, received_at, temp_c, hum_pct, rssi, uptime_s, raw)
  SELECT 
    s.id,
    NOW() - INTERVAL '2 hours 10 minutes',
    24.8,
    68.5,
    -75,
    7800,
    '{"test": true}'::jsonb
  FROM estufa.sensor s
  WHERE s.device_key = 'test-sensor-atrasado-01';

  -- ============================================================================
  -- Cenário 3: Sensor OFFLINE (última leitura há 3h30min, intervalo = 1h)
  -- ============================================================================
  INSERT INTO estufa.sensor (greenhouse_id, device_key, sensor_type, name, expected_interval_s, last_seen_at)
  VALUES (
    v_greenhouse_id,
    'test-sensor-offline-01',
    'ambient',
    'Sensor Teste - OFFLINE',
    3600,  -- 1 hora
    NOW() - INTERVAL '3 hours 30 minutes'
  );

  -- Adicionar telemetria para o sensor offline
  INSERT INTO estufa.telemetry (sensor_id, received_at, temp_c, hum_pct, rssi, uptime_s, raw)
  SELECT 
    s.id,
    NOW() - INTERVAL '3 hours 30 minutes',
    23.2,
    70.0,
    -80,
    12600,
    '{"test": true}'::jsonb
  FROM estufa.sensor s
  WHERE s.device_key = 'test-sensor-offline-01';

  -- ============================================================================
  -- Cenário 4: Sensor sem telemetria (last_seen_at NULL)
  -- ============================================================================
  INSERT INTO estufa.sensor (greenhouse_id, device_key, sensor_type, name, expected_interval_s, last_seen_at)
  VALUES (
    v_greenhouse_id,
    'test-sensor-nunca-visto',
    'ambient',
    'Sensor Teste - Nunca Visto',
    3600,  -- 1 hora
    NULL
  );

  -- ============================================================================
  -- Cenário 5: Sensor com intervalo curto (15 min) - ATIVO
  -- ============================================================================
  INSERT INTO estufa.sensor (greenhouse_id, device_key, sensor_type, name, expected_interval_s, last_seen_at)
  VALUES (
    v_greenhouse_id,
    'test-sensor-curto-ativo',
    'ambient',
    'Sensor Teste - Intervalo Curto ATIVO',
    900,  -- 15 minutos
    NOW() - INTERVAL '10 minutes'
  );

  INSERT INTO estufa.telemetry (sensor_id, received_at, temp_c, hum_pct, rssi, uptime_s, raw)
  SELECT 
    s.id,
    NOW() - INTERVAL '10 minutes',
    26.0,
    62.0,
    -68,
    600,
    '{"test": true}'::jsonb
  FROM estufa.sensor s
  WHERE s.device_key = 'test-sensor-curto-ativo';

  -- ============================================================================
  -- Cenário 6: Sensor com intervalo longo (6 horas) - ATIVO
  -- ============================================================================
  INSERT INTO estufa.sensor (greenhouse_id, device_key, sensor_type, name, expected_interval_s, last_seen_at)
  VALUES (
    v_greenhouse_id,
    'test-sensor-longo-ativo',
    'ambient',
    'Sensor Teste - Intervalo Longo ATIVO',
    21600,  -- 6 horas
    NOW() - INTERVAL '8 hours'
  );

  INSERT INTO estufa.telemetry (sensor_id, received_at, temp_c, hum_pct, rssi, uptime_s, raw)
  SELECT 
    s.id,
    NOW() - INTERVAL '8 hours',
    22.5,
    75.0,
    -78,
    28800,
    '{"test": true}'::jsonb
  FROM estufa.sensor s
  WHERE s.device_key = 'test-sensor-longo-ativo';

END $$;

COMMIT;

-- ============================================================================
-- Validação: Verificar status de todos os sensores de teste
-- ============================================================================
SELECT 
  s.id,
  s.device_key,
  s.name,
  s.expected_interval_s,
  s.last_seen_at,
  EXTRACT(EPOCH FROM (NOW() - s.last_seen_at)) / 60 as minutes_since_last_seen,
  estufa.get_sensor_status(s.last_seen_at, s.expected_interval_s) as status,
  CASE 
    WHEN estufa.get_sensor_status(s.last_seen_at, s.expected_interval_s) = 'ATIVO' THEN '✅'
    WHEN estufa.get_sensor_status(s.last_seen_at, s.expected_interval_s) = 'ATRASADO' THEN '⚠️'
    WHEN estufa.get_sensor_status(s.last_seen_at, s.expected_interval_s) = 'OFFLINE' THEN '❌'
    ELSE '❓'
  END as icon
FROM estufa.sensor s
WHERE s.device_key LIKE 'test-%'
ORDER BY s.device_key;

-- ============================================================================
-- Validação: Verificar última telemetria de cada sensor
-- ============================================================================
SELECT 
  s.device_key,
  t.temp_c,
  t.hum_pct,
  t.rssi,
  t.received_at,
  EXTRACT(EPOCH FROM (NOW() - t.received_at)) / 60 as minutes_ago
FROM estufa.sensor s
LEFT JOIN LATERAL (
  SELECT temp_c, hum_pct, rssi, received_at
  FROM estufa.telemetry
  WHERE sensor_id = s.id
  ORDER BY received_at DESC
  LIMIT 1
) t ON true
WHERE s.device_key LIKE 'test-%'
ORDER BY s.device_key;

-- ============================================================================
-- Validação: Status esperado vs. status calculado
-- ============================================================================
SELECT 
  CASE 
    WHEN device_key = 'test-sensor-ativo-01' THEN 'ATIVO'
    WHEN device_key = 'test-sensor-atrasado-01' THEN 'ATRASADO'
    WHEN device_key = 'test-sensor-offline-01' THEN 'OFFLINE'
    WHEN device_key = 'test-sensor-nunca-visto' THEN 'OFFLINE'
    WHEN device_key = 'test-sensor-curto-ativo' THEN 'ATIVO'
    WHEN device_key = 'test-sensor-longo-ativo' THEN 'ATIVO'
  END as status_esperado,
  estufa.get_sensor_status(last_seen_at, expected_interval_s) as status_calculado,
  CASE 
    WHEN (
      CASE 
        WHEN device_key = 'test-sensor-ativo-01' THEN 'ATIVO'
        WHEN device_key = 'test-sensor-atrasado-01' THEN 'ATRASADO'
        WHEN device_key = 'test-sensor-offline-01' THEN 'OFFLINE'
        WHEN device_key = 'test-sensor-nunca-visto' THEN 'OFFLINE'
        WHEN device_key = 'test-sensor-curto-ativo' THEN 'ATIVO'
        WHEN device_key = 'test-sensor-longo-ativo' THEN 'ATIVO'
      END
    ) = estufa.get_sensor_status(last_seen_at, expected_interval_s) THEN '✅ PASS'
    ELSE '❌ FAIL'
  END as resultado,
  device_key
FROM estufa.sensor
WHERE device_key LIKE 'test-%'
ORDER BY device_key;

-- ============================================================================
-- Mensagem final
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Dados de teste criados com sucesso!';
  RAISE NOTICE '';
  RAISE NOTICE 'Sensores de teste:';
  RAISE NOTICE '  - test-sensor-ativo-01 (ATIVO)';
  RAISE NOTICE '  - test-sensor-atrasado-01 (ATRASADO)';
  RAISE NOTICE '  - test-sensor-offline-01 (OFFLINE)';
  RAISE NOTICE '  - test-sensor-nunca-visto (OFFLINE)';
  RAISE NOTICE '  - test-sensor-curto-ativo (ATIVO)';
  RAISE NOTICE '  - test-sensor-longo-ativo (ATIVO)';
  RAISE NOTICE '';
  RAISE NOTICE 'Teste via API:';
  RAISE NOTICE '  curl http://localhost:3000/sensors | jq';
  RAISE NOTICE '';
  RAISE NOTICE 'Limpar dados de teste:';
  RAISE NOTICE '  DELETE FROM estufa.telemetry WHERE sensor_id IN (';
  RAISE NOTICE '    SELECT id FROM estufa.sensor WHERE device_key LIKE ''test-%%''';
  RAISE NOTICE '  );';
  RAISE NOTICE '  DELETE FROM estufa.sensor WHERE device_key LIKE ''test-%%'';';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
END $$;
