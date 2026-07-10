// server/auth/auth.controller.js
// Alterado de: const authService = require("../services/auth.service");
import * as authService from "../services/auth.service.js"; // Lembre-se da extensão .js

export async function me(req, res) {
    try {
        const usuario = await authService.carregarSessao(req.user.user_id);
        return res.status(200).json({ success: true, data: usuario });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: error.message });
    }
}



/**
 * Lista usuários.
 *
 * GET /api/auth/users
 */
async function listarUsuarios(req, res) {

    try {

        const usuarios = await authService.listarUsuarios();

        return res.status(200).json({

            success: true,

            data: usuarios

        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({

            success: false,

            message: error.message

        });

    }

}

/**
 * Cadastra um novo usuário.
 *
 * POST /api/auth/users
 */
async function cadastrarUsuario(req, res) {

    try {

        const usuario = await authService.cadastrarUsuario(req.body);

        return res.status(201).json({

            success: true,

            data: usuario

        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({

            success: false,

            message: error.message

        });

    }

}

/**
 * Ativa ou desativa usuário.
 *
 * PATCH /api/auth/users/:userId/status
 */
async function alterarStatus(req, res) {

    try {

        const { userId } = req.params;

        const { ativo } = req.body;

        const resultado = await authService.alterarStatus(

            userId,

            ativo

        );

        return res.status(200).json({

            success: true,

            data: resultado

        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({

            success: false,

            message: error.message

        });

    }

}

