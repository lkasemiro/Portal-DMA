/**
 * ============================================================
 * Portal Ambiental
 * Configuração do Neon Auth
 * ============================================================
 */
const env = require("../config/env.js");

module.exports = {

    authUrl: env.NEON_AUTH_URL,

    jwksUrl: env.NEON_JWKS_URL

};
