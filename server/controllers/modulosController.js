/**
 * ============================================================
 * Portal Ambiental
 * Controller de Módulos (Versão ES Modules)
 * ============================================================
 *
 * Responsável por disponibilizar os módulos existentes
 * do Portal Ambiental.
 */

import * as moduloService from "../services/modulo.service.js";

/**
 * ============================================================
 * Lista todos os módulos disponíveis.
 *
 * GET /api/modulos
 * ============================================================
 */
async function listar(req, res) {
    try {
        const modulos = await moduloService.listar();

        return res.status(200).json({
            success: true,
            data: modulos
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: "Erro ao listar módulos."
        });
    }
}

/**
 * ============================================================
 * Retorna um módulo específico.
 *
 * GET /api/modulos/:codigo
 * ============================================================
 */
async function obter(req, res) {
    try {
        const { codigo } = req.params;
        const modulo = await moduloService.obter(codigo);

        if (!modulo) {
            return res.status(404).json({
                success: false,
                message: "Módulo não encontrado."
            });
        }

        return res.status(200).json({
            success: true,
            data: modulo
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: "Erro ao consultar módulo."
        });
    }
}

/**
 * ============================================================
 * Lista apenas módulos ativos.
 *
 * Utilizado pelo menu principal do Portal.
 *
 * GET /api/modulos/ativos
 * ============================================================
 */
async function listarAtivos(req, res) {
    try {
        const modulos = await moduloService.listarAtivos();

        return res.status(200).json({
            success: true,
            data: modulos
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: "Erro ao listar módulos ativos."
        });
    }
}

// Exportações nomeadas aceitas pelo escopo ESM
export {
    listar,
    obter,
    listarAtivos
};