// ======================================================
// Portal Ambiental
// API - Módulo Aedes aegypti (Sincronizado com o Novo Backend)
// ======================================================

// IMPORTANTE: Importa a URL dinâmica direto do arquivo de configuração
import { API_BASE } from '../../core/api-config.js';

export const AedesAPI = {

    // ==================================================
    // Unidades (Dados Gerais da Tabela Antiga)
    // ==================================================
    async getUnidades() {
        try {
            // CORRIGIDO: Adicionado o prefixo "/aedes" para alinhar com o roteador do Express
            const response = await fetch(`${API_BASE}/api/aedes/unidades`);
            
            // Em vez de lançar erro direto e quebrar o fluxo do dashboard, 
            // logamos o erro e retornamos um fallback seguro (array vazio)
            if (!response.ok) {
                console.warn(`⚠️ getUnidades falhou com status ${response.status}. Usando fallback vazio.`);
                return []; 
            }
            return await response.json();
        } catch (error) {
            console.error("❌ getUnidades:", error);
            return []; // Fallback seguro
        }
    },
    // ==================================================
    // NOVAS VIEWS - Estatísticas Agregadas por Unidade
    // ==================================================
    async getEstatisticasUnidades() {
        try {
            // Bate na view: aedes.vw_unidades_aedes
            const response = await fetch(`${API_BASE}/api/aedes/vistas-unidades`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error("❌ getEstatisticasUnidades:", error);
            return [];
        }
    },

    // ==================================================
    // NOVA VIEW - Resumo Geral do Aedes (Cards/KPIs)
    // ==================================================
    async getResumoGeral() {
        try {
            // Bate na view: aedes.vw_resumo_aedes
            const response = await fetch(`${API_BASE}/api/aedes/resumo`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.json(); // Retorna { total_registros, total_vistorias, total_focos, total_remediados }
        } catch (error) {
            console.error("❌ getResumoGeral:", error);
            return { total_registros: 0, total_vistorias: 0, total_focos: 0, total_remediados: 0 };
        }
    },

    // ==================================================
    // NOVA VIEW - Impedimentos e Motivos de Não Vistoria
    // ==================================================
    async getMotivosNaoVistoria() {
        try {
            // Bate na view: aedes.vw_motivos_nao_vistoria
            const response = await fetch(`${API_BASE}/api/aedes/motivos-nao-vistoria`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error("❌ getMotivosNaoVistoria:", error);
            return [];
        }
    },

    // ==================================================
    // NOVA VIEW - Motivos de Não Remediação de Focos
    // ==================================================
    async getMotivosNaoRemediacao() {
        try {
            // Bate na view: aedes.vw_motivos_nao_remediacao
            const response = await fetch(`${API_BASE}/api/aedes/motivos-nao-remediacao`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error("❌ getMotivosNaoRemediacao:", error);
            return [];
        }
    },

    // ==================================================
    // Lotes
    // ==================================================
    async getLotes() {
        try {
            const response = await fetch(`${API_BASE}/api/aedes/lotes`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
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
            const response = await fetch(`${API_BASE}/api/aedes/focais`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
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
        const response = await fetch(`${API_BASE}/api/aedes/lotes`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const erro = await response.json();
            throw new Error(erro.error || "Erro ao salvar lote.");
        }
        return await response.json();
    },

    // ==================================================
    // Dashboard / Painel Dados (Histórico Completo)
    // ==================================================
    async getDadosPainel() {
        try {
            const response = await fetch(`${API_BASE}/api/aedes/painel-dados`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const json = await response.json();
            if (Array.isArray(json)) return json;
            if (Array.isArray(json.registros)) return json.registros;
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
            const response = await fetch(
                `${API_BASE}/api/aedes/focal-dossie?unidade=${encodeURIComponent(unidade)}`
            );
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error("❌ getFocalDossie:", error);
            return { nome: null, matricula: null, email: null };
        }
    }
};