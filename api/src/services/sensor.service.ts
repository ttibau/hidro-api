import { getPool } from "../db/config";

export interface Sensor {
  id: number;
  greenhouse_id: number;
  device_key: string;
  sensor_type: string;
  name: string | null;
  created_at: Date;
}

export interface CreateSensorDto {
  greenhouse_id: number;
  device_key: string;
  sensor_type: string;
  name?: string;
}

export interface UpdateSensorDto {
  greenhouse_id?: number;
  device_key?: string;
  sensor_type?: string;
  name?: string;
}

export class SensorService {
  async findAll(): Promise<Sensor[]> {
    const pool = getPool();
    const result = await pool.query<Sensor>(
      "SELECT id, greenhouse_id, device_key, sensor_type, name, created_at FROM estufa.sensor ORDER BY id"
    );
    return result.rows;
  }

  async findById(id: number): Promise<Sensor | null> {
    const pool = getPool();
    const result = await pool.query<Sensor>(
      "SELECT id, greenhouse_id, device_key, sensor_type, name, created_at FROM estufa.sensor WHERE id = $1",
      [id]
    );
    return result.rows[0] || null;
  }

  async findByGreenhouseId(greenhouseId: number): Promise<Sensor[]> {
    const pool = getPool();
    const result = await pool.query<Sensor>(
      "SELECT id, greenhouse_id, device_key, sensor_type, name, created_at FROM estufa.sensor WHERE greenhouse_id = $1 ORDER BY id",
      [greenhouseId]
    );
    return result.rows;
  }

  async findByDeviceKey(deviceKey: string): Promise<Sensor | null> {
    const pool = getPool();
    const result = await pool.query<Sensor>(
      "SELECT id, greenhouse_id, device_key, sensor_type, name, created_at FROM estufa.sensor WHERE device_key = $1",
      [deviceKey]
    );
    return result.rows[0] || null;
  }

  async create(data: CreateSensorDto): Promise<Sensor> {
    const pool = getPool();
    const result = await pool.query<Sensor>(
      "INSERT INTO estufa.sensor (greenhouse_id, device_key, sensor_type, name) VALUES ($1, $2, $3, $4) RETURNING id, greenhouse_id, device_key, sensor_type, name, created_at",
      [data.greenhouse_id, data.device_key, data.sensor_type, data.name || null]
    );
    return result.rows[0];
  }

  async update(id: number, data: UpdateSensorDto): Promise<Sensor | null> {
    const pool = getPool();
    
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (data.greenhouse_id !== undefined) {
      updates.push(`greenhouse_id = $${paramCount++}`);
      values.push(data.greenhouse_id);
    }
    if (data.device_key !== undefined) {
      updates.push(`device_key = $${paramCount++}`);
      values.push(data.device_key);
    }
    if (data.sensor_type !== undefined) {
      updates.push(`sensor_type = $${paramCount++}`);
      values.push(data.sensor_type);
    }
    if (data.name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      values.push(data.name);
    }

    if (updates.length === 0) {
      return this.findById(id);
    }

    values.push(id);
    const result = await pool.query<Sensor>(
      `UPDATE estufa.sensor SET ${updates.join(", ")} WHERE id = $${paramCount} RETURNING id, greenhouse_id, device_key, sensor_type, name, created_at`,
      values
    );
    return result.rows[0] || null;
  }

  async delete(id: number): Promise<boolean> {
    const pool = getPool();
    const result = await pool.query(
      "DELETE FROM estufa.sensor WHERE id = $1",
      [id]
    );
    return (result.rowCount ?? 0) > 0;
  }
}
