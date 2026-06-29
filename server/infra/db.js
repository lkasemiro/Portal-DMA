/**
 * ============================================================
 * Portal Ambiental
 * Configuração PostgreSQL (Neon) - Versão ES Modules Definitiva
 * ============================================================
 */

import pg from "pg";
const { Pool } = pg;

if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL não definida.");
}

const usarSSL = process.env.NODE_ENV === "production" || process.env.DATABASE_URL.includes("neon.tech");

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: usarSSL ? { rejectUnauthorized: false } : false,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 15000
});

pool.on("error", (error) => {
    console.error("Erro inesperado no pool PostgreSQL:", error);
});

/**
 * Testa a conexão com o banco.
 */
async function testConnection() {
    const client = await pool.connect();
    try {
        await client.query("SELECT NOW()");
        console.log("✅ PostgreSQL conectado.");
    } catch (error) {
        console.error("❌ Erro ao conectar ao PostgreSQL:", error);
        throw error;
    } finally {
        client.release();
    }
}

/**
 * Executa uma consulta SQL.
 */
async function query(sql, params = []) {
    return pool.query(sql, params);
}

/**
 * Obtém um cliente para transações.
 */
async function getClient() {
    return pool.connect();
}

/**
 * Encerra o pool de conexões.
 */
async function close() {
    await pool.end();
    console.log("🔒 Pool PostgreSQL encerrado.");
}

// ÚNICO PONTO DE EXPORTAÇÃO DO ARQUIVO:
export {
    pool,
    testConnection,
    query,
    getClient,
    close
};