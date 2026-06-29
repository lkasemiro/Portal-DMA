/**
 * ============================================================
 * Portal Ambiental
 * Serviço de Autenticação
 * ============================================================
 *
 * Responsável por integrar o Neon Auth com a tabela auth.perfis.
 * Não realiza login nem cadastro de usuários.
 */

const perfilService = require("./perfil.service");

/**
 * Retorna o perfil do usuário autenticado.
 * Lança erro caso o usuário não exista
 * ou esteja desativado.
 */
async function obterUsuario(userId) {

    const perfil = await perfilService.buscarPorUserId(userId);

    if (!perfil) {
        throw new Error("Usuário não cadastrado no Portal Ambiental.");
    }

    if (!perfil.ativo) {
        throw new Error("Usuário desativado.");
    }

    return perfil;
}

/**
 * Registra o último acesso do usuário.
 */
async function registrarLogin(userId) {

    await perfilService.atualizarUltimoLogin(userId);

}

/**
 * Retorna o perfil do usuário autenticado
 * juntamente com suas permissões.
 */
async function carregarSessao(userId) {

    const usuario = await obterUsuario(userId);

    await registrarLogin(userId);

    return usuario;

}

/**
 * Lista todos os usuários cadastrados.
 */
async function listarUsuarios() {

    return perfilService.listarPerfis();

}

/**
 * Busca um usuário pelo código público.
 */
async function buscarUsuario(codigo) {

    return perfilService.buscarPorCodigo(codigo);

}

/**
 * Ativa ou desativa um usuário.
 */
async function alterarStatus(userId, ativo) {

    return perfilService.alterarStatus(userId, ativo);

}

/**
 * Cadastro realizado apenas por administradores.
 */
async function cadastrarUsuario(dados) {

    return perfilService.criarPerfil(dados);

}

module.exports = {

    carregarSessao,

    obterUsuario,

    registrarLogin,

    listarUsuarios,

    buscarUsuario,

    alterarStatus,

    cadastrarUsuario

};