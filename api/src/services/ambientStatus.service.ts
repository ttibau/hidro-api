import { getPool } from "../db/config";

export interface AmbientStatus {
  sensor_id: number;
  status: "online" | "offline";
  updated_at: Date;
}

export interface CreateOrUpdateAmbientStatusDto {
  sensor_id: number;
  status: "online" | "offline";
}

export class AmbientStatusService {
  async findAll(): Promise<AmbientStatus[]> {
    const pool = getPool();
    const result = await pool.query<AmbientStatus>(
      "SELECT sensor_id, status, updated_at FROM estufa.ambient_status ORDER BY updated_at DESC"
    );
    return result.rows;
  }

  async findBySensorId(sensorId: number): Promise<AmbientStatus | null> {
    const pool = getPool();
    const result = await pool.query<AmbientStatus>(
      "SELECT sensor_id, status, updated_at FROM estufa.ambient_status WHERE sensor_id = $1",
      [sensorId]
    );
    return result.rows[0] || null;
  }

  async createOrUpdate(data: CreateOrUpdateAmbientStatusDto): Promise<AmbientStatus> {
    const pool = getPool();
    const result = await pool.query<AmbientStatus>(
      `INSERT INTO estufa.ambient_status (sensor_id, status, updated_at) 
       VALUES ($1, $2, now()) 
       ON CONFLICT (sensor_id) 
       DO UPDATE SET status = $2, updated_at = now() 
       RETURNING sensor_id, status, updated_at`,
      [data.sensor_id, data.status]
    );
    return result.rows[0];
  }

  async update(sensorId: number, status: "online" | "offline"): Promise<AmbientStatus | null> {
    const pool = getPool();
    const result = await pool.query<AmbientStatus>(
      "UPDATE estufa.ambient_status SET status = $1, updated_at = now() WHERE sensor_id = $2 RETURNING sensor_id, status, updated_at",
      [status, sensorId]
    );
    return result.rows[0] || null;
  }

  async delete(sensorId: number): Promise<boolean> {
    const pool = getPool();
    const result = await pool.query(
      "DELETE FROM estufa.ambient_status WHERE sensor_id = $1",
      [sensorId]
    );
    return (result.rowCount ?? 0) > 0;
  }
}
