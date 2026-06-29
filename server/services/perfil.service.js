/**
 * ============================================================
 * Portal Ambiental
 * Serviço de Perfis
 * ============================================================
 *
 * Responsável pelas operações da tabela auth.perfis.
 */

import { pool } from "../infra/db.js";

/**
 * Busca um perfil pelo user_id do Neon Auth.
 */
async function buscarPorUserId(userId) {

    const sql = `
        SELECT
            p.id,
            p.user_id,
            p.matricula,
            p.nome,
            p.email,
            p.email_corporativo,
            p.telefone,
            p.cargo_id,
            c.nome AS cargo,
            p.setor,
            p.ativo,
            p.ultimo_login,
            p.observacoes,
            p.created_at,
            p.updated_at
        FROM auth.perfis p
        LEFT JOIN auth.cargos c
            ON c.id = p.cargo_id
        WHERE p.user_id = $1
        LIMIT 1
    `;

    const result = await db.query(sql, [userId]);

    return result.rows[0] || null;

}

/**
 * Busca um perfil pelo código interno.
 */
async function buscarPorCodigo(id) {

    const sql = `
        SELECT
            p.*,
            c.nome AS cargo
        FROM auth.perfis p
        LEFT JOIN auth.cargos c
            ON c.id = p.cargo_id
        WHERE p.id = $1
        LIMIT 1
    `;

    const result = await db.query(sql, [id]);

    return result.rows[0] || null;

}

/**
 * Lista todos os usuários.
 */
async function listarPerfis() {

    const sql = `
        SELECT
            p.id,
            p.nome,
            p.email,
            p.email_corporativo,
            c.nome AS cargo,
            p.setor,
            p.ativo,
            p.ultimo_login
        FROM auth.perfis p
        LEFT JOIN auth.cargos c
            ON c.id = p.cargo_id
        ORDER BY p.nome
    `;

    const result = await db.query(sql);

    return result.rows;

}

/**
 * Cria um novo perfil.
 */
async function criarPerfil(dados) {

    const sql = `
        INSERT INTO auth.perfis (

            user_id,
            matricula,
            nome,
            email,
            email_corporativo,
            telefone,
            cargo_id,
            setor,
            ativo,
            observacoes

        )

        VALUES (

            $1,$2,$3,$4,$5,
            $6,$7,$8,true,$9

        )

        RETURNING *

    `;

    const params = [

        dados.user_id,
        dados.matricula,
        dados.nome,
        dados.email,
        dados.email_corporativo,
        dados.telefone,
        dados.cargo_id,
        dados.setor,
        dados.observacoes || null

    ];

    const result = await db.query(sql, params);

    return result.rows[0];

}

/**
 * Atualiza o último login.
 */
async function atualizarUltimoLogin(userId) {

    const sql = `

        UPDATE auth.perfis

        SET

            ultimo_login = NOW(),

            updated_at = NOW()

        WHERE user_id = $1

    `;

    await db.query(sql, [userId]);

}

/**
 * Ativa ou desativa um usuário.
 */
async function alterarStatus(userId, ativo) {

    const sql = `

        UPDATE auth.perfis

        SET

            ativo = $2,

            updated_at = NOW()

        WHERE user_id = $1

        RETURNING *

    `;

    const result = await db.query(sql, [

        userId,

        ativo

    ]);

    return result.rows[0];

}

/**
 * Atualiza informações cadastrais.
 */
async function atualizarPerfil(userId, dados) {

    const sql = `

        UPDATE auth.perfis

        SET

            nome = $2,

            telefone = $3,

            cargo_id = $4,

            setor = $5,

            observacoes = $6,

            updated_at = NOW()

        WHERE user_id = $1

        RETURNING *

    `;

    const result = await db.query(sql, [

        userId,

        dados.nome,

        dados.telefone,

        dados.cargo_id,

        dados.setor,

        dados.observacoes

    ]);

    return result.rows[0];

}

/**
 * Remove definitivamente um perfil.
 */
async function removerPerfil(userId) {

    const sql = `

        DELETE

        FROM auth.perfis

        WHERE user_id = $1

    `;

    const result = await db.query(sql, [userId]);

    return result.rowCount;

}

module.exports = {

    buscarPorUserId,

    buscarPorCodigo,

    listarPerfis,

    criarPerfil,

    atualizarUltimoLogin,

    alterarStatus,

    atualizarPerfil,

    removerPerfil

};