import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { toNodeHandler } from "better-auth/node";

// 🌍 Central de Configuração Ambiental & Variáveis Validadas
import { PORT, CORS_ALLOWED_ORIGINS } from "./config/env.js";

// 🔒 Instância de Configuração do Better Auth
import { auth } from "./auth/auth.config.js";

// 🗄️ Infraestrutura de Banco de Dados e Inicializadores de Schemas
import { pool } from "./database/db.js";
import { initSchema as initAedesSchema } from "./aedes/aedes.schema.js"; // Exemplo de isolamento do DDL do Aedes
import { initReciclaSchema } from "./recicla/recicla.schema.js";
import { initPostsSchema } from "./posts/posts.schema.js";
import { initModulosSchema } from "./modulos/modulos.schema.js";

// 🛣️ Importação dos Módulos de Rotas Consolidados
import authManagementRoutes from "./auth/auth.routes.js";
import modulosRoutes from "./modulos/modulos.routes.js";
import postsRoutes from "./posts/posts.routes.js";
import aedesRoutes from "./aedes/aedes.routes.js";
import reciclaRoutes from "./recicla/recicla.routes.js";

// Configuração do ambiente para ES Modules (ESM)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

/* ==========================================================================
   1. MIDDLEWARES CRÍTICOS & CONFIGURAÇÃO DO CORS
   ========================================================================== */

// Configuração dinâmica de origens permitidas baseada no array do env.js
const allowedOrigins = [
    ...(CORS_ALLOWED_ORIGINS || []),
    "http://localhost:3001",
    "https://lkasemiro.github.io" // ➔ GARANTE O GITHUB PAGES AQUI DIRETAMENTE
];

app.use(cors({
    origin: function (origin, callback) {
        // Permite requisições sem origem (como aplicativos mobile ou ferramentas de teste como Postman)
        if (!origin) return callback(null, true);
        
        // Remove barras no final da string para evitar falhas de correspondência estrita
        const sanitizedOrigin = origin.replace(/\/$/, "");
        
        const isAllowed = allowedOrigins.some(allowed => allowed.replace(/\/$/, "") === sanitizedOrigin);

        if (isAllowed) {
            callback(null, true);
        } else {
            console.warn(`🚨 Bloqueado pelo CORS. Origem rejeitada: ${origin}`);
            // Correção crucial: Não passamos um 'new Error' no primeiro parâmetro para evitar Erro 500 no Node.
            // Passamos 'null' no erro e 'false' para o Express lidar apenas com o bloqueio HTTP limpo.
            callback(null, false);
        }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"],
}));

// 🔥 ADICIONE ESTE MIDDLEWARE PARA REQUISIÇÕES DE PRÉ-VERIFICAÇÃO (Preflight)
// Isso responde instantaneamente requisições OPTIONS sem deixar bater nas rotas internas
app.options('*', cors());

// 🔥 REGRA CRÍTICA DO BETTER AUTH: Deve interceptar a requisição ANTES dos parsers express.json()
app.use("/api/auth", (req, res) => {
    return toNodeHandler(auth)(req, res);
});

// Parsers globais para o restante das rotas do ecossistema Express
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

/* ==========================================================================
   2. ARQUIVOS ESTÁTICOS (Uploads Locais)
   ========================================================================== */
app.use("/uploads", express.static(path.join(__dirname, "public", "uploads")));

/* ==========================================================================
   3. ACOPLAMENTO DAS ROTAS MODULARES DA API
   ========================================================================== */
app.use("/api/auth-management", authManagementRoutes); // Rotas acessórias administrativas do Auth (ex: listagem de usuários)
app.use("/api/modulos", modulosRoutes);               // Estrutura de menus dinâmicos por cargo
app.use("/api/posts", postsRoutes);                   // Notícias, comunicados e upload de mídias
app.use("/api/aedes", aedesRoutes);                   // Operações, KPIs e Auditoria Semanal do Aedes
app.use("/api/recicla", reciclaRoutes);               // Coleta seletiva e reciclagem

/* ==========================================================================
   4. HEALTHCHECK DO SISTEMA
   ========================================================================== */
app.get("/api/health", async (req, res) => {
    try {
        await pool.query("SELECT NOW()");
        res.json({ 
            status: "ok", 
            database: "online", 
            time: new Date().toLocaleString("pt-BR") 
        });
    } catch (error) {
        console.error("❌ Healthcheck Falhou:", error.message);
        res.status(500).json({ status: "error", database: "offline" });
    }
});

// Fallback para caminhos inexistentes
app.use((_req, res) => res.status(404).json({ error: "Rota não encontrada na API." }));

/* ==========================================================================
   5. INICIALIZAÇÃO ASSÍNCRONA E SEGURA DO SERVIDOR
   ========================================================================== */
app.listen(PORT, async () => {
    console.log(`🚀 Servidor rodando com sucesso em: http://localhost:${PORT}`);
    console.log("🔒 Origens monitoradas pelo CORS:", allowedOrigins);

    // Inicialização assíncrona dos esquemas de tabelas
    try {
        await initAedesSchema();
        console.log("🔋 Estrutura de tabelas e Views do Módulo Aedes sincronizadas.");
    } catch (err) {
        console.error("⚠️ Falha ao inicializar o schema do Aedes:", err.message);
    }

    try {
        await initReciclaSchema();
        console.log("🔋 Estrutura do Módulo Recicla sincronizada.");
    } catch (err) {
        console.error("⚠️ Falha ao inicializar o schema do Recicla:", err.message);
    }
});