import { pool } from "../database/db.js";

export async function initSchema() {
    try {
        // Criar Schema
        await pool.query(`CREATE SCHEMA IF NOT EXISTS aedes;`);

        // Tabela de Lotes
        await pool.query(`
            CREATE TABLE IF NOT EXISTS aedes.lotes (
                id               SERIAL PRIMARY KEY,
                focal_nome       TEXT,
                payload_completo JSONB,
                total_registros  INTEGER, 
                data_envio       TIMESTAMP DEFAULT NOW()
            );
        `);

        // Tabela de Itens de Vistoria
        await pool.query(`
            CREATE TABLE IF NOT EXISTS aedes.vistorias_itens (
                id                            SERIAL PRIMARY KEY,
                lote_id                       INTEGER REFERENCES aedes.lotes(id) ON DELETE CASCADE,
                unidade_id                    TEXT, 
                unidade_nome                  TEXT,
                vistoria_realizada            TEXT,
                foco_encontrado               TEXT,
                foco_remediado                TEXT,
                motivos_nao_vistoria          JSONB,
                motivos_nao_remediacao        JSONB,
                locais_foco                   JSONB,
                observacoes                   TEXT,
                data_registro                 TIMESTAMP DEFAULT NOW(),
                outros_local                  TEXT,
                outros_motivos_nao_vistoria   TEXT,
                outros_motivos_nao_remediacao TEXT,
                id_referencia                 TEXT UNIQUE
            );
        `);
      
        // Tabela Fato (Data Warehouse Local)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS aedes.fato_vistorias (
                id                            SERIAL PRIMARY KEY,
                lote_id                       INTEGER REFERENCES aedes.lotes(id) ON DELETE CASCADE,
                origem                        TEXT DEFAULT 'Portal',
                ano                           INTEGER,
                mes                           INTEGER,
                semana                        INTEGER,
                unidade_id                    TEXT, 
                unidade_nome                  TEXT,
                vistoria_realizada            TEXT,
                foco_encontrado               TEXT,
                foco_remediado                TEXT,
                motivos_nao_vistoria          TEXT,
                motivos_nao_remediacao        TEXT,
                locais_foco                   TEXT,
                observacoes                   TEXT,
                data_registro                 TIMESTAMP DEFAULT NOW(),
                outros_locais_foco            TEXT,
                outros_motivos_nao_vistoria   TEXT,
                outros_motivos_nao_remediacao TEXT,
                id_referencia                 TEXT UNIQUE
            );
        `);

        // Tabela de Focais
        await pool.query(`
            CREATE TABLE IF NOT EXISTS aedes.focais (
                focal_pk BIGSERIAL PRIMARY KEY,
                matricula TEXT,
                nome TEXT NOT NULL,
                email TEXT UNIQUE,
                ativo BOOLEAN DEFAULT true
            );
        `);

        // Relacionamento Focal x Unidade
        await pool.query(`
            CREATE TABLE IF NOT EXISTS aedes.focal_unidade (
                focal_unidade_pk BIGSERIAL PRIMARY KEY,
                focal_pk         BIGINT REFERENCES aedes.focais(focal_pk) ON DELETE CASCADE,
                unidade_id       BIGINT,
                ativo            BOOLEAN DEFAULT true,
                data_inicio      TIMESTAMP DEFAULT NOW()
            );
        `);

        // View Analítica de Resumo
        await pool.query(`
            CREATE OR REPLACE VIEW aedes.vw_resumo_aedes AS
            SELECT 
                COUNT(*) AS total_registros,
                COUNT(CASE WHEN LOWER(TRIM(vistoria_realizada)) = 'sim' THEN 1 END) AS total_vistorias,
                COUNT(CASE WHEN LOWER(TRIM(foco_encontrado)) = 'sim' THEN 1 END) AS total_focos,
                COUNT(CASE WHEN LOWER(TRIM(foco_encontrado)) = 'sim' AND LOWER(TRIM(foco_remediado)) = 'sim' THEN 1 END) AS total_remediados
            FROM aedes.fato_vistorias;
        `);

    } catch (err) {
        console.error("❌ Erro ao inicializar banco de dados (Aedes Schema):", err.message);
        throw err;
    }
}