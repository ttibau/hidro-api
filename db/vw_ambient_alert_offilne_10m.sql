CREATE OR REPLACE VIEW vw_ambient_alert_offline_10m AS
SELECT *
FROM vw_ambient_sensor_overview
WHERE
  COALESCE(status, 'offline') <> 'online'
  OR status_updated_at < now() - interval '10 minutes'
  OR last_telemetry_at IS NULL
  OR last_telemetry_at < now() - interval '10 minutes';