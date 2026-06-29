require("dotenv").config();

module.exports = {

    NODE_ENV: process.env.NODE_ENV,

    PORT: Number(process.env.PORT),

    DATABASE_URL: process.env.DATABASE_URL,

    NEON_AUTH_URL: process.env.NEON_AUTH_URL,

    NEON_JWKS_URL: process.env.NEON_JWKS_URL,

    CORS_ALLOWED_ORIGINS: process.env.CORS_ALLOWED_ORIGINS
        ? process.env.CORS_ALLOWED_ORIGINS.split(",")
        : []

};