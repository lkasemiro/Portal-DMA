// server.js

// =========================================================
// IMPORTS
// =========================================================

import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import path from "path";

import {
  fileURLToPath
}
from "url";


// DATABASE
import { pool }
from "./infra/db.js";


// ROUTES
import postsRoutes
from "./routes/posts.js";

import modulosRoutes
from "./routes/modulos.js";


// =========================================================
// CONFIG
// =========================================================

dotenv.config();

const app = express();

const PORT =
  process.env.PORT || 3001;


// =========================================================
// ESM PATH FIX
// =========================================================

const __filename =
  fileURLToPath(import.meta.url);

const __dirname =
  path.dirname(__filename);


// =========================================================
// MIDDLEWARES
// =========================================================

app.use(cors({

  origin: "*",

  methods: [
    "GET",
    "POST",
    "PUT",
    "DELETE",
    "OPTIONS"
  ],

  allowedHeaders: [
    "Content-Type",
    "Authorization"
  ]

}));


app.use(
  express.json({
    limit: "10mb"
  })
);


app.use(
  express.urlencoded({
    extended: true
  })
);


// =========================================================
// STATIC FILES
// =========================================================

// FRONTEND
app.use(
  express.static(
    path.join(__dirname, "..")
  )
);
// UPLOADS
app.use(
  "/uploads",
  express.static(
    path.join(__dirname, "uploads")
  )
);

// =========================================================
// API ROUTES
// =========================================================

app.use(
  "/api/posts",
  postsRoutes
);

app.use(
  "/api/modulos",
  modulosRoutes
);


// =========================================================
// HEALTHCHECK
// =========================================================

app.get(
  "/api/health",
  async (req, res) => {

    try {

      await pool.query(
        "SELECT NOW()"
      );

      res.json({

        ok: true,

        database: "online",

        server: "online"

      });

    }

    catch (error) {

      console.error(error);

      res.status(500).json({

        ok: false,

        error: "database offline"

      });

    }

  }
);



