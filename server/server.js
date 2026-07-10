// server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// ESM (__dirname)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuração de Variáveis de Ambiente (.env)
dotenv.config({
    path: path.resolve(__dirname, "../.env")
});

// Database Infra & Schema Init de módulos
import { pool } from "./infra/db.js";
import { initSchema as initAedesSchema, getUnidades } from "./controllers/aedesController.js";

// Importação das Rotas Modulares
import postsRoutes from "./routes/posts.js";
import modulosRoutes from "./routes/modulos.js";
import aedesRoutes from "./routes/aedes_routes.js"; // <--- Novo Roteador do Aedes

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares Globais
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Arquivos Estáticos (Frontend e Uploads)
app.use(express.static(path.join(__dirname, "..")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Acoplamento das Rotas na API
app.use("/api/posts", postsRoutes);
app.use("/api/modulos", modulosRoutes);
app.use("/api/aedes", aedesRoutes); // <--- Injetando todo o escopo do Aedes isolado

// Esta rota de unidades ficava solta e agora mapeia para o controller correto
app.get("/api/unidades", getUnidades);

// Healthcheck do sistema
app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT NOW()");
    res.json({ ok: true, database: "online", server: "online" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: "database offline" });
  }
});

// Inicialização Assíncrona de Tabelas Adicionais (Agenda)
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
    console.log("📅 Tabela dma.agenda_eventos verificada/criada.");
  } catch (err) {
    console.error("❌ Erro ao inicializar o schema da agenda:", err.message);
  }
}

// Rotas da Agenda Ambiental (Podem opcionalmente ser extraídas futuramente para routes/agenda.js)
app.get("/api/agenda", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, titulo, categoria, data_evento::TEXT, horario, local_evento, descricao 
      FROM dma.agenda_eventos ORDER BY data_evento ASC, horario ASC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Erro interno ao processar a listagem da agenda." });
  }
});

app.post("/api/agenda", async (req, res) => {
  try {
    const { titulo, categoria, data_evento, horario, local, descricao } = req.body;
    if (!titulo || !categoria || !data_evento || !local) {
      return res.status(400).json({ error: "Campos obrigatórios em falta." });
    }
    const result = await pool.query(`
      INSERT INTO dma.agenda_eventos (titulo, categoria, data_evento, horario, local_evento, descricao)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, titulo, categoria, data_evento::TEXT, horario, local_evento, descricao
    `, [titulo, categoria, data_evento, horario, local, descricao || '']);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Erro interno ao salvar o evento." });
  }
});

app.put("/api/agenda/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { titulo, categoria, data_evento, horario, local, descricao } = req.body;
    const result = await pool.query(`
      UPDATE dma.agenda_eventos SET titulo = $1, categoria = $2, data_evento = $3, horario = $4, local_evento = $5, descricao = $6
      WHERE id = $7 RETURNING id, titulo, categoria, data_evento::TEXT, horario, local_evento, descricao
    `, [titulo, categoria, data_evento, horario, local, descricao || '', id]);
    if (result.rows.length === 0) return res.status(404).json({ error: "Evento não encontrado." });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Erro interno ao atualizar o evento." });
  }
});

app.delete("/api/agenda/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`DELETE FROM dma.agenda_eventos WHERE id = $1 RETURNING id`, [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: "Evento não encontrado." });
    res.json({ success: true, message: "Evento removido com sucesso." });
  } catch (err) {
    res.status(500).json({ error: "Erro interno ao remover o evento." });
  }
});

// Fallback de Rotas Não Encontradas (404) e Error Handlers
app.use((_req, res) => res.status(404).json({ error: "Rota não encontrada." }));
app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Erro interno no servidor." });
});

// Inicialização do Servidor Http
app.listen(PORT, async () => {
  console.log(`🚀 Servidor rodando em: http://localhost:${PORT}`);
  // Roda de forma limpa e assíncrona os instaladores de tabelas
  await initAedesSchema();
  await initSchemaAgenda();
});