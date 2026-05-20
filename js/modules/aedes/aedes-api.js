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
     * Consolida a base de dados mapeando os motivos diretamente do JSON de lotes
     */
    async getDadosPainel() {
        try {
            const lotes = await this.getLotes();
            const registrosAnaliticos = [];

            const ordemMesesRef = [
                "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
                "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
            ];

            lotes.forEach(lote => {
                const dados = lote.payload_completo?.dados || lote.dados || [];
                const dataEnvio = lote.data_envio ? new Date(lote.data_envio) : null;
                
                const ano = dataEnvio ? dataEnvio.getFullYear() : 2026; 
                const mesNome = dataEnvio ? ordemMesesRef[dataEnvio.getMonth()] : "Não Informado";

                dados.forEach(r => {
                    const statusVistoria = String(r[2]).toLowerCase().trim();
                    const visitada = statusVistoria === 'sim' ? 1 : 0;
                    
                    const temFoco = (visitada && String(r[3]).toLowerCase().trim() === 'sim') ? 1 : 0;
                    const remediado = (temFoco && String(r[4]).toLowerCase().trim() === 'sim') ? 1 : 0;
                    const pendente = (temFoco && !remediado) ? 1 : 0;

                    // --- TRATAMENTO DOS MOTIVOS DIRETO DO JSON (r[7] e r[9]) ---
                    // Convertemos para string minúscula para fazer a busca indexada por chaves do banco
                    const motivoNV = Array.isArray(r[7]) ? r[7].join(" ").toLowerCase() : String(r[7] || "").toLowerCase();
                    const motivoMNR = Array.isArray(r[9]) ? r[9].join(" ").toLowerCase() : String(r[9] || "").toLowerCase();

                    registrosAnaliticos.push({
                        Ano: ano,
                        Mes_Nome: mesNome,
                        Unidade: r[1] || "Unidade Não Identificada",
                        visitada: visitada,
                        foco_encontrado: temFoco,
                        foco_remediado: remediado,
                        foco_pendente: pendente,
                        
                        // Mapeamento baseado nas CHAVES REAIS do JSON (LABELS_MAP)
                        nv_acesso: (motivoNV.includes("acesso") || motivoNV.includes("condicao")) ? 1 : 0,
                        nv_brigadista: motivoNV.includes("brigadista") ? 1 : 0,
                        nv_viatura: motivoNV.includes("viatura") ? 1 : 0,
                        nv_esquecimento: motivoNV.includes("esquecimento") ? 1 : 0,
                        
                        mnr_capacitacao: (motivoMNR.includes("treino") || motivoMNR.includes("capacita")) ? 1 : 0,
                        mnr_larvicida: (motivoMNR.includes("cloro") || motivoMNR.includes("larvicida")) ? 1 : 0,
                        mnr_limpeza: motivoMNR.includes("limpeza") ? 1 : 0,
                        mnr_cobertura: (motivoMNR.includes("cobertura") || motivoMNR.includes("tampa")) ? 1 : 0
                    });
                });
            });

            return registrosAnaliticos;
        } catch (error) {
            console.error("❌ Erro em processar getDadosPainel:", error);
            return [];
        }
    },
    // Substitua o método getFocalDossie por esta versão corrigida:
/**
     * Busca o focal técnico responsável pela unidade para alimentar o Dossiê
     */
   async getFocalDossie(nomeUnidade) {
        try {
            // Consome a constante oficial (API_BASE) que gerencia localhost vs Render automaticamente
            const response = await fetch(`${API_BASE}/api/aedes/focal-dossie?unidade=${encodeURIComponent(nomeUnidade)}`);
            
            if (!response.ok) throw new Error(`Erro HTTP: ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error("❌ AedesAPI.getFocalDossie:", error);
            return { nome: null, matricula: null, email: null };
        }
    }
};