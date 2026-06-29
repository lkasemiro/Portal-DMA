/**
 * ============================================================
 * Portal Ambiental
 * Papéis e permissões do sistema
 * ============================================================
 */

const PAPEIS = Object.freeze({
    ADMINISTRADOR: "Administrador",
    EDITOR: "Editor",
    LEITOR: "Leitor"
});

/**
 * Verifica se o usuário é administrador
 */
function isAdministrador(usuario) {
    return usuario?.papel === PAPEIS.ADMINISTRADOR;
}

/**
 * Verifica se o usuário é editor
 */
function isEditor(usuario) {
    return usuario?.papel === PAPEIS.EDITOR;
}

/**
 * Verifica se o usuário é leitor
 */
function isLeitor(usuario) {
    return usuario?.papel === PAPEIS.LEITOR;
}

/**
 * Verifica se possui um dos papéis informados
 */
function possuiPapel(usuario, papeis = []) {
    if (!usuario) return false;

    return papeis.includes(usuario.papel);
}

module.exports = {
    PAPEIS,
    isAdministrador,
    isEditor,
    isLeitor,
    possuiPapel
};