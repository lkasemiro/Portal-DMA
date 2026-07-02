// js/modules/aedes/aedes-api.js

const API_BASE = window.location.hostname === "localhost" 
    ? "http://localhost:3001" 
    : "https://dma-aedes-api.onrender.com";

export const AedesAPI = {

    /**
     * Busca a lista de unidades operacionais registradas
     */
    async getUnidades() {
        try {
            const response = await fetch(`${API_BASE}/api/unidades`);
            if (!response.ok) throw new Error(`Status: ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error("❌ AedesAPI.getUnidades:", error);
            return [];
        }
    },

    /**
     * Busca os lotes enviados pelas unidades (contém o array de dados)
     */
    async getLotes() {
        try {
            const response = await fetch(`${API_BASE}/api/aedes/lotes`);
            if (!response.ok) throw new Error(`Status: ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error("❌ AedesAPI.getLotes:", error);
            return [];
        }
    },

    /**
     * Busca a lista oficial de focais técnicos cadastrados
     */
    async getFocais() {
        try {
            const response = await fetch(`${API_BASE}/api/aedes/focais`);
            if (!response.ok) throw new Error(`Status: ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error("❌ AedesAPI.getFocais:", error);
            return [];
        }
    },

    /**
     * Envia um lote de vistorias
     */
    async postLote(payload) {
        try {
            const response = await fetch(`${API_BASE}/api/aedes/lotes`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Erro ao salvar os dados no banco.");
            }

            return await response.json();
        } catch (error) {
            console.error("❌ AedesAPI.postLote:", error);
            throw error;
        }
    },

/**
     * Busca os dados unificados e tratados da tabela vistorias_itens
     */
    async getDadosPainel() {
        try {
            const response = await fetch(`${API_BASE}/api/aedes/painel-dados`);
            if (!response.ok) return [];
            const data = await response.json();
            return Array.isArray(data) ? data : [];
        } catch (error) {
            console.error("❌ AedesAPI.getDadosPainel:", error);
            return [];
        }
    },

    /**
     * Busca informações do responsável técnico para o Dossiê
     */
    async getFocalDossie(nomeUnidade) {
        try {
            const response = await fetch(`${API_BASE}/api/aedes/focal-dossie?unidade=${encodeURIComponent(nomeUnidade)}`);
            if (!response.ok) throw new Error();
            return await response.json();
        } catch (error) {
            console.error("❌ AedesAPI.getFocalDossie:", error);
            return { nome: null, matricula: null, email: null };
        }
    }
};