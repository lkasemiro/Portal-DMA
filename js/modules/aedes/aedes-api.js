// ======================================================
// Portal Ambiental
// API - Módulo Aedes aegypti (Sincronizado com o Novo Backend)
// ======================================================

// IMPORTANTE: Importa a URL dinâmica direto do arquivo de configuração
import { API_BASE } from '/js/core/api-config.js';
export const AedesAPI = {

    // ==================================================
    // Unidades
    // ==================================================
    async getUnidades() {
        try {
            // Mantido o caminho conforme mapeado no seu server.js (/api/unidades)
            const response = await fetch(`${API_BASE}/api/unidades`);

            if (!response.ok)
                throw new Error(`HTTP ${response.status}`);

            return await response.json();
        } catch (error) {
            console.error("❌ getUnidades:", error);
            return [];
        }
    },

    // ==================================================
    // Lotes
    // ==================================================
    async getLotes() {
        try {
            // Bate perfeitamente no router.get("/lotes") do backend
            const response = await fetch(`${API_BASE}/api/aedes/lotes`);

            if (!response.ok)
                throw new Error(`HTTP ${response.status}`);

            return await response.json();
        } catch (error) {
            console.error("❌ getLotes:", error);
            return [];
        }
    },

    // ==================================================
    // Focais
    // ==================================================
    async getFocais() {
        try {
            // Bate no router.get("/focais") do backend
            const response = await fetch(`${API_BASE}/api/aedes/focais`);

            if (!response.ok)
                throw new Error(`HTTP ${response.status}`);

            return await response.json();
        } catch (error) {
            console.error("❌ getFocais:", error);
            return [];
        }
    },

    // ==================================================
    // Envio de Lote (POST)
    // ==================================================
    async postLote(payload) {
        // Bate no router.post("/lotes") do backend
        const response = await fetch(`${API_BASE}/api/aedes/lotes`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const erro = await response.json();
            throw new Error(
                erro.error || "Erro ao salvar lote."
            );
        }

        return await response.json();
    },

    // ==================================================
    // Dashboard / Painel Dados
    // ==================================================
    async getDadosPainel() {
        try {
            // Bate no router.get("/painel-dados") do backend
            const response = await fetch(`${API_BASE}/api/aedes/painel-dados`);

            if (!response.ok)
                throw new Error(`HTTP ${response.status}`);

            const json = await response.json();
            console.log("📦 Resposta painel:", json);

            // Caso a API retorne somente um array de linhas
            if (Array.isArray(json))
                return json;

            // Tratamento caso decida encapsular em um objeto { registros: [...] }
            if (Array.isArray(json.registros))
                return json.registros;

            return [];
        } catch (error) {
            console.error("❌ getDadosPainel:", error);
            return [];
        }
    },

    // ==================================================
    // Dossiê do Focal
    // ==================================================
    async getFocalDossie(unidade) {
        try {
            // Bate no router.get("/focal-dossie") do backend
            const response = await fetch(
                `${API_BASE}/api/aedes/focal-dossie?unidade=${encodeURIComponent(unidade)}`
            );

            if (!response.ok)
                throw new Error(`HTTP ${response.status}`);

            return await response.json();
        } catch (error) {
            console.error("❌ getFocalDossie:", error);
            return {
                nome: null,
                matricula: null,
                email: null
            };
        }
    }
};