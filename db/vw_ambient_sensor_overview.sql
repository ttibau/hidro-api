CREATE OR REPLACE VIEW vw_ambient_sensor_overview AS
SELECT
  s.id AS sensor_id,
  s.device_key,
  s.name AS sensor_name,
  s.greenhouse_id,
  g.name AS greenhouse_name,
  st.status,
  st.updated_at AS status_updated_at,
  lt.received_at AS last_telemetry_at,
  lt.temp_c,
  lt.hum_pct,
  lt.rssi
FROM sensor s
JOIN greenhouse g ON g.id = s.greenhouse_id
LEFT JOIN ambient_status st ON st.sensor_id = s.id
LEFT JOIN vw_ambient_last_telemetry lt ON lt.sensor_id = s.id
WHERE s.sensor_type = 'ambient';
