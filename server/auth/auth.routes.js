/**
 * ============================================================
 * Portal Ambiental
 * Rotas de Autenticação (Versão ES Modules)
 * ============================================================
 */

import express from "express";
import * as controller from "./auth.controller.js"; // Obrigatório o .js no final
import { verificarAutenticacao, authorize } from "./auth.middleware.js";

const router = express.Router();

/**
 * Usuário autenticado
 */
router.get(
    "/me",
    verificarAutenticacao,
    controller.me
);

/**
 * Lista usuários
 */
router.get(
    "/users",
    verificarAutenticacao,
    authorize("Administrador"),
    controller.listarUsuarios
);

/**
 * Cadastro de usuários
 */
router.post(
    "/users",
    verificarAutenticacao,
    authorize("Administrador"),
    controller.cadastrarUsuario
);

/**
 * Ativar/desativar usuário
 */
router.patch(
    "/users/:userId/status",
    verificarAutenticacao,
    authorize("Administrador"),
    controller.alterarStatus
);

export default router;