// ─── Inicialização do Banco ──────────────────────────────────────────────────
async function initSchema() {
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
    await pool.query(`
      CREATE TABLE IF NOT EXISTS aedes.focal_unidade (
        focal_unidade_pk BIGSERIAL PRIMARY KEY,
        focal_pk         BIGINT REFERENCES aedes.focais(focal_pk) ON DELETE CASCADE,
        unidade_id       BIGINT, -- Relaciona com a tabela unidades externa
        ativo            BOOLEAN DEFAULT true,
        data_inicio      TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log("✅ Tabelas aedes.lotes e aedes.focais verificadas.");
  } catch (err) {
    console.error("❌ Erro no initSchema:", err.message);
  }
}

/* =========================================================
   ROTAS DE FOCAIS (Ajustadas para o Dashboard)
========================================================= */

// 🟢 ROTA PRINCIPAL: Usada pelo getFocais() do seu front-end
app.get("/api/aedes/focais", async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT nome, email FROM aedes.focais 
      WHERE ativo = true ORDER BY nome ASC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Erro ao buscar lista de focais" });
  }
});

// Rota Detalhada (com Join na importação)
app.get("/api/aedes/focais/lista", async (req, res) => {
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
});

// Login do Focal
app.get("/api/aedes/focais/login", async (req, res) => {
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
});
/* =========================================================
   BASE CONSOLIDADA
========================================================= */

/* ------------------------------------------------
server antigo lkasemirogit.hub

app.get("/api/aedes/base", async (req, res) => {
  try {
    const { filtro } = req.query;

    let sql = `
      SELECT 
        u.unidade_id AS id, 
        u.nome_unidade AS unidade, 
        stg.matricula, 
        stg.email,
        stg.focal AS "focalNome"
      FROM aedes.unidades u
      INNER JOIN aedes.stg_importacao_excel stg ON u.nome_unidade = stg.unidade
    `;
    let params = [];

    if (filtro && filtro.trim() !== "") {
      sql += " WHERE stg.email = $1 OR CAST(stg.matricula AS TEXT) = $2";
      params.push(filtro.trim(), filtro.trim());
    }

    sql += " ORDER BY u.nome_unidade ASC";

    const result = await pool.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Erro ao buscar dados consolidados:", err.message);
    res.status(500).json({ error: "Erro interno ao buscar base." });
  }
});
*/
app.get("/api/aedes/base", async (req, res) => {
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
      // O filtro agora busca com segurança nas colunas da tabela de focais
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
});
/* =========================================================
   CERTIFICADOS
========================================================= */
app.get("/api/aedes/certificados", async (_req, res) => {
  try {
    // Query ajustada para comparar strings ('Sim') e usar os nomes exatos das colunas do seu banco
    const result = await pool.query(`
      SELECT 
        "Unidade",
        EXTRACT(MONTH FROM "Data") AS mes,
        EXTRACT(YEAR FROM "Data") AS ano,
        
        -- Conta quantas vistorias foram realizadas de fato no mês
        COUNT(CASE WHEN "UV_Sim" = 'Sim' THEN 1 END) AS total_vistorias,
        
        -- Regra 1: Garante que houve vistorias em pelo menos 4 semanas distintas do mês
        CASE 
          WHEN COUNT(DISTINCT "Semana") >= 4 THEN true 
          ELSE false 
        END AS cobertura_semanal_completa,
        
        -- Regra 2: Verifica se sobrou algum foco sem remédio (Foco = Sim e Remediação Não = Sim)
        CASE 
          WHEN COUNT(CASE WHEN "FE_Sim" = 'Sim' AND "RM_Não" = 'Sim' THEN 1 END) > 0 THEN true
          ELSE false 
        END AS focos_nao_remediados

      FROM aedes.excel_historico
      WHERE "UV_Sim" = 'Sim' -- Filtra apenas registros com vistorias concluídas
      GROUP BY "Unidade", EXTRACT(YEAR FROM "Data"), EXTRACT(MONTH FROM "Data")
      ORDER BY ano DESC, mes DESC, "Unidade" ASC;
    `);

    // Formata o retorno mapeando as propriedades para minúsculas
    // Isso garante compatibilidade perfeita com o seu arquivo aedes-publico.js no front-end
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
});
/* =========================================================
   ROTAS DE VISTORIAS (LOTES)
========================================================= */
app.post("/api/aedes/lotes", async (req, res) => {
  const client = await pool.connect();
  try {
    const { cabecalho, dados } = req.body;
    await client.query('BEGIN');

    // 1. Inserir no Lote - AGORA COM 3 PARÂMETROS ($1, $2, $3)
    const loteRes = await client.query(
      `INSERT INTO aedes.lotes (focal_nome, payload_completo, total_registros) 
       VALUES ($1, $2, $3) RETURNING id`,
      [cabecalho.focal_nome, JSON.stringify(req.body), dados.length] // <-- Adicionado dados.length ($3)
    );
    const loteId = loteRes.rows[0].id;

    // 2. Inserir nos Itens - EXATAMENTE 14 PLACEHOLDERS ($1 até $14)
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
  // Gerar ID Semântico
  const idReferencia = `${row[1].replace(/\s+/g, '')}_${dataHoje}`;
  
      // 3. MAPEAMENTO DE 14 VALORES CORRESPONDENTES
            await client.query(itemQuery, [
        loteId,         // $1
        idReferencia,   // $2
        row[0],         // $3 - unidade_id
        row[1],         // $4 - unidade_nome
        row[2],         // $5 - vistoria_realizada
        row[3],         // $6 - foco_encontrado
        row[4],         // $7 - foco_remediado
        JSON.stringify(row[5] || []),  // $8 - locais_foco
        row[6],                        // $9 - outros_local
        JSON.stringify(row[7] || []),  // $10 - motivos_nao_vistoria
        row[8],                        // $11 - outros_motivo_nao_vistoria
        JSON.stringify(row[9] || []),  // $12 - motivos_nao_remediacao
        row[10],                       // $13 - outros_motivo_nao_remediacao
        row[11]                        // $14 - observacoes
      ]);
    }

    await client.query('COMMIT');
    res.status(201).json({ ok: true, loteId });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error("❌ ERRO NO BANCO:", err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

app.get("/api/aedes/lotes", async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, focal_nome, total_registros, data_envio, payload_completo 
      FROM aedes.lotes ORDER BY data_envio DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Erro ao buscar lotes." });
  }
});
/* =========================================================
   ROTAS GERAIS
========================================================= */

/*app.get("/api/unidades", async (_req, res) => {
  try {
    const result = await pool.query(`SELECT unidade_id, nome_unidade FROM aedes.unidades ORDER BY nome_unidade ASC`);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Erro ao buscar unidades." });
  }
});
*/
app.get("/api/unidades", async (_req, res) => {
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
});

app.get("/api/health", (_req, res) => {
  const dataBrasilia = new Date().toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo"
  });
  
  res.json({ 
    status: "ok", 
    time: dataBrasilia 
  });
});

/* ==========================================================================
   ROTA COMPLETA: PAINEL ANALÍTICO (CONVERSÃO DE SEMANA PARA MÊS POR EXTENSO)
========================================================================== */
app.get("/api/aedes/painel-dados", async (req, res) => {
  try {
    const query = `
      SELECT 
        COALESCE("Ano", 2026) as "Ano",
        
        -- MAPEAMENTO CRONOLÓGICO: Transforma o número da semana no Mês correspondente
        CASE 
          WHEN "Semana" BETWEEN 1 AND 4 THEN 'Janeiro'
          WHEN "Semana" BETWEEN 5 AND 8 THEN 'Fevereiro'
          WHEN "Semana" BETWEEN 9 AND 13 THEN 'Março'
          WHEN "Semana" BETWEEN 14 AND 17 THEN 'Abril'
          WHEN "Semana" BETWEEN 18 AND 22 THEN 'Maio'
          WHEN "Semana" BETWEEN 23 AND 26 THEN 'Junho'
          WHEN "Semana" BETWEEN 27 AND 30 THEN 'Julho'
          WHEN "Semana" BETWEEN 31 AND 35 THEN 'Agosto'
          WHEN "Semana" BETWEEN 36 AND 39 THEN 'Setembro'
          WHEN "Semana" BETWEEN 40 AND 44 THEN 'Outubro'
          WHEN "Semana" BETWEEN 45 AND 48 THEN 'Novembro'
          ELSE 'Dezembro'
        END as "Mes_Nome",
        
        COALESCE("Unidade", 'Sem Unidade') as "Unidade",
        
        -- Volumetria dos Cards Principais (Mapeamento de strings para inteiros)
        CASE WHEN "UV_Sim" = 'Sim' THEN 1 ELSE 0 END as visitada,
        CASE WHEN "FE_Sim" = 'Sim' THEN 1 ELSE 0 END as foco_encontrado,
        CASE WHEN "RM_Sim" = 'Sim' THEN 1 ELSE 0 END as foco_remediado,
        CASE WHEN "RM_Não" = 'Sim' THEN 1 ELSE 0 END as foco_pendente,
        
        -- Gargalos Operacionais: Motivos de Não Vistoria (NV)
        CASE WHEN "NV_Sem_condições_acesso" = 'Sim' THEN 1 ELSE 0 END as nv_acesso,
        CASE WHEN "NV_Sem_brigadista_disponível" = 'Sim' THEN 1 ELSE 0 END as nv_brigadista,
        CASE WHEN "NV_Sem_viatura_disponível" = 'Sim' THEN 1 ELSE 0 END as nv_viatura,
        CASE WHEN "NV_Esquecimento" = 'Sim' THEN 1 ELSE 0 END as nv_esquecimento,
        
        -- Gargalos Logísticos: Motivos de Não Remediação (MNR) 
        -- Nota: Respeitando os caracteres de quebra de linha (\r\n) injetados pelo Excel
        CASE WHEN "MNR_Falta de treinamento_\r\ncapacitação" = 'Sim' THEN 1 ELSE 0 END as mnr_capacitacao,
        CASE WHEN "MNR_Falta de cloro_\r\nlarvicida" = 'Sim' THEN 1 ELSE 0 END as mnr_larvicida,
        CASE WHEN "MNR_Necessidade_limpeza_terreno" = 'Sim' THEN 1 ELSE 0 END as mnr_limpeza,
        CASE WHEN "MNR_Reservatório_sem_cobertura" = 'Sim' THEN 1 ELSE 0 END as mnr_cobertura
        
      FROM aedes.excel_historico2
      WHERE "Unidade" IS NOT NULL
      ORDER BY "Ano" DESC, "Semana" ASC, "Unidade" ASC;
    `;
    
    const result = await pool.query(query);
    
    // Retorna a coleção consolidada de registros em JSON
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Erro crítico no PostgreSQL executando /api/aedes/painel-dados:", err.message);
    res.status(500).json({ 
      error: "Falha interna no processamento analítico do banco de dados.", 
      detalhes: err.message 
    });
  }
});

// ─── Puxadinho para alimentar o Dossiê Técnico (Sem mexer na grade) ───
app.get("/api/aedes/focal-dossie", async (req, res) => {
  try {
    const { unidade } = req.query;
    if (!unidade) {
      return res.status(400).json({ error: "Nome da unidade é obrigatório." });
    }

    // Busca o último lote enviado que contém itens desta unidade 
    // e cruza com o cadastro de focais para pegar matrícula e e-mail
    const query = `
      SELECT 
        l.focal_nome AS nome,
        f.matricula,
        f.email
      FROM aedes.vistorias_itens vi
      INNER JOIN aedes.lotes l ON vi.lote_id = l.id
      LEFT JOIN aedes.focais f ON LOWER(TRIM(l.focal_nome)) = LOWER(TRIM(f.nome))
      WHERE vi.unidade_nome = $1
      ORDER BY l.data_envio DESC
      LIMIT 1
    `;

    const result = await pool.query(query, [unidade.trim()]);

    if (result.rows.length === 0) {
      return res.json({ nome: null, matricula: null, email: null });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("❌ Erro no puxadinho do dossiê:", err.message);
    res.status(500).json({ error: "Erro interno ao buscar focal para o dossiê." });
  }
});

// ─── MÓDULO: AGENDA AMBIENTAL (ASSESSORIA DMA) ─────────────────────────────────

// 1. Inicialização da Tabela da Agenda (Pode colocar dentro da sua função initSchema existente)
async function initSchemaAgenda() {
  try {
    await pool.query(`CREATE SCHEMA IF NOT EXISTS dma;`);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS dma.agenda_eventos (
        id SERIAL PRIMARY KEY,
        titulo TEXT NOT NULL,
        categoria TEXT NOT NULL,
        data_evento DATE NOT NULL,
        horario TEXT,
        local_evento TEXT NOT NULL,
        descricao TEXT,
        criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    console.log("📅 Tabela dma.agenda_eventos verificada/criada com sucesso.");
  } catch (err) {
    console.error("❌ Erro ao inicializar o schema da agenda:", err.message);
  }
}
// Chame a função na inicialização do servidor
initSchemaAgenda();


// 2. ROTAS DA API (/api/agenda)

// GET ─── Listar todos os eventos ordenados por proximidade cronológica
app.get("/api/agenda", async (req, res) => {
  try {
    const query = `
      SELECT id, titulo, categoria, data_evento::TEXT, horario, local_evento, descricao 
      FROM dma.agenda_eventos 
      ORDER BY data_evento ASC, horario ASC
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Erro ao buscar eventos da agenda:", err.message);
    res.status(500).json({ error: "Erro interno ao processar a listagem da agenda." });
  }
});

