import { Pool } from "pg";

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    const databaseUrl = "postgresql://greenhouse_user:renzkzah8iyq@db-60354.dc-us-1.absamcloud.com:29355/greenhouse";
    
    if (!databaseUrl) {
      throw new Error("DATABASE_URL não está configurada no .env");
    }

    pool = new Pool({
      connectionString: databaseUrl,
      ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
    });

    pool.on("error", (err) => {
      console.error("Erro inesperado no pool do PostgreSQL:", err);
    });
  }

  return pool;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
