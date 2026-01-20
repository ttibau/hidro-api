import { getPool } from "../db/config";

export interface LastTelemetry {
  sensor_id: number;
  device_key: string;
  sensor_name: string | null;
  sensor_type: string;
  greenhouse_id: number;
  greenhouse_name: string;
  received_at: Date | null;
  temp_c: number | null;
  hum_pct: number | null;
  rssi: number | null;
  uptime_s: number | null;
  raw: any | null;
}

export interface SensorOverview {
  sensor_id: number;
  device_key: string;
  sensor_name: string | null;
  greenhouse_id: number;
  greenhouse_name: string;
  status: "ATIVO" | "ATRASADO" | "OFFLINE";
  last_seen_at: Date | null;
  last_telemetry_at: Date | null;
  temp_c: number | null;
  hum_pct: number | null;
  rssi: number | null;
}

export interface OfflineAlert {
  sensor_id: number;
  device_key: string;
  sensor_name: string | null;
  greenhouse_id: number;
  greenhouse_name: string;
  status: "ATIVO" | "ATRASADO" | "OFFLINE";
  last_seen_at: Date | null;
  last_telemetry_at: Date | null;
  temp_c: number | null;
  hum_pct: number | null;
  rssi: number | null;
}

export class ViewsService {
  async getLastTelemetry(): Promise<LastTelemetry[]> {
    const pool = getPool();
    const result = await pool.query<LastTelemetry>(`
      SELECT 
        s.id as sensor_id,
        s.device_key,
        s.name as sensor_name,
        s.sensor_type,
        s.greenhouse_id,
        g.name as greenhouse_name,
        t.received_at,
        t.temp_c,
        t.hum_pct,
        t.rssi,
        t.uptime_s,
        t.raw
      FROM estufa.sensor s
      INNER JOIN estufa.greenhouse g ON g.id = s.greenhouse_id
      LEFT JOIN LATERAL (
        SELECT received_at, temp_c, hum_pct, rssi, uptime_s, raw
        FROM estufa.telemetry
        WHERE sensor_id = s.id
        ORDER BY received_at DESC
        LIMIT 1
      ) t ON true
      ORDER BY s.id
    `);
    return result.rows;
  }

  async getLastTelemetryBySensorId(sensorId: number): Promise<LastTelemetry | null> {
    const pool = getPool();
    const result = await pool.query<LastTelemetry>(`
      SELECT 
        s.id as sensor_id,
        s.device_key,
        s.name as sensor_name,
        s.sensor_type,
        s.greenhouse_id,
        g.name as greenhouse_name,
        t.received_at,
        t.temp_c,
        t.hum_pct,
        t.rssi,
        t.uptime_s,
        t.raw
      FROM estufa.sensor s
      INNER JOIN estufa.greenhouse g ON g.id = s.greenhouse_id
      LEFT JOIN LATERAL (
        SELECT received_at, temp_c, hum_pct, rssi, uptime_s, raw
        FROM estufa.telemetry
        WHERE sensor_id = s.id
        ORDER BY received_at DESC
        LIMIT 1
      ) t ON true
      WHERE s.id = $1
    `, [sensorId]);
    return result.rows[0] || null;
  }

  async getSensorOverview(): Promise<SensorOverview[]> {
    const pool = getPool();
    const result = await pool.query<SensorOverview>(`
      SELECT 
        s.id as sensor_id,
        s.device_key,
        s.name as sensor_name,
        s.greenhouse_id,
        g.name as greenhouse_name,
        get_sensor_status(s.last_seen_at, s.expected_interval_s) as status,
        s.last_seen_at,
        t.received_at as last_telemetry_at,
        t.temp_c,
        t.hum_pct,
        t.rssi
      FROM estufa.sensor s
      INNER JOIN estufa.greenhouse g ON g.id = s.greenhouse_id
      LEFT JOIN LATERAL (
        SELECT received_at, temp_c, hum_pct, rssi
        FROM estufa.telemetry
        WHERE sensor_id = s.id
        ORDER BY received_at DESC
        LIMIT 1
      ) t ON true
      ORDER BY s.id
    `);
    return result.rows;
  }

  async getSensorOverviewByGreenhouseId(greenhouseId: number): Promise<SensorOverview[]> {
    const pool = getPool();
    const result = await pool.query<SensorOverview>(`
      SELECT 
        s.id as sensor_id,
        s.device_key,
        s.name as sensor_name,
        s.greenhouse_id,
        g.name as greenhouse_name,
        get_sensor_status(s.last_seen_at, s.expected_interval_s) as status,
        s.last_seen_at,
        t.received_at as last_telemetry_at,
        t.temp_c,
        t.hum_pct,
        t.rssi
      FROM estufa.sensor s
      INNER JOIN estufa.greenhouse g ON g.id = s.greenhouse_id
      LEFT JOIN LATERAL (
        SELECT received_at, temp_c, hum_pct, rssi
        FROM estufa.telemetry
        WHERE sensor_id = s.id
        ORDER BY received_at DESC
        LIMIT 1
      ) t ON true
      WHERE s.greenhouse_id = $1
      ORDER BY s.id
    `, [greenhouseId]);
    return result.rows;
  }

  async getOfflineAlerts(): Promise<OfflineAlert[]> {
    const pool = getPool();
    const result = await pool.query<OfflineAlert>(`
      SELECT 
        s.id as sensor_id,
        s.device_key,
        s.name as sensor_name,
        s.greenhouse_id,
        g.name as greenhouse_name,
        get_sensor_status(s.last_seen_at, s.expected_interval_s) as status,
        s.last_seen_at,
        t.received_at as last_telemetry_at,
        t.temp_c,
        t.hum_pct,
        t.rssi
      FROM estufa.sensor s
      INNER JOIN estufa.greenhouse g ON g.id = s.greenhouse_id
      LEFT JOIN LATERAL (
        SELECT received_at, temp_c, hum_pct, rssi
        FROM estufa.telemetry
        WHERE sensor_id = s.id
        ORDER BY received_at DESC
        LIMIT 1
      ) t ON true
      WHERE get_sensor_status(s.last_seen_at, s.expected_interval_s) IN ('ATRASADO', 'OFFLINE')
      ORDER BY s.last_seen_at DESC NULLS LAST
    `);
    return result.rows;
  }
}
