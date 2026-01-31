import { getPool } from "../db/config";

export interface Greenhouse {
  id: number;
  name: string;
  location: string | null;
  created_at: Date;
}

export interface CreateGreenhouseDto {
  name: string;
  location?: string;
}

export interface UpdateGreenhouseDto {
  name?: string;
  location?: string;
}

export interface SensorWithDetails {
  id: number;
  greenhouse_id: number;
  device_key: string;
  sensor_type: string;
  name: string | null;
  created_at: Date;
  status: "ATIVO" | "ATRASADO" | "OFFLINE" | null;
  status_updated_at: Date | null;
  last_telemetry_at: Date | null;
  temp_c: number | null;
  hum_pct: number | null;
  rssi: number | null;
  ph: number | null;
  tds: number | null;
}

export class GreenhouseService {
  async findAll(): Promise<Greenhouse[]> {
    const pool = getPool();
    const result = await pool.query<Greenhouse>(
      "SELECT id, name, location, created_at FROM estufa.greenhouse ORDER BY id"
    );
    return result.rows;
  }

  async findById(id: number): Promise<Greenhouse | null> {
    const pool = getPool();
    const result = await pool.query<Greenhouse>(
      "SELECT id, name, location, created_at FROM estufa.greenhouse WHERE id = $1",
      [id]
    );
    return result.rows[0] || null;
  }

  async create(data: CreateGreenhouseDto): Promise<Greenhouse> {
    const pool = getPool();
    const result = await pool.query<Greenhouse>(
      "INSERT INTO estufa.greenhouse (name, location) VALUES ($1, $2) RETURNING id, name, location, created_at",
      [data.name, data.location || null]
    );
    return result.rows[0];
  }

  async update(id: number, data: UpdateGreenhouseDto): Promise<Greenhouse | null> {
    const pool = getPool();
    
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (data.name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      values.push(data.name);
    }
    if (data.location !== undefined) {
      updates.push(`location = $${paramCount++}`);
      values.push(data.location);
    }

    if (updates.length === 0) {
      return this.findById(id);
    }

    values.push(id);
    const result = await pool.query<Greenhouse>(
      `UPDATE estufa.greenhouse SET ${updates.join(", ")} WHERE id = $${paramCount} RETURNING id, name, location, created_at`,
      values
    );
    return result.rows[0] || null;
  }

  async delete(id: number): Promise<boolean> {
    const pool = getPool();
    const result = await pool.query(
      "DELETE FROM estufa.greenhouse WHERE id = $1",
      [id]
    );
    return (result.rowCount ?? 0) > 0;
  }

  // Buscar sensores de uma estufa com dados completos
  async getSensorsWithDetails(greenhouseId: number): Promise<SensorWithDetails[]> {
    const pool = getPool();
    
    // Buscar dados usando tabela telemetry (híbrida) e status lógico
    const result = await pool.query(`
      SELECT 
        s.id,
        s.greenhouse_id,
        s.device_key,
        s.sensor_type,
        s.name,
        s.created_at,
        estufa.get_sensor_status(s.last_seen_at, s.expected_interval_s) AS status,
        s.last_seen_at AS status_updated_at,
        t.received_at AS last_telemetry_at,
        t.temp_c,
        t.hum_pct,
        t.rssi,
        t.ph,
        t.tds
      FROM estufa.sensor s
      LEFT JOIN LATERAL (
        SELECT received_at, temp_c, hum_pct, rssi, ph, tds
        FROM estufa.telemetry
        WHERE sensor_id = s.id
        ORDER BY received_at DESC
        LIMIT 1
      ) t ON true
      WHERE s.greenhouse_id = $1
      ORDER BY s.id
    `, [greenhouseId]);

    return result.rows.map((row) => ({
      id: row.id,
      greenhouse_id: row.greenhouse_id,
      device_key: row.device_key,
      sensor_type: row.sensor_type,
      name: row.name,
      created_at: row.created_at,
      status: row.status,
      status_updated_at: row.status_updated_at,
      last_telemetry_at: row.last_telemetry_at,
      temp_c: row.temp_c,
      hum_pct: row.hum_pct,
      rssi: row.rssi,
      ph: row.ph,
      tds: row.tds,
    }));
  }
}
