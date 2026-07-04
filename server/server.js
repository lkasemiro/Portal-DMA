// =========================================================
// SERVER - PORTAL AMBIENTAL
// =========================================================

// ---------------------------------------------------------
// IMPORTS
// ---------------------------------------------------------

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// ---------------------------------------------------------
// ESM (__dirname)
// ---------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------------------------------------------------
// ENV (.env na raiz do Portal-DMA)
// ---------------------------------------------------------

dotenv.config({
    path: path.resolve(__dirname, "../.env")
});

// ---------------------------------------------------------
// DATABASE
// ---------------------------------------------------------

import { pool } from "./infra/db.js";

// ---------------------------------------------------------
// ROUTES
// ---------------------------------------------------------

import postsRoutes from "./routes/posts.js";
import modulosRoutes from "./routes/modulos.js";

// =========================================================
// DEBUG
// =========================================================

console.log("======================================");
console.log("Servidor iniciado");
console.log("CWD:", process.cwd());
console.log("PORT:", process.env.PORT);

if (process.env.DATABASE_URL) {

    const url = new URL(process.env.DATABASE_URL);

    console.log("Banco:", url.pathname);
    console.log("Host:", url.hostname);

} else {

    console.error("DATABASE_URL NÃO ENCONTRADA");

}

console.log("======================================");

// =========================================================
// EXPRESS
// =========================================================

const app = express();

const PORT = process.env.PORT || 3001;
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

// ─── ENDPOINT REAL DA TABELA VISTORIAS_ITENS ───────────────────────────────
app.get("/api/aedes/painel-dados", async (req, res) => {
  try {

    console.log("====================================");
    console.log("➡️ Requisição recebida: /api/aedes/painel-dados");

    const banco = await pool.query("SELECT current_database(), current_schema()");
    console.log("Banco:", banco.rows[0]);

    const total = await pool.query(`
      SELECT COUNT(*) AS total
      FROM aedes.vistorias_itens
    `);

    console.log("Total de registros:", total.rows[0].total);

    const query = `
      SELECT
        EXTRACT(YEAR FROM data_registro) AS "Ano",

        CASE EXTRACT(MONTH FROM data_registro)
          WHEN 1 THEN 'Janeiro'
          WHEN 2 THEN 'Fevereiro'
          WHEN 3 THEN 'Março'
          WHEN 4 THEN 'Abril'
          WHEN 5 THEN 'Maio'
          WHEN 6 THEN 'Junho'
          WHEN 7 THEN 'Julho'
          WHEN 8 THEN 'Agosto'
          WHEN 9 THEN 'Setembro'
          WHEN 10 THEN 'Outubro'
          WHEN 11 THEN 'Novembro'
          WHEN 12 THEN 'Dezembro'
        END AS "Mes_Nome",

        unidade_nome AS "Unidade",

        CASE
          WHEN LOWER(TRIM(vistoria_realizada))='sim'
          THEN 1 ELSE 0
        END AS visitada,

        CASE
          WHEN LOWER(TRIM(vistoria_realizada))='sim'
           AND LOWER(TRIM(foco_encontrado))='sim'
          THEN 1 ELSE 0
        END AS foco_encontrado,

        CASE
          WHEN LOWER(TRIM(vistoria_realizada))='sim'
           AND LOWER(TRIM(foco_encontrado))='sim'
           AND LOWER(TRIM(foco_remediado))='sim'
          THEN 1 ELSE 0
        END AS foco_remediado,

        motivos_nao_vistoria,
        outros_motivo_nao_vistoria,
        motivos_nao_remediacao,
        outros_motivo_nao_remediacao,
        locais_foco,
        outros_local,

        TO_CHAR(data_registro,'DD/MM/YYYY') AS data_formatada

      FROM aedes.vistorias_itens
      ORDER BY data_registro DESC;
    `;

    const result = await pool.query(query);

    console.log("Linhas retornadas:", result.rowCount);

    if (result.rowCount > 0) {
      console.log("Primeira linha:");
      console.log(result.rows[0]);
    }
const teste = await pool.query(`
    SELECT schemaname, tablename
    FROM pg_tables
    WHERE tablename = 'vistorias_itens';
`);

console.log(teste.rows);
    console.log("====================================");

    res.json(result.rows);

  } catch (err) {

    console.error(err);

    res.status(500).json({
      erro: err.message
    });

  }
});

// Certifique-se de que a sua rota de focal-dossie está parecida com esta:
app.get("/api/aedes/focal-dossie", async (req, res) => {
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
const info = await pool.query(`
SELECT
    current_database(),
    current_user,
    inet_server_addr(),
    inet_server_port(),
    version();
`);

console.log(info.rows[0]);