// server/database/queries.js
import { pool } from "../infra/db.js";

export async function execute(sql, params = []) {
    return pool.query(sql, params);
}

export async function findOne(sql, params = []) {
    const result = await pool.query(sql, params);
    return result.rows[0] || null;
}

export async function findAll(sql, params = []) {
    const result = await pool.query(sql, params);
    return result.rows;
}

// ... faça o mesmo adicionando "export" antes de insert, update, remove e transaction

/**
 * Executa INSERT retornando o registro criado.
 */
async function insert(sql, params = []) {

    const result = await db.query(sql, params);

    return result.rows[0];

}

/**
 * Executa UPDATE retornando o registro alterado.
 */
async function update(sql, params = []) {

    const result = await db.query(sql, params);

    return result.rows[0];

}

/**
 * Executa DELETE.
 */
async function remove(sql, params = []) {

    const result = await db.query(sql, params);

    return result.rowCount;

}

/**
 * Executa uma transação.
 */
async function transaction(callback) {

    const client = await db.getClient();

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

module.exports = {

    execute,

    findOne,

    findAll,

    insert,

    update,

    remove,

    transaction

};