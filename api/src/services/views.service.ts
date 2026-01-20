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
  status: "online" | "offline" | null;
  status_updated_at: Date | null;
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
  status: "online" | "offline" | null;
  status_updated_at: Date | null;
  last_telemetry_at: Date | null;
  temp_c: number | null;
  hum_pct: number | null;
  rssi: number | null;
}

export class ViewsService {
  async getLastTelemetry(): Promise<LastTelemetry[]> {
    const pool = getPool();
    const result = await pool.query<LastTelemetry>(
      "SELECT * FROM estufa.vw_ambient_last_telemetry ORDER BY sensor_id"
    );
    return result.rows;
  }

  async getLastTelemetryBySensorId(sensorId: number): Promise<LastTelemetry | null> {
    const pool = getPool();
    const result = await pool.query<LastTelemetry>(
      "SELECT * FROM estufa.vw_ambient_last_telemetry WHERE sensor_id = $1",
      [sensorId]
    );
    return result.rows[0] || null;
  }

  async getSensorOverview(): Promise<SensorOverview[]> {
    const pool = getPool();
    const result = await pool.query<SensorOverview>(
      "SELECT * FROM estufa.vw_ambient_sensor_overview ORDER BY sensor_id"
    );
    return result.rows;
  }

  async getSensorOverviewByGreenhouseId(greenhouseId: number): Promise<SensorOverview[]> {
    const pool = getPool();
    const result = await pool.query<SensorOverview>(
      "SELECT * FROM estufa.vw_ambient_sensor_overview WHERE greenhouse_id = $1 ORDER BY sensor_id",
      [greenhouseId]
    );
    return result.rows;
  }

  async getOfflineAlerts(): Promise<OfflineAlert[]> {
    const pool = getPool();
    const result = await pool.query<OfflineAlert>(
      "SELECT * FROM estufa.vw_ambient_alert_offline_10m ORDER BY status_updated_at"
    );
    return result.rows;
  }
}
