CREATE OR REPLACE VIEW vw_ambient_last_telemetry AS
SELECT DISTINCT ON (t.sensor_id)
  t.sensor_id,
  s.device_key,
  s.name AS sensor_name,
  s.sensor_type,
  s.greenhouse_id,
  g.name AS greenhouse_name,
  t.received_at,
  t.temp_c,
  t.hum_pct,
  t.rssi,
  t.uptime_s,
  t.raw
FROM ambient_telemetry t
JOIN sensor s ON s.id = t.sensor_id
JOIN greenhouse g ON g.id = s.greenhouse_id
WHERE s.sensor_type = 'ambient'
ORDER BY t.sensor_id, t.received_at DESC;
