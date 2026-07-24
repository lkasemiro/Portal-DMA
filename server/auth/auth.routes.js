/* auth.routes.js*/
import express from "express";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./auth.config.js";
import { verificarAutenticacao, authorize } from "./auth.middleware.js";
import * as controller from "./auth.controller.js";

const router = express.Router();

/* ==========================================================================
   1. ROTAS CUSTOMIZADAS DE GESTÃO E DINÂMICA DE ACESSO
   Nota: Elas devem vir ANTES do handler coringa (/*) para não serem interceptadas.
   ========================================================================== */

/**
 * Buscar o menu/páginas dinâmicas do usuário logado
 * Acessível a qualquer perfil autenticado (Focal, Técnico, Administrador, Dev)
 */
router.get(
    "/minhas-paginas", 
    verificarAutenticacao, 
    controller.obterPaginasPermitidas
);

/**
 * Listar usuários do sistema (Exibe no painel de controle)
 * Protegido: Apenas Administradores e Desenvolvedores podem ver a lista
 */
router.get(
    "/usuarios", 
    verificarAutenticacao, 
    authorize("Desenvolvedor", "Administrador"), 
    controller.listarUsuariosEPerfis
);

/**
 * Alterar a role (papel) de um usuário dinamicamente
 * Protegido: Apenas Administradores e Desenvolvedores podem alterar cargos
 */
router.patch(
    "/usuarios/:userId/role", 
    verificarAutenticacao, 
    authorize("Desenvolvedor", "Administrador"), 
    controller.atualizarRoleUsuario
);

/**
 * Criar ou atualizar matriz de acesso de páginas
 * Protegido: Exclusivo do Desenvolvedor alterar regras estruturais do site
 */
router.post(
    "/regras-paginas", 
    verificarAutenticacao, 
    authorize("Desenvolvedor"), 
    controller.salvarRegrasPaginas
);

/* ==========================================================================
   2. ROTEADOR UNIVERSAL DO BETTER AUTH
   Captura todas as outras requisições (Ex: /login, /sign-up, /sign-out, /session)
   ========================================================================== */
router.all("{/*any}", toNodeHandler(auth));

export default router;