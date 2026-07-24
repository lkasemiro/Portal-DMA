import { pool } from "../database/db.js";

/**
 * Inicializa a estrutura física do módulo de Posts e Administração de Focais
 */
export async function initPostsSchema() {
  try {
    // 1. Tabela de Usuários Focais / Técnicos autorizados a postar e gerenciar
    await pool.query(`
      CREATE TABLE IF NOT EXISTS portal_focais (
        id SERIAL PRIMARY KEY,
        nome VARCHAR(150) NOT NULL,
        email VARCHAR(150) UNIQUE NOT NULL,
        funcao VARCHAR(50) DEFAULT 'Tecnico', -- 'Admin', 'Tecnico', 'Focal'
        ativo BOOLEAN DEFAULT TRUE,
        data_cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Tabela de Publicações (Notícias/Comunicados)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS portal_posts (
        id SERIAL PRIMARY KEY,
        titulo VARCHAR(255) NOT NULL,
        conteudo TEXT NOT NULL,
        resumo VARCHAR(500),
        imagem_url TEXT,
        autor_id INTEGER REFERENCES portal_focais(id) ON DELETE SET NULL,
        data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        data_atualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log("✅ Estrutura física do módulo 'Posts e Focais' validada com sucesso.");
  } catch (err) {
    console.error("❌ Erro crítico no initPostsSchema:", err.message);
  }
}