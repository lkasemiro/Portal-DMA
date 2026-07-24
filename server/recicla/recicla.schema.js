import { pool } from "../database/db.js";

/**
 * Inicializa a estrutura física do módulo Recicla Cedae Fase 2 -- ANTIFO DB-RECICLA.JS
 */
export async function initReciclaSchema() {
  try {
    // 1. Criação do Schema Isolado
    await pool.query(`CREATE SCHEMA IF NOT EXISTS recicla;`);

    // 2. Tabela de Cadastro de Participantes
    await pool.query(`
      CREATE TABLE IF NOT EXISTS recicla.recicla2_cadastro (
        id            INTEGER PRIMARY KEY,
        nome          VARCHAR(150) NOT NULL,
        diretoria     VARCHAR(100),
        email         VARCHAR(150) UNIQUE,
        data_cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        local         VARCHAR(50)
      );
    `);

    // 3. Tabela Fato de Pesagens
    await pool.query(`
      CREATE TABLE IF NOT EXISTS recicla.recicla2_pesagens (
        id              SERIAL PRIMARY KEY,
        participante_id INTEGER NOT NULL REFERENCES recicla.recicla2_cadastro(id) ON DELETE CASCADE,
        pesagem         NUMERIC(10, 2) NOT NULL,
        data_pesagem    DATE NOT NULL,
        CONSTRAINT uk_pesagem UNIQUE (participante_id, data_pesagem, pesagem)
      );
    `);

    // 4. Índices de Otimização de Performance
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_recicla2_pesagens_participante ON recicla.recicla2_pesagens(participante_id);`);

    console.log("✅ Estrutura física do Schema 'recicla' validada com sucesso.");
  } catch (err) {
    console.error("❌ Erro crítico no initReciclaSchema:", err.message);
  }
}