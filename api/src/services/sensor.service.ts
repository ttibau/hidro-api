import { getPool } from "../db/config";

export type SensorStatus = "ATIVO" | "ATRASADO" | "OFFLINE";

export interface Sensor {
  id: number;
  greenhouse_id: number;
  device_key: string;
  sensor_type: string;
  name: string | null;
  expected_interval_s: number;
  last_seen_at: Date | null;
  created_at: Date;
}

export interface SensorWithStatus extends Sensor {
  status: SensorStatus;
  last_temp_c?: number | null;
  last_hum_pct?: number | null;
  last_rssi?: number | null;
  last_uptime_s?: number | null;
  last_received_at?: Date | null;
}

export interface CreateSensorDto {
  greenhouse_id: number;
  device_key: string;
  sensor_type: string;
  name?: string;
  expected_interval_s?: number;
}

export interface UpdateSensorDto {
  greenhouse_id?: number;
  device_key?: string;
  sensor_type?: string;
  name?: string;
  expected_interval_s?: number;
}

export class SensorService {
  /**
   * Valida o valor de expected_interval_s
   */
  private validateExpectedInterval(interval: number): void {
    if (interval < 60 || interval > 86400) {
      throw new Error("expected_interval_s deve estar entre 60 e 86400 segundos");
    }
  }

  /**
   * Lista todos os sensores com status lógico e última telemetria
   */
  async findAll(): Promise<SensorWithStatus[]> {
    const pool = getPool();
    const result = await pool.query<SensorWithStatus>(
      `SELECT 
        s.id, 
        s.greenhouse_id, 
        s.device_key, 
        s.sensor_type, 
        s.name,
        s.expected_interval_s,
        s.last_seen_at,
        s.created_at,
        get_sensor_status(s.last_seen_at, s.expected_interval_s) as status,
        t.temp_c as last_temp_c,
        t.hum_pct as last_hum_pct,
        t.rssi as last_rssi,
        t.uptime_s as last_uptime_s,
        t.received_at as last_received_at
      FROM estufa.sensor s
      LEFT JOIN LATERAL (
        SELECT temp_c, hum_pct, rssi, uptime_s, received_at
        FROM estufa.telemetry
        WHERE sensor_id = s.id
        ORDER BY received_at DESC
        LIMIT 1
      ) t ON true
      ORDER BY s.id`
    );
    return result.rows;
  }

  /**
   * Busca um sensor por ID com status e última telemetria
   */
  async findById(id: number): Promise<SensorWithStatus | null> {
    const pool = getPool();
    const result = await pool.query<SensorWithStatus>(
      `SELECT 
        s.id, 
        s.greenhouse_id, 
        s.device_key, 
        s.sensor_type, 
        s.name,
        s.expected_interval_s,
        s.last_seen_at,
        s.created_at,
        get_sensor_status(s.last_seen_at, s.expected_interval_s) as status,
        t.temp_c as last_temp_c,
        t.hum_pct as last_hum_pct,
        t.rssi as last_rssi,
        t.uptime_s as last_uptime_s,
        t.received_at as last_received_at
      FROM estufa.sensor s
      LEFT JOIN LATERAL (
        SELECT temp_c, hum_pct, rssi, uptime_s, received_at
        FROM estufa.telemetry
        WHERE sensor_id = s.id
        ORDER BY received_at DESC
        LIMIT 1
      ) t ON true
      WHERE s.id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * Busca sensores por estufa com status e última telemetria
   */
  async findByGreenhouseId(greenhouseId: number): Promise<SensorWithStatus[]> {
    const pool = getPool();
    const result = await pool.query<SensorWithStatus>(
      `SELECT 
        s.id, 
        s.greenhouse_id, 
        s.device_key, 
        s.sensor_type, 
        s.name,
        s.expected_interval_s,
        s.last_seen_at,
        s.created_at,
        get_sensor_status(s.last_seen_at, s.expected_interval_s) as status,
        t.temp_c as last_temp_c,
        t.hum_pct as last_hum_pct,
        t.rssi as last_rssi,
        t.uptime_s as last_uptime_s,
        t.received_at as last_received_at
      FROM estufa.sensor s
      LEFT JOIN LATERAL (
        SELECT temp_c, hum_pct, rssi, uptime_s, received_at
        FROM estufa.telemetry
        WHERE sensor_id = s.id
        ORDER BY received_at DESC
        LIMIT 1
      ) t ON true
      WHERE s.greenhouse_id = $1
      ORDER BY s.id`,
      [greenhouseId]
    );
    return result.rows;
  }

  /**
   * Busca sensor por device_key com status e última telemetria
   */
  async findByDeviceKey(deviceKey: string): Promise<SensorWithStatus | null> {
    const pool = getPool();
    const result = await pool.query<SensorWithStatus>(
      `SELECT 
        s.id, 
        s.greenhouse_id, 
        s.device_key, 
        s.sensor_type, 
        s.name,
        s.expected_interval_s,
        s.last_seen_at,
        s.created_at,
        get_sensor_status(s.last_seen_at, s.expected_interval_s) as status,
        t.temp_c as last_temp_c,
        t.hum_pct as last_hum_pct,
        t.rssi as last_rssi,
        t.uptime_s as last_uptime_s,
        t.received_at as last_received_at
      FROM estufa.sensor s
      LEFT JOIN LATERAL (
        SELECT temp_c, hum_pct, rssi, uptime_s, received_at
        FROM estufa.telemetry
        WHERE sensor_id = s.id
        ORDER BY received_at DESC
        LIMIT 1
      ) t ON true
      WHERE s.device_key = $1`,
      [deviceKey]
    );
    return result.rows[0] || null;
  }

  async create(data: CreateSensorDto): Promise<Sensor> {
    const pool = getPool();
    
    // Validar expected_interval_s se fornecido
    const expectedInterval = data.expected_interval_s || 3600;
    this.validateExpectedInterval(expectedInterval);

    const result = await pool.query<Sensor>(
      `INSERT INTO estufa.sensor (greenhouse_id, device_key, sensor_type, name, expected_interval_s) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id, greenhouse_id, device_key, sensor_type, name, expected_interval_s, last_seen_at, created_at`,
      [data.greenhouse_id, data.device_key, data.sensor_type, data.name || null, expectedInterval]
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
    if (data.expected_interval_s !== undefined) {
      this.validateExpectedInterval(data.expected_interval_s);
      updates.push(`expected_interval_s = $${paramCount++}`);
      values.push(data.expected_interval_s);
    }

    if (updates.length === 0) {
      return this.findById(id);
    }

    values.push(id);
    const result = await pool.query<Sensor>(
      `UPDATE estufa.sensor SET ${updates.join(", ")} WHERE id = $${paramCount} 
       RETURNING id, greenhouse_id, device_key, sensor_type, name, expected_interval_s, last_seen_at, created_at`,
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
