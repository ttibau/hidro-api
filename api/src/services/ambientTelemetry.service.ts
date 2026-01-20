import { getPool } from "../db/config";

export interface Telemetry {
  id: number;
  sensor_id: number;
  received_at: Date;
  temp_c: number | null;
  hum_pct: number | null;
  rssi: number | null;
  uptime_s: number | null;
  raw: any;
}

export interface CreateTelemetryDto {
  sensor_id: number;
  temp_c?: number;
  hum_pct?: number;
  rssi?: number;
  uptime_s?: number;
  raw: any;
}

export interface TelemetryFilters {
  sensor_id?: number;
  start_date?: string;
  end_date?: string;
  limit?: number;
  offset?: number;
}

export class TelemetryService {
  async findAll(filters?: TelemetryFilters): Promise<Telemetry[]> {
    const pool = getPool();
    
    let query = "SELECT id, sensor_id, received_at, temp_c, hum_pct, rssi, uptime_s, raw FROM estufa.telemetry WHERE 1=1";
    const values: any[] = [];
    let paramCount = 1;

    if (filters?.sensor_id) {
      query += ` AND sensor_id = $${paramCount++}`;
      values.push(filters.sensor_id);
    }

    if (filters?.start_date) {
      query += ` AND received_at >= $${paramCount++}`;
      values.push(filters.start_date);
    }

    if (filters?.end_date) {
      query += ` AND received_at <= $${paramCount++}`;
      values.push(filters.end_date);
    }

    query += " ORDER BY received_at DESC";

    if (filters?.limit) {
      query += ` LIMIT $${paramCount++}`;
      values.push(filters.limit);
    } else {
      query += " LIMIT 100";
    }

    if (filters?.offset) {
      query += ` OFFSET $${paramCount++}`;
      values.push(filters.offset);
    }

    const result = await pool.query<Telemetry>(query, values);
    return result.rows;
  }

  async findById(id: number): Promise<Telemetry | null> {
    const pool = getPool();
    const result = await pool.query<Telemetry>(
      "SELECT id, sensor_id, received_at, temp_c, hum_pct, rssi, uptime_s, raw FROM estufa.telemetry WHERE id = $1",
      [id]
    );
    return result.rows[0] || null;
  }

  async findBySensorId(sensorId: number, limit: number = 100): Promise<Telemetry[]> {
    const pool = getPool();
    const result = await pool.query<Telemetry>(
      "SELECT id, sensor_id, received_at, temp_c, hum_pct, rssi, uptime_s, raw FROM estufa.telemetry WHERE sensor_id = $1 ORDER BY received_at DESC LIMIT $2",
      [sensorId, limit]
    );
    return result.rows;
  }

  async create(data: CreateTelemetryDto): Promise<Telemetry> {
    const pool = getPool();
    // pg aceita objetos JavaScript diretamente para JSONB
    const result = await pool.query<Telemetry>(
      "INSERT INTO estufa.telemetry (sensor_id, temp_c, hum_pct, rssi, uptime_s, raw) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, sensor_id, received_at, temp_c, hum_pct, rssi, uptime_s, raw",
      [data.sensor_id, data.temp_c || null, data.hum_pct || null, data.rssi || null, data.uptime_s || null, data.raw]
    );
    return result.rows[0];
  }

  async delete(id: number): Promise<boolean> {
    const pool = getPool();
    const result = await pool.query(
      "DELETE FROM estufa.telemetry WHERE id = $1",
      [id]
    );
    return (result.rowCount ?? 0) > 0;
  }

  async deleteBySensorId(sensorId: number): Promise<number> {
    const pool = getPool();
    const result = await pool.query(
      "DELETE FROM estufa.telemetry WHERE sensor_id = $1",
      [sensorId]
    );
    return result.rowCount ?? 0;
  }
}

// Manter compatibilidade com código antigo
export { TelemetryService as AmbientTelemetryService };
export type { Telemetry as AmbientTelemetry };
export type { CreateTelemetryDto as CreateAmbientTelemetryDto };
export type { TelemetryFilters as AmbientTelemetryFilters };
