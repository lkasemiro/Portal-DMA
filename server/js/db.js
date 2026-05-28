// vai deixar de existir: frontend nao deve acessar o banco diretamente


import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL não configurada no arquivo .env.");
}

export const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

pool.on("error", (error) => {
  console.error("Erro inesperado no pool do PostgreSQL:", error);
});

export async function query(text, params = []) {
  try {
    return await pool.query(text, params);
  } catch (error) {
    console.error("Erro na query PostgreSQL:", {
      text,
      params,
      message: error.message
    });
    throw error;
  }
}

export async function getClient() {
  return pool.connect();
}

export async function testConnection() {
  const result = await query(
    `
    select
      now() as server_time,
      current_database() as database_name,
      current_user as database_user
    `
  );

  return result.rows[0];
}

export async function withTransaction(callback) {
  const client = await getClient();

  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function closePool() {
  await pool.end();
}