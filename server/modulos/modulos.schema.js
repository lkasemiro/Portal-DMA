// server/modulos/modulos.schema.js
import { pool } from "../database/db.js";

export async function initModulosSchema() {
  try {
    // 1. Garante que o schema 'portal' exista no banco Neon
    await pool.query(`CREATE SCHEMA IF NOT EXISTS portal;`);

    // 2. Cria a tabela oficial dentro do schema portal
    await pool.query(`
      CREATE TABLE IF NOT EXISTS portal.modulos (
        id SERIAL PRIMARY KEY,
        nome VARCHAR(100) NOT NULL,
        slug VARCHAR(50) UNIQUE NOT NULL,
        descricao TEXT,
        icone VARCHAR(50),
        cor VARCHAR(20) DEFAULT '#0b3d91',
        ativo BOOLEAN DEFAULT TRUE,
        criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 3. Semeia os dados iniciais caso a tabela esteja vazia (Seed)
    const { rowCount } = await pool.query("SELECT 1 FROM portal.modulos LIMIT 1");
    if (rowCount === 0) {
      await pool.query(`
        INSERT INTO portal.modulos (nome, slug, descricao, icone, cor) VALUES
        ('Combate ao Aedes', 'aedes', 'Módulo de monitoramento do Aedes Aegypti', 'bi-bug', '#e74c3c'),
        ('Recicla Cedae', 'recicla', 'Módulo de coleta seletiva e reciclagem', 'bi-recycle', '#2ecc71'),
        ('Informativos & Posts', 'posts', 'Módulo de avisos e administração de publicações', 'bi-newspaper', '#3498db');
      `);
      console.log("🌱 Módulos base do Portal DMA semeados com sucesso no schema portal.");
    }
  } catch (err) {
    console.error("❌ Erro crítico no initModulosSchema:", err.message);
  }
}