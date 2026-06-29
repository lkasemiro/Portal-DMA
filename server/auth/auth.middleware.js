/**
 * ============================================================
 * Portal Ambiental
 * Middleware de Autenticação
 * Validação de JWT emitido pelo Neon Auth
 * ============================================================
 */

import { createRemoteJWKSet, jwtVerify } from "jose";
import * as perfilService from "../services/perfil.service.js";

// Garante que a URL do JWKS do Neon está configurada no .env
if (!process.env.NEON_JWKS_URL) {
    throw new Error("A variável NEON_JWKS_URL não está definida no ambiente.");
}


// JWKS do Neon
const JWKS = createRemoteJWKSet(
    new URL(process.env.NEON_JWKS_URL)
);

/**
 * Middleware responsável por autenticar
 * usuários através do JWT emitido pelo Neon Auth.
 */
async function authenticate(req, res, next) {

    try {

        const authHeader = req.headers.authorization;

        if (!authHeader) {

            return res.status(401).json({
                success: false,
                message: "Token não informado."
            });

        }

        if (!authHeader.startsWith("Bearer ")) {

            return res.status(401).json({
                success: false,
                message: "Formato de autenticação inválido."
            });

        }

        const token = authHeader.replace("Bearer ", "");

        // Validação do JWT
        const { payload } = await jwtVerify(
            token,
            JWKS
        );

        // user_id do Neon
        const userId = payload.sub;

        const authService = require("../services/auth.service");

        const perfil = await authService.obterUsuario(userId);
        
        if (!perfil) {

            return res.status(403).json({
                success: false,
                message: "Usuário não possui perfil cadastrado."
            });

        }

        if (!perfil.ativo) {

            return res.status(403).json({
                success: false,
                message: "Usuário desativado."
            });

        }

        // Atualiza último login
        await perfilService.atualizarUltimoLogin(userId);

        // Disponibiliza para toda a aplicação
        req.user = perfil;

        next();

    } catch (error) {

        console.error(error);

        return res.status(401).json({

            success: false,

            message: "Token inválido."

        });

    }

}

/**
 * Middleware para verificar papéis.
 *
 * Exemplo:
 *
 * authorize("Administrador")
 *
 * authorize("Administrador","Editor")
 */
function authorize(...papeisPermitidos) {

    return (req, res, next) => {

        if (!req.user) {

            return res.status(401).json({

                success: false,

                message: "Usuário não autenticado."

            });

        }

        if (!papeisPermitidos.includes(req.user.papel)) {

            return res.status(403).json({

                success: false,

                message: "Você não possui permissão para esta operação."

            });

        }

        next();

    };

}

module.exports = {

    authenticate,

    authorize

};