// dashboard_aedes.js
// ─────────────────────────────────────────────────────────────
// CONFIGURAÇÃO DA API (Atualizado para o seu novo servidor)
// ─────────────────────────────────────────────────────────────

const API_BASE = "https://portal-dma.onrender.com"; // <-- Seu novo link oficial!
console.log("🌐 Conectado à nova API:", API_BASE);

// ─────────────────────────────────────────────────────────────
// CLIENTE DA API AEDES (Consumindo as novas Views do Banco)
// ─────────────────────────────────────────────────────────────

const AedesAPI = {
    // Busca a base histórica antiga (mantida por compatibilidade)
    async getDadosPainel() {
        try {
            const response = await fetch(`${API_BASE}/api/aedes/painel-dados`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const json = await response.json();
            return Array.isArray(json) ? json : (json.registros || []);
        } catch (error) {
            console.error("❌ Erro ao consultar painel-dados:", error);
            return [];
        }
    },

    // 1. Busca os dados dos Cards (KPIs)
    async getResumoGeral() {
        try {
            const response = await fetch(`${API_BASE}/api/aedes/resumo`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.json(); // Retorna { total_registros, total_vistorias, total_focos, total_remediados }
        } catch (error) {
            console.error("❌ Erro ao buscar resumo:", error);
            return { total_registros: 0, total_vistorias: 0, total_focos: 0, total_remediados: 0 };
        }
    },

    // 2. Busca os Motivos de Não Vistoria (para Gráfico de Pizza/Donut)
    async getMotivosNaoVistoria() {
        try {
            const response = await fetch(`${API_BASE}/api/aedes/motivos-nao-vistoria`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.json(); // Retorna Array de { motivo, quantidade }
        } catch (error) {
            console.error("❌ Erro ao buscar motivos de não vistoria:", error);
            return [];
        }
    },

    // 3. Busca o Ranking Dinâmico das Unidades
    async getEstatistiscasUnidades() {
        try {
            const response = await fetch(`${API_BASE}/api/aedes/vistas-unidades`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.json(); // Retorna Array de { unidade_nome, registros, vistorias, focos, focos_remediados }
        } catch (error) {
            console.error("❌ Erro ao buscar estatísticas por unidade:", error);
            return [];
        }
    }
};

// ─────────────────────────────────────────────────────────────
// FUNÇÃO EXEMPLO DE RENDERIZAÇÃO NA TELA
// ─────────────────────────────────────────────────────────────

async function carregarNovoDashboard() {
    // A) Renderizar os Cards de Cima com os dados da View vw_resumo_aedes
    const resumo = await AedesAPI.getResumoGeral();
    
    const cardVistorias = document.getElementById("total-vistorias-card"); // Ajuste com o ID real do seu HTML
    if (cardVistorias) cardVistorias.innerText = resumo.total_vistorias;

    const cardFocos = document.getElementById("total-focos-card");
    if (cardFocos) cardFocos.innerText = resumo.total_focos;

    // B) Renderizar o Gráfico de Motivos (usando Chart.js ou outra biblioteca que use)
    const motivos = await AedesAPI.getMotivosNaoVistoria();
    console.log("Dados para o Gráfico de Pizza:", motivos);
    // Aqui entra a lógica de atualizar os labels e datasets do seu gráfico de pizza antigo...

    // C) Renderizar o Ranking de Unidades Dinâmico
    const unidades = await AedesAPI.getEstatistiscasUnidades();
    const containerRanking = document.getElementById("ranking-unidades-container");
    
    if (containerRanking && unidades.length > 0) {
        containerRanking.innerHTML = unidades.map((unidade, index) => {
            // Calcula a eficiência direto com os dados limpos vindos da view
            const pctEficiencia = unidade.vistorias > 0 ? Math.round((unidade.vistorias / unidade.registros) * 100) : 0;
            
            let corBarra = '#ef4444'; 
            if (pctEficiencia >= 80) corBarra = '#16a34a'; 
            else if (pctEficiencia >= 50) corBarra = '#f59e0b'; 

            return `
                <div style="background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #f1f5f9; margin-bottom: 8px;">
                    <div style="display: flex; justify-content: space-between; font-size: 0.85rem; font-weight: 600; color: #1e293b; margin-bottom: 6px;">
                        <span>#${index + 1} ${unidade.unidade_nome}</span>
                        <span style="color: ${corBarra};">${pctEficiencia}%</span>
                    </div>
                    <div style="width: 100%; height: 8px; background: #e2e8f0; border-radius: 4px; overflow: hidden;">
                        <div style="width: ${pctEficiencia}%; height: 100%; background: ${corBarra};"></div>
                    </div>
                </div>
            `;
        }).join('');
    }
}

// Executa ao carregar a página
document.addEventListener("DOMContentLoaded", carregarNovoDashboard);