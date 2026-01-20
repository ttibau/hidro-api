import { getPool } from "../db/config";

export interface DashboardSummary {
  total_greenhouses: number;
  sensors_online: number;
  sensors_offline: number;
  active_alerts: number;
  avg_temperature: number | null;
  avg_humidity: number | null;
}

export interface GreenhouseSummary {
  id: number;
  name: string;
  location: string | null;
  avg_temperature: number | null;
  avg_humidity: number | null;
  sensor_count: number;
  has_alert: boolean;
}

export interface RecentAlert {
  sensor_id: number;
  sensor_name: string | null;
  device_key: string;
  greenhouse_id: number;
  greenhouse_name: string;
  status: "online" | "offline" | null;
  status_updated_at: Date | null;
  last_telemetry_at: Date | null;
  minutes_offline: number | null;
}

export interface QuickSummary {
  uptime_rate: number;
  active_sensors: number;
  total_sensors: number;
}

export class DashboardService {
  // Resumo geral do dashboard (cards do topo)
  async getSummary(): Promise<DashboardSummary> {
    const pool = getPool();

    // Total de estufas
    const greenhouseResult = await pool.query(
      "SELECT COUNT(*) as total FROM estufa.greenhouse"
    );
    const total_greenhouses = parseInt(greenhouseResult.rows[0].total);

    // Sensores online e offline
    const sensorStatusResult = await pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE ast.status = 'online') as online,
        COUNT(*) FILTER (WHERE ast.status = 'offline' OR ast.status IS NULL) as offline
      FROM estufa.sensor s
      LEFT JOIN estufa.ambient_status ast ON ast.sensor_id = s.id
      WHERE s.sensor_type = 'ambient'
    `);
    const sensors_online = parseInt(sensorStatusResult.rows[0].online || "0");
    const sensors_offline = parseInt(sensorStatusResult.rows[0].offline || "0");

    // Alertas ativos (sensores offline há mais de 10 minutos)
    const alertsResult = await pool.query(
      "SELECT COUNT(*) as total FROM estufa.vw_ambient_alert_offline_10m"
    );
    const active_alerts = parseInt(alertsResult.rows[0].total);

    // Temperatura e umidade média (últimas telemetrias de cada sensor)
    const avgResult = await pool.query(`
      SELECT 
        AVG(lt.temp_c) as avg_temp,
        AVG(lt.hum_pct) as avg_hum
      FROM estufa.vw_ambient_last_telemetry lt
      WHERE lt.temp_c IS NOT NULL AND lt.hum_pct IS NOT NULL
    `);

    return {
      total_greenhouses,
      sensors_online,
      sensors_offline,
      active_alerts,
      avg_temperature: avgResult.rows[0].avg_temp
        ? parseFloat(avgResult.rows[0].avg_temp.toFixed(1))
        : null,
      avg_humidity: avgResult.rows[0].avg_hum
        ? parseFloat(avgResult.rows[0].avg_hum.toFixed(1))
        : null,
    };
  }

  // Lista de estufas com resumo
  async getGreenhousesSummary(): Promise<GreenhouseSummary[]> {
    const pool = getPool();

    const result = await pool.query(`
      SELECT 
        g.id,
        g.name,
        g.location,
        AVG(lt.temp_c) as avg_temperature,
        AVG(lt.hum_pct) as avg_humidity,
        COUNT(DISTINCT s.id) as sensor_count,
        CASE 
          WHEN EXISTS (
            SELECT 1 
            FROM estufa.vw_ambient_alert_offline_10m a
            INNER JOIN estufa.sensor s_alert ON s_alert.id = a.id
            WHERE s_alert.greenhouse_id = g.id
          ) THEN true
          ELSE false
        END as has_alert
      FROM estufa.greenhouse g
      LEFT JOIN estufa.sensor s ON s.greenhouse_id = g.id AND s.sensor_type = 'ambient'
      LEFT JOIN estufa.vw_ambient_last_telemetry lt ON lt.sensor_id = s.id
      GROUP BY g.id, g.name, g.location
      ORDER BY g.id
    `);

    return result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      location: row.location,
      avg_temperature: row.avg_temperature
        ? parseFloat(row.avg_temperature.toFixed(1))
        : null,
      avg_humidity: row.avg_humidity
        ? parseFloat(row.avg_humidity.toFixed(1))
        : null,
      sensor_count: parseInt(row.sensor_count),
      has_alert: row.has_alert,
    }));
  }

  // Alertas recentes
  async getRecentAlerts(limit: number = 10): Promise<RecentAlert[]> {
    const pool = getPool();

    // A view tem: id, device_key, name, greenhouse_name, status, updated_at, minutes_offline
    // Precisamos fazer JOIN com sensor para obter greenhouse_id e last_telemetry_at
    const result = await pool.query(`
      SELECT 
        a.id as sensor_id,
        a.name as sensor_name,
        a.device_key,
        s.greenhouse_id,
        a.greenhouse_name,
        a.status,
        a.updated_at as status_updated_at,
        lt.received_at as last_telemetry_at,
        COALESCE(a.minutes_offline, 
          CASE 
            WHEN lt.received_at IS NOT NULL THEN
              EXTRACT(EPOCH FROM (now() - lt.received_at)) / 60
            WHEN a.updated_at IS NOT NULL THEN
              EXTRACT(EPOCH FROM (now() - a.updated_at)) / 60
            ELSE NULL
          END
        ) as minutes_offline
      FROM estufa.vw_ambient_alert_offline_10m a
      INNER JOIN estufa.sensor s ON s.id = a.id
      LEFT JOIN estufa.vw_ambient_last_telemetry lt ON lt.sensor_id = a.id
      ORDER BY 
        COALESCE(lt.received_at, a.updated_at) DESC NULLS LAST
      LIMIT $1
    `, [limit]);

    return result.rows.map((row) => ({
      sensor_id: row.sensor_id,
      sensor_name: row.sensor_name,
      device_key: row.device_key,
      greenhouse_id: row.greenhouse_id,
      greenhouse_name: row.greenhouse_name,
      status: row.status,
      status_updated_at: row.status_updated_at,
      last_telemetry_at: row.last_telemetry_at,
      minutes_offline: row.minutes_offline
        ? Math.round(row.minutes_offline)
        : null,
    }));
  }

  // Resumo rápido (uptime e sensores ativos)
  async getQuickSummary(): Promise<QuickSummary> {
    const pool = getPool();

    const result = await pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE ast.status = 'online') as active,
        COUNT(*) as total
      FROM estufa.sensor s
      LEFT JOIN estufa.ambient_status ast ON ast.sensor_id = s.id
      WHERE s.sensor_type = 'ambient'
    `);

    const active_sensors = parseInt(result.rows[0].active || "0");
    const total_sensors = parseInt(result.rows[0].total || "0");
    const uptime_rate = total_sensors > 0
      ? Math.round((active_sensors / total_sensors) * 100)
      : 0;

    return {
      uptime_rate,
      active_sensors,
      total_sensors,
    };
  }
}
