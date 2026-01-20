import { getPool } from "../db/config";

export interface DashboardSummary {
  total_greenhouses: number;
  sensors_active: number;
  sensors_delayed: number;
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
  status: "ATIVO" | "ATRASADO" | "OFFLINE";
  last_seen_at: Date | null;
  minutes_since_last_seen: number | null;
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

    // Sensores por status lógico
    const sensorStatusResult = await pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE get_sensor_status(s.last_seen_at, s.expected_interval_s) = 'ATIVO') as active,
        COUNT(*) FILTER (WHERE get_sensor_status(s.last_seen_at, s.expected_interval_s) = 'ATRASADO') as delayed,
        COUNT(*) FILTER (WHERE get_sensor_status(s.last_seen_at, s.expected_interval_s) = 'OFFLINE') as offline
      FROM estufa.sensor s
    `);
    const sensors_active = parseInt(sensorStatusResult.rows[0].active || "0");
    const sensors_delayed = parseInt(sensorStatusResult.rows[0].delayed || "0");
    const sensors_offline = parseInt(sensorStatusResult.rows[0].offline || "0");

    // Alertas ativos (sensores atrasados ou offline)
    const active_alerts = sensors_delayed + sensors_offline;

    // Temperatura e umidade média (últimas telemetrias de cada sensor)
    const avgResult = await pool.query(`
      SELECT 
        AVG(t.temp_c) as avg_temp,
        AVG(t.hum_pct) as avg_hum
      FROM estufa.sensor s
      LEFT JOIN LATERAL (
        SELECT temp_c, hum_pct
        FROM estufa.telemetry
        WHERE sensor_id = s.id
        ORDER BY received_at DESC
        LIMIT 1
      ) t ON true
      WHERE t.temp_c IS NOT NULL AND t.hum_pct IS NOT NULL
    `);

    return {
      total_greenhouses,
      sensors_active,
      sensors_delayed,
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
        AVG(t.temp_c) as avg_temperature,
        AVG(t.hum_pct) as avg_humidity,
        COUNT(DISTINCT s.id) as sensor_count,
        BOOL_OR(
          get_sensor_status(s.last_seen_at, s.expected_interval_s) IN ('ATRASADO', 'OFFLINE')
        ) as has_alert
      FROM estufa.greenhouse g
      LEFT JOIN estufa.sensor s ON s.greenhouse_id = g.id
      LEFT JOIN LATERAL (
        SELECT temp_c, hum_pct
        FROM estufa.telemetry
        WHERE sensor_id = s.id
        ORDER BY received_at DESC
        LIMIT 1
      ) t ON true
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
      has_alert: row.has_alert || false,
    }));
  }

  // Alertas recentes (sensores atrasados ou offline)
  async getRecentAlerts(limit: number = 10): Promise<RecentAlert[]> {
    const pool = getPool();

    const result = await pool.query(`
      SELECT 
        s.id as sensor_id,
        s.name as sensor_name,
        s.device_key,
        s.greenhouse_id,
        g.name as greenhouse_name,
        get_sensor_status(s.last_seen_at, s.expected_interval_s) as status,
        s.last_seen_at,
        CASE 
          WHEN s.last_seen_at IS NOT NULL THEN
            EXTRACT(EPOCH FROM (now() - s.last_seen_at)) / 60
          ELSE NULL
        END as minutes_since_last_seen
      FROM estufa.sensor s
      INNER JOIN estufa.greenhouse g ON g.id = s.greenhouse_id
      WHERE get_sensor_status(s.last_seen_at, s.expected_interval_s) IN ('ATRASADO', 'OFFLINE')
      ORDER BY s.last_seen_at DESC NULLS LAST
      LIMIT $1
    `, [limit]);

    return result.rows.map((row) => ({
      sensor_id: row.sensor_id,
      sensor_name: row.sensor_name,
      device_key: row.device_key,
      greenhouse_id: row.greenhouse_id,
      greenhouse_name: row.greenhouse_name,
      status: row.status,
      last_seen_at: row.last_seen_at,
      minutes_since_last_seen: row.minutes_since_last_seen
        ? Math.round(row.minutes_since_last_seen)
        : null,
    }));
  }

  // Resumo rápido (uptime e sensores ativos)
  async getQuickSummary(): Promise<QuickSummary> {
    const pool = getPool();

    const result = await pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE get_sensor_status(s.last_seen_at, s.expected_interval_s) = 'ATIVO') as active,
        COUNT(*) as total
      FROM estufa.sensor s
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
