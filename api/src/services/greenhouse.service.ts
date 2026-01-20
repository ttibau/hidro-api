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
}
