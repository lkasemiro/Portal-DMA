// server/config/env.js
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Garante que o dotenv busque o arquivo .env na raiz correta do servidor
dotenv.config({
    path: path.join(__dirname, "../.env")
});

export const NODE_ENV = process.env.NODE_ENV || "development";
export const PORT = Number(process.env.PORT) || 3001;
export const DATABASE_URL = process.env.DATABASE_URL;

// 🔒 Novas variáveis obrigatórias do Better Auth
export const BETTER_AUTH_SECRET = process.env.BETTER_AUTH_SECRET;
export const BETTER_AUTH_URL = process.env.BETTER_AUTH_URL;

export const CORS_ALLOWED_ORIGINS = process.env.CORS_ALLOWED_ORIGINS
    ? process.env.CORS_ALLOWED_ORIGINS.split(",")
    : [];

// Exportação padrão consolidada
export default {
    NODE_ENV,
    PORT,
    DATABASE_URL,
    BETTER_AUTH_SECRET,
    BETTER_AUTH_URL,
    CORS_ALLOWED_ORIGINS
};