// POST ─── Lançar um novo evento no ecossistema
app.post("/api/agenda", async (req, res) => {
  try {
    const { titulo, categoria, data_evento, horario, local, descricao } = req.body;
    
    if (!titulo || !categoria || !data_evento || !local) {
      return res.status(400).json({ error: "Campos obrigatórios em falta (titulo, categoria, data_evento, local)." });
    }

    const query = `
      INSERT INTO dma.agenda_eventos (titulo, categoria, data_evento, horario, local_evento, descricao)
      VALUES ($1, $2, $3, $4, $5, $6) 
      RETURNING id, titulo, categoria, data_evento::TEXT, horario, local_evento, descricao
    `;
    
    const values = [titulo, categoria, data_evento, horario, local, descricao || ''];
    const result = await pool.query(query, values);
    
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("❌ Erro ao inserir evento na agenda:", err.message);
    res.status(500).json({ error: "Erro interno ao salvar o evento." });
  }
});

// PUT ─── Modificar/Atualizar um evento existente
app.put("/api/agenda/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { titulo, categoria, data_evento, horario, local, descricao } = req.body;

    if (!titulo || !categoria || !data_evento || !local) {
      return res.status(400).json({ error: "Campos obrigatórios em falta para atualização." });
    }

    const query = `
      UPDATE dma.agenda_eventos 
      SET titulo = $1, categoria = $2, data_evento = $3, horario = $4, local_evento = $5, descricao = $6
      WHERE id = $7 
      RETURNING id, titulo, categoria, data_evento::TEXT, horario, local_evento, descricao
    `;

    const values = [titulo, categoria, data_evento, horario, local, descricao || '', id];
    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Evento não encontrado para atualização." });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("❌ Erro ao atualizar evento na agenda:", err.message);
    res.status(500).json({ error: "Erro interno ao atualizar o evento." });
  }
});

// DELETE ─── Remover fisicamente o evento do banco de dados
app.delete("/api/agenda/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    const query = `DELETE FROM dma.agenda_eventos WHERE id = $1 RETURNING id`;
    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Evento não encontrado para remoção." });
    }

    res.json({ success: true, message: "Evento removido com sucesso de forma definitiva." });
  } catch (err) {
    console.error("❌ Erro ao remover evento da agenda:", err.message);
    res.status(500).json({ error: "Erro interno ao remover o evento." });
  }
});

// Error Handlers
app.use((_req, res) => res.status(404).json({ error: "Rota não encontrada." }));
app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Erro interno no servidor." });
});

app.listen(PORT, async () => {
  console.log(`🚀 Servidor rodando em: http://localhost:${PORT}`);
  await initSchema();
});