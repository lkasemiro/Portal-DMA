/**
 * ============================================================
 * Portal Ambiental
 * Service de Módulos (Neon Postgres)
 * ============================================================
 *
 * Responsável pelas consultas SQL no banco de dados Postgres (Neon)
 * para a tabela de módulos.
 */

// Importa a pool de conexão com o Neon (veja o passo 2 abaixo)
const pool = require("../config/db");

/**
 * ============================================================
 * Lista todos os módulos do sistema.
 * * @returns {Promise<Array>} Lista de módulos
 * ============================================================
 */
async function listar() {
    const query = `
        SELECT id, codigo, nome, ativo, descricao 
        FROM modulos 
        ORDER BY nome ASC;
    `;
    
    const { rows } = await pool.query(query);
    return rows;
}

/**
 * ============================================================
 * Busca um módulo específico pelo código identificador.
 * * @param {string} codigo - O código do módulo (ex: 'flora')
 * @returns {Promise<Object|null>} Objeto do módulo ou null
 * ============================================================
 */
async function obter(codigo) {
    const query = `
        SELECT id, codigo, nome, ativo, descricao 
        FROM modulos 
        WHERE LOWER(codigo) = LOWER($1);
    `;
    
    const { rows } = await pool.query(query, [codigo]);
    
    // Retorna o primeiro registro encontrado ou null se estiver vazio
    return rows[0] || null;
}

/**
 * ============================================================
 * Lista apenas os módulos que estão com status ativo.
 * * @returns {Promise<Array>} Lista de módulos ativos
 * ============================================================
 */
async function listarAtivos() {
    const query = `
        SELECT id, codigo, nome, ativo, descricao 
        FROM modulos 
        WHERE ativo = true 
        ORDER BY nome ASC;
    `;
    
    const { rows } = await pool.query(query);
    return rows;
}

module.exports = {
    listar,
    obter,
    listarAtivos
};