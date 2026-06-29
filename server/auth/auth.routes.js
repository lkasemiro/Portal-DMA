/**
 * ============================================================
 * Portal Ambiental
 * Rotas de Autenticação
 * ============================================================
 */

const express = require("express");

const router = express.Router();

const controller = require("./auth.controller");

const {

    authenticate,

    authorize

} = require("./auth.middleware");

/**
 * Usuário autenticado
 */
router.get(

    "/me",

    authenticate,

    controller.me

);

/**
 * Lista usuários
 */
router.get(

    "/users",

    authenticate,

    authorize("Administrador"),

    controller.listarUsuarios

);

/**
 * Cadastro de usuários
 */
router.post(

    "/users",

    authenticate,

    authorize("Administrador"),

    controller.cadastrarUsuario

);

/**
 * Ativar/desativar usuário
 */
router.patch(

    "/users/:userId/status",

    authenticate,

    authorize("Administrador"),

    controller.alterarStatus

);

module.exports = router;