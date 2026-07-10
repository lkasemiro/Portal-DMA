// server/controllers/aedesController.js
import { pool } from "../infra/db.js";

/**
 * Inicialização do Schema e Tabelas do Aedes
 */
export async function initSchema() {
  try {
    await pool.query(`CREATE SCHEMA IF NOT EXISTS aedes;`);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS aedes.lotes (
        id               SERIAL PRIMARY KEY,
        focal_nome       TEXT,
        payload_completo JSONB,
        total_registros  INTEGER, 
        data_envio       TIMESTAMP DEFAULT NOW()
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS aedes.vistorias_itens (
        id                     SERIAL PRIMARY KEY,
        lote_id                INTEGER REFERENCES aedes.lotes(id) ON DELETE CASCADE,
        unidade_id             TEXT UNIQUE, 
        unidade_nome           TEXT,
        vistoria_realizada     TEXT,
        foco_encontrado        TEXT,
        foco_remediado         TEXT,
        motivos_nao_vistoria   JSONB,
        motivos_nao_remediacao JSONB,
        locais_foco            JSONB,
        observacoes            TEXT,
        data_registro          TIMESTAMP DEFAULT NOW(),
        outros_local           TEXT,
        outros_motivo_nao_vistoria TEXT,
        outros_motivo_nao_remediacao TEXT,
        id_referencia          TEXT UNIQUE
      );
    `);
  
    await pool.query(`
      CREATE TABLE IF NOT EXISTS aedes.focais (
        focal_pk BIGSERIAL PRIMARY KEY,
        matricula TEXT,
        nome TEXT NOT NULL,
        email TEXT UNIQUE,
        ativo BOOLEAN DEFAULT true
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS aedes.focal_unidade (
        focal_unidade_pk BIGSERIAL PRIMARY KEY,
        focal_pk         BIGINT REFERENCES aedes.focais(focal_pk) ON DELETE CASCADE,
        unidade_id       BIGINT, 
        ativo            BOOLEAN DEFAULT true,
        data_inicio      TIMESTAMP DEFAULT NOW()
      );
    `);

    console.log("✅ Tabelas aedes.lotes e aedes.focais verificadas.");
  } catch (err) {
    console.error("❌ Erro no initSchema do Aedes:", err.message);
  }
}

/**
 * GET /api/aedes/focais
 */
export async function getFocais(_req, res) {
  try {
    const result = await pool.query(`
      SELECT nome, email FROM aedes.focais 
      WHERE ativo = true ORDER BY nome ASC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Erro ao buscar lista de focais" });
  }
}

/**
 * GET /api/aedes/focais/lista
 */
export async function getFocaisLista(req, res) {
  try {
    const result = await pool.query(`
      SELECT 
        f.focal_pk, 
        f.matricula, 
        f.nome, 
        f.email,
        f.ativo,
        STRING_AGG(u.nome_unidade, ', ') AS focal_unidades
      FROM aedes.focais f
      LEFT JOIN aedes.focal_unidade fu ON f.focal_pk = fu.focal_pk
      LEFT JOIN aedes.unidades u ON fu.unidade_id = u.unidade_id
      WHERE f.ativo = true
      GROUP BY f.focal_pk, f.matricula, f.nome, f.email, f.ativo
      ORDER BY f.nome ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Erro em /focais/lista:", err.message);
    res.status(500).json({ error: "Erro ao buscar lista detalhada de focais." });
  }
}

/**
 * GET /api/aedes/focais/login
 */
export async function focalLogin(req, res) {
  try {
    const { email, matricula } = req.query;
    if (!email || !matricula) return res.status(400).json({ ok: false, error: "Dados incompletos." });

    const result = await pool.query(
      `SELECT focal, matricula, email, unidade 
       FROM aedes.stg_importacao_excel
       WHERE email = $1 AND CAST(matricula AS TEXT) = $2`,
      [email.trim(), String(matricula).trim()]
    );

    if (result.rows.length === 0) return res.status(401).json({ ok: false, error: "Credenciais inválidas." });

    res.json({ ok: true, nome: result.rows[0].focal, auth_type: "aedes_focal" });
  } catch (err) {
    res.status(500).json({ ok: false, error: "Erro no servidor." });
  }
}

/**
 * GET /api/aedes/base
 */
export async function getBase(req, res) {
  try {
    const { filtro } = req.query;

    let sql = `
      SELECT DISTINCT
        u.unidade_id AS id, 
        u.nome_unidade AS "Unidade", 
        f.matricula, 
        f.email,
        f.nome AS "focalNome"
      FROM aedes.unidades u
      INNER JOIN aedes.focal_unidade fu ON u.unidade_id = fu.unidade_id
      INNER JOIN aedes.focais f ON fu.focal_pk = f.focal_pk
      WHERE u.ativo = true AND f.ativo = true
    `;
    let params = [];

    if (filtro && filtro.trim() !== "") {
      sql += " AND (f.email = $1 OR CAST(f.matricula AS TEXT) = $2)";
      params.push(filtro.trim(), filtro.trim());
    }

    sql += " ORDER BY u.nome_unidade ASC";

    const result = await pool.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Erro ao buscar dados consolidados:", err.message);
    res.status(500).json({ error: "Erro interno ao buscar base." });
  }
}

/**
 * GET /api/aedes/certificados
 */
export async function getCertificados(_req, res) {
  try {
    const result = await pool.query(`
      SELECT 
        "Unidade",
        EXTRACT(MONTH FROM "Data") AS mes,
        EXTRACT(YEAR FROM "Data") AS ano,
        COUNT(CASE WHEN "UV_Sim" = 'Sim' THEN 1 END) AS total_vistorias,
        CASE 
          WHEN COUNT(DISTINCT "Semana") >= 4 THEN true 
          ELSE false 
        END AS cobertura_semanal_completa,
        CASE 
          WHEN COUNT(CASE WHEN "FE_Sim" = 'Sim' AND "RM_Não" = 'Sim' THEN 1 END) > 0 THEN true
          ELSE false 
        END AS focos_nao_remediados
      FROM aedes.excel_historico
      WHERE "UV_Sim" = 'Sim'
      GROUP BY "Unidade", EXTRACT(YEAR FROM "Data"), EXTRACT(MONTH FROM "Data")
      ORDER BY ano DESC, mes DESC, "Unidade" ASC;
    `);

    const linhasFormatadas = result.rows.map(row => ({
      unidade: row.Unidade, 
      mes: parseInt(row.mes),
      ano: parseInt(row.ano),
      total_vistorias: parseInt(row.total_vistorias || 0),
      cobertura_semanal_completa: row.cobertura_semanal_completa,
      focos_nao_remediados: row.focos_nao_remediados
    }));
    res.json(linhasFormatadas);
  } catch (err) {
    console.error("❌ Erro ao calcular certificados no Banco:", err.message);
    res.status(500).json({ error: "Erro interno ao processar as regras de elegibilidade." });
  }
}

/**
 * POST /api/aedes/lotes
 */
export async function criarLote(req, res) {
  const client = await pool.connect();
  try {
    const { cabecalho, dados } = req.body;
    await client.query('BEGIN');

    const loteRes = await client.query(
      `INSERT INTO aedes.lotes (focal_nome, payload_completo, total_registros) 
       VALUES ($1, $2, $3) RETURNING id`,
      [cabecalho.focal_nome, JSON.stringify(req.body), dados.length]
    );
    const loteId = loteRes.rows[0].id;

    const itemQuery = `
      INSERT INTO aedes.vistorias_itens (
        lote_id, id_referencia, unidade_id, unidade_nome, 
        vistoria_realizada, foco_encontrado, foco_remediado, 
        locais_foco, outros_local,
        motivos_nao_vistoria, outros_motivo_nao_vistoria,
        motivos_nao_remediacao, outros_motivo_nao_remediacao,
        observacoes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      ON CONFLICT (id_referencia) DO UPDATE SET
        lote_id = EXCLUDED.lote_id,
        outros_local = EXCLUDED.outros_local,
        outros_motivo_nao_vistoria = EXCLUDED.outros_motivo_nao_vistoria,
        outros_motivo_nao_remediacao = EXCLUDED.outros_motivo_nao_remediacao,
        observacoes = EXCLUDED.observacoes;
    `;

    const dataHoje = new Date().toISOString().split('T')[0].replace(/-/g, '');

    for (const row of dados) {
      const idReferencia = `${row[1].replace(/\s+/g, '')}_${dataHoje}`;
      await client.query(itemQuery, [
        loteId,
        idReferencia,
        row[0],
        row[1],
        row[2],
        row[3],
        row[4],
        JSON.stringify(row[5] || []),
        row[6],
        JSON.stringify(row[7] || []),
        row[8],
        JSON.stringify(row[9] || []),
        row[10],
        row[11]
      ]);
    }

    await client.query('COMMIT');
    res.status(201).json({ ok: true, loteId });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error("❌ ERRO NO BANCO AO INSERIR LOTE:", err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
}

/**
 * GET /api/aedes/lotes
 */
export async function getLotes(_req, res) {
  try {
    const result = await pool.query(`
      SELECT id, focal_nome, total_registros, data_envio, payload_completo 
      FROM aedes.lotes ORDER BY data_envio DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Erro ao buscar lotes." });
  }
}

/**
 * GET /api/unidades
 */
export async function getUnidades(_req, res) {
  try {
    const result = await pool.query(`
      SELECT DISTINCT "Unidade" AS nome_unidade 
      FROM aedes.excel_historico 
      WHERE "Unidade" IS NOT NULL 
      ORDER BY nome_unidade ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Erro na rota /api/unidades:", err.message);
    res.status(500).json({ error: "Erro ao buscar unidades." });
  }
}

/**
 * GET /api/aedes/painel-dados
 */
// server/controllers/aedesController.js

export async function getPainelDados(req, res) {
  try {
    // Query calibrada eliminando conflito de tipos de dados (double precision para integer)
    const query = `
      SELECT 
        id,
        origem,
        lote_id,
        data_registro,
        COALESCE(ano::INTEGER, EXTRACT(YEAR FROM NOW())::INTEGER) AS "Ano",
        CASE 
          WHEN mes::INTEGER = 1 THEN 'Janeiro'
          WHEN mes::INTEGER = 2 THEN 'Fevereiro'
          WHEN mes::INTEGER = 3 THEN 'Março'
          WHEN mes::INTEGER = 4 THEN 'Abril'
          WHEN mes::INTEGER = 5 THEN 'Maio'
          WHEN mes::INTEGER = 6 THEN 'Junho'
          WHEN mes::INTEGER = 7 THEN 'Julho'
          WHEN mes::INTEGER = 8 THEN 'Agosto'
          WHEN mes::INTEGER = 9 THEN 'Setembro'
          WHEN mes::INTEGER = 10 THEN 'Outubro'
          WHEN mes::INTEGER = 11 THEN 'Novembro'
          WHEN mes::INTEGER = 12 THEN 'Dezembro'
          ELSE 'Janeiro'
        END AS "Mes_Nome",
        COALESCE(unidade_nome, 'Desconhecida') AS "Unidade",
        CASE WHEN LOWER(vistoria_realizada) = 'sim' THEN 1 ELSE 0 END AS visitada,
        CASE WHEN LOWER(foco_encontrado) = 'sim' THEN 1 ELSE 0 END AS foco_encontrado,
        CASE WHEN LOWER(foco_remediado) = 'sim' THEN 1 ELSE 0 END AS foco_remediado,
        motivos_nao_vistoria,
        locais_foco
      FROM aedes.fato_vistorias
      ORDER BY ano DESC, mes DESC, id ASC;
    `;

    const resultado = await pool.query(query);

    console.log(`📊 Painel carregado com sucesso: ${resultado.rows.length} linhas enviadas.`);
    
    // Retorna o array perfeitamente tratado para o front-end
    return res.json(resultado.rows || []);

  } catch (error) {
    console.error("❌ Erro ao buscar dados do painel:", error);
    return res.status(500).json({ 
      error: "Erro interno no servidor ao processar a base unificada.", 
      detalhe: error.message 
    });
  }
}
/**
 * GET /api/aedes/focal-dossie
 */
export async function getFocalDossie(req, res) {
  try {
    const { unidade } = req.query;
    if (!unidade) return res.status(400).json({ error: "Unidade requerida" });
    
    const query = `
      SELECT l.focal_nome AS nome, f.matricula, f.email
      FROM aedes.vistorias_itens vi
      INNER JOIN aedes.lotes l ON vi.lote_id = l.id
      LEFT JOIN aedes.focais f ON LOWER(TRIM(l.focal_nome)) = LOWER(TRIM(f.nome))
      WHERE vi.unidade_nome = $1 ORDER BY l.id DESC LIMIT 1;
    `;
    const result = await pool.query(query, [unidade]);
    res.json(result.rows[0] || { nome: null, matricula: null, email: null });
  } catch (err) {
    res.status(500).json({ nome: null, matricula: null, email: null });
  }
}