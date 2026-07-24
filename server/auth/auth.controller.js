import { auth } from "./auth.config.js";
import { pool } from "../database/db.js";

/**
 * GET /api/auth/usuarios
 * Lista todos os usuários cadastrados no Better Auth (Painel de Gestão).
 */
export async function listarUsuariosEPerfis(req, res) {
    try {
        // Usa o plugin 'admin' do Better Auth para listar os usuários do sistema
        const usuarios = await auth.api.listUsers({ asUser: req.user });
        
        return res.status(200).json({ 
            success: true, 
            data: usuarios 
        });
    } catch (error) {
        console.error("❌ Erro ao listar usuários:", error.message);
        return res.status(500).json({ success: false, message: error.message });
    }
}

/**
 * PATCH /api/auth/usuarios/:userId/role
 * Altera dinamicamente o papel (role) de um usuário através do painel.
 */
export async function atualizarRoleUsuario(req, res) {
    const { userId } = req.params;
    const { novaRole } = req.body;

    try {
        // Árvore de papéis válidos no ecossistema
        const rolesValidas = ["Desenvolvedor", "Administrador", "Equipe_Tecnica", "Cedae_Funcionario", "Focal"];
        if (!rolesValidas.includes(novaRole)) {
            return res.status(400).json({ success: false, message: "Papel de acesso inválido." });
        }

        // Altera a role executando a validação de segurança interna do Better Auth (via asUser)
        await auth.api.setRole({
            userId: userId,
            role: novaRole,
            asUser: req.user 
        });

        return res.status(200).json({ 
            success: true, 
            message: `Papel atualizado com sucesso para: ${novaRole}` 
        });
    } catch (error) {
        console.error("❌ Erro ao atualizar papel do usuário:", error.message);
        return res.status(500).json({ success: false, message: error.message });
    }
}

/**
 * GET /api/auth/minhas-paginas
 * Busca no banco Neon as páginas/menus permitidos para a role do usuário logado.
 */
export async function obterPaginasPermitidas(req, res) {
    // Caso o usuário não possua role definida por alguma inconsistência, assume 'Focal'
    const userRole = req.user?.role || "Focal";

    try {
        // Consulta a tabela de matriz de acesso dinâmico
        const { rows } = await pool.query(
            "SELECT pagina_url, nome_menu, icone FROM regras_acesso_paginas WHERE role_permitida = $1",
            [userRole]
        );

        return res.status(200).json({ 
            success: true, 
            paginas: rows 
        });
    } catch (error) {
        console.error("❌ Erro ao carregar rotas do menu dinâmico:", error.message);
        return res.status(500).json({ success: false, message: "Falha ao processar permissões de menu." });
    }
}

/**
 * POST /api/auth/regras-paginas
 * Permite ao Desenvolvedor cadastrar/atualizar permissões de páginas direto pelo site.
 */
export async function salvarRegrasPaginas(req, res) {
    const { pagina_url, nome_menu, icone, role_permitida } = req.body;

    try {
        await pool.query(
            `INSERT INTO regras_acesso_paginas (pagina_url, nome_menu, icone, role_permitida) 
             VALUES ($1, $2, $3, $4) 
             ON CONFLICT (pagina_url, role_permitida) 
             DO UPDATE SET nome_menu = $2, icone = $3`,
            [pagina_url, nome_menu, icone, role_permitida]
        );

        return res.status(200).json({ success: true, message: "Regra de acesso salva com sucesso!" });
    } catch (error) {
        console.error("❌ Erro ao salvar regra de página:", error.message);
        return res.status(500).json({ success: false, message: error.message });
    }
}