// server/database/queries.js
import { pool } from "../infra/db.js";

/**
 * Executa uma consulta SQL genérica (útil para comandos que não retornam linhas específicas).
 */
export async function execute(sql, params = []) {
    return pool.query(sql, params);
}

/**
 * Executa uma consulta SQL e retorna apenas o primeiro registro encontrado ou null.
 */
export async function findOne(sql, params = []) {
    const result = await pool.query(sql, params);
    return result.rows[0] || null;
}

/**
 * Executa uma consulta SQL e retorna todas as linhas encontradas em um Array.
 */
export async function findAll(sql, params = []) {
    const result = await pool.query(sql, params);
    return result.rows;
}

/**
 * Executa um comando INSERT e retorna o registro recém-criado.
 * Certifique-se de usar a cláusula RETURNING na sua query SQL (ex: RETURNING *).
 */
export async function insert(sql, params = []) {
    const result = await pool.query(sql, params);
    return result.rows[0];
}

/**
 * Executa um comando UPDATE e retorna o registro alterado.
 * Certifique-se de usar a cláusula RETURNING na sua query SQL.
 */
export async function update(sql, params = []) {
    const result = await pool.query(sql, params);
    return result.rows[0];
}

/**
 * Executa um comando DELETE e retorna a quantidade de linhas afetadas.
 */
export async function remove(sql, params = []) {
    const result = await pool.query(sql, params);
    return result.rowCount;
}

/**
 * Executa um conjunto de operações isoladas dentro de uma Transação SQL (BEGIN/COMMIT/ROLLBACK).
 * O callback recebe o 'client' dedicado que deve ser usado para executar as queries da transação.
 * * Exemplo de uso:
 * await transaction(async (client) => {
 * await client.query('INSERT INTO...', [dados1]);
 * await client.query('UPDATE...', [dados2]);
 * });
 */
export async function transaction(callback) {
    // Obtém um cliente exclusivo do pool para a transação
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        // Executa as funções passadas no callback utilizando o cliente isolado
        const result = await callback(client);

        await client.query("COMMIT");
        return result;
    } catch (error) {
        await client.query("ROLLBACK");
        console.error("❌ Transação abortada e Rollback executado:", error.message);
        throw error;
    } finally {
        // Libera o cliente de volta para o pool obrigatoriamente
        client.release();
    }
}