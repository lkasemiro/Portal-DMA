// server/config/env.js
import dotenv from "dotenv";

dotenv.config();

export const NODE_ENV = process.env.NODE_ENV;
export const PORT = Number(process.env.PORT);
export const DATABASE_URL = process.env.DATABASE_URL;
export const NEON_AUTH_URL = process.env.NEON_AUTH_URL;
export const NEON_JWKS_URL = process.env.NEON_JWKS_URL;
export const CORS_ALLOWED_ORIGINS = process.env.CORS_ALLOWED_ORIGINS
    ? process.env.CORS_ALLOWED_ORIGINS.split(",")
    : [];

// Exportação padrão caso algum arquivo importe o objeto cheio
export default {
    NODE_ENV,
    PORT,
    DATABASE_URL,
    NEON_AUTH_URL,
    NEON_JWKS_URL,
    CORS_ALLOWED_ORIGINS
};