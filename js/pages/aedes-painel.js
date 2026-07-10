import { AedesAPI } from '/js/modules/aedes/aedes-api.js';

// Mapeamento dos nomes de meses retornados pelo banco para a abreviação do gráfico
const MAPA_MESES = {
    'Janeiro': 'Jan', 'Fevereiro': 'Fev', 'Março': 'Mar', 'Abril': 'Abr',
    'Maio': 'Mai', 'Junho': 'Jun', 'Julho': 'Jul', 'Agosto': 'Ago',
    'Setembro': 'Set', 'Outubro': 'Out', 'Novembro': 'Nov', 'Dezembro': 'Dez'
};

// =========================================================================
// INICIALIZAÇÃO DO PAINEL ANALÍTICO
// =========================================================================
export async function inicializarPainelAedes() {
    console.log("🟢 Iniciando o Painel Analítico do Aedes...");

    try {
        const registros = await AedesAPI.getDadosPainel();
        
        if (!registros || registros.length === 0) {
            console.warn("⚠️ Nenhum registro técnico retornado do banco.");
            return;
        }

        // Executar processamento mapeando os campos mapeados do backend
        processarDadosDashboard(registros);
        
    } catch (error) {
        console.error("❌ Erro ao inicializar o dashboard analítico:", error);
    }
}

// =========================================================================
// PROCESSAMENTO DAS MÉTRICAS REAIS (Baseado em aedes.vistorias_itens)
// =========================================================================
function processarDadosDashboard(registros) {
    let totalVistorias = registros.length;
    let totalVisitadas = 0;
    let totalFocos = 0;
    let acoesPendentes = 0;

    const evolucaoMeses = {}; 
    const dadosUnidades = {}; 

    registros.forEach(reg => {
        // 1. Agrupamento Cronológico usando as chaves reais: "Ano" e "Mes_Nome"
        const ano = reg.Ano || new Date().getFullYear();
        const mesNomeOriginal = reg.Mes_Nome || "Janeiro";
        const mesAbreviado = MAPA_MESES[mesNomeOriginal] || mesNomeOriginal;
        const chaveMes = `${ano} - ${mesAbreviado}`;
        
        if (!evolucaoMeses[chaveMes]) {
            evolucaoMeses[chaveMes] = { vistorias: 0, focos: 0 };
        }
        evolucaoMeses[chaveMes].vistorias++;

        // 2. Agrupamento por Unidade (campo real vindo do backend: "Unidade")
        const nomeUnidade = reg.Unidade || "Desconhecida";
        if (!dadosUnidades[nomeUnidade]) {
            dadosUnidades[nomeUnidade] = { total: 0, visitadas: 0 };
        }
        dadosUnidades[nomeUnidade].total++;

        // 3. Verificação de Visita Realizada (campo numérico: visitada)
        if (Number(reg.visitada) === 1) {
            totalVisitadas++;
            dadosUnidades[nomeUnidade].visitadas++;

            // 4. Verificação de Foco Encontrado (campo numérico: foco_encontrado)
            if (Number(reg.foco_encontrado) === 1) {
                totalFocos++;
                evolucaoMeses[chaveMes].focos++;

                // 5. Ação Pendente: Foco encontrado (1) mas NÃO remediado (foco_remediado === 0)
                if (Number(reg.foco_remediado) !== 1) {
                    acoesPendentes++;
                }
            }
        }
    });

    // --- POPULAR INDICADORES TEXTUAIS (KPI CARDS) ---
    const cobertura = totalVistorias > 0 ? ((totalVisitadas / totalVistorias) * 100).toFixed(1) : 0;

    if (document.getElementById('dash-kpi-amostras')) document.getElementById('dash-kpi-amostras').innerText = totalVistorias;
    if (document.getElementById('dash-kpi-cobertura')) document.getElementById('dash-kpi-cobertura').innerText = `${cobertura}%`;
    if (document.getElementById('dash-kpi-focos')) document.getElementById('dash-kpi-focos').innerText = totalFocos;
    if (document.getElementById('dash-kpi-pendentes')) document.getElementById('dash-kpi-pendentes').innerText = acoesPendentes;

    // --- DESENHAR GRÁFICO CRONOLÓGICO (PLOTLY) ---
    renderizarGraficoEvolucao(evolucaoMeses);

    // --- MONTAR O RANKING DE UNIDADES ---
    renderizarRankingUnidades(dadosUnidades);
}

// =========================================================================
// RENDERIZAÇÃO DO GRÁFICO PLOTLY.JS
// =========================================================================
function renderizarGraficoEvolucao(evolucaoMeses) {
    const elementoGrafico = document.getElementById('graficoEvolucaoAedes');
    if (!elementoGrafico || !window.Plotly) return;

    // Ordena as chaves dos meses para garantir ordem cronológica na linha
    const mesesLabels = Object.keys(evolucaoMeses).sort();
    const vistoriasValores = mesesLabels.map(m => evolucaoMeses[m].vistorias);
    const focosValores = mesesLabels.map(m => evolucaoMeses[m].focos);

    const traceVistorias = {
        x: mesesLabels,
        y: vistoriasValores,
        name: 'Vistorias Planejadas',
        type: 'scatter',
        mode: 'lines+markers',
        line: { color: '#3b82f6', width: 3 },
        marker: { size: 6 }
    };

    const traceFocos = {
        x: mesesLabels,
        y: focosValores,
        name: 'Focos Identificados',
        type: 'scatter',
        mode: 'lines+markers',
        line: { color: '#ef4444', width: 3 },
        marker: { size: 6 }
    };

    const data = [traceVistorias, traceFocos];

    const layout = {
        margin: { t: 20, b: 40, l: 40, r: 20 },
        hovermode: 'closest',
        legend: { orientation: 'h', y: -0.2 },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        xaxis: { showgrid: false, color: '#64748b' },
        yaxis: { gridcolor: '#f1f5f9', color: '#64748b' }
    };

    const config = { responsive: true, displayModeBar: false };

    Plotly.newPlot(elementoGrafico, data, layout, config);
}

// =========================================================================
// COMPONENTE DE RANKING DE EFICIÊNCIA DO DMA
// =========================================================================
function renderizarRankingUnidades(dadosUnidades) {
    const containerRanking = document.getElementById('listaRankingUnidades');
    if (!containerRanking) return;

    const listaOrdenada = Object.keys(dadosUnidades).map(nome => {
        const info = dadosUnidades[nome];
        const pctEficiencia = info.total > 0 ? Math.round((info.visitadas / info.total) * 100) : 0;
        return { nome, pctEficiencia, ...info };
    }).sort((a, b) => b.pctEficiencia - a.pctEficiencia);

    containerRanking.innerHTML = listaOrdenada.map((unidade, index) => {
        let corBarra = '#ef4444'; 
        if (unidade.pctEficiencia >= 80) corBarra = '#16a34a'; 
        else if (unidade.pctEficiencia >= 50) corBarra = '#f59e0b'; 

        return `
            <div style="background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #f1f5f9;">
                <div style="display: flex; justify-content: space-between; font-size: 0.85rem; font-weight: 600; color: #1e293b; margin-bottom: 6px;">
                    <span>#${index + 1} ${unidade.nome}</span>
                    <span style="color: ${corBarra};">${unidade.pctEficiencia}%</span>
                </div>
                <div style="width: 100%; height: 8px; background: #e2e8f0; border-radius: 4px; overflow: hidden;">
                    <div style="width: ${unidade.pctEficiencia}%; height: 100%; background: ${corBarra}; transition: width 0.5s ease-in-out;"></div>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 0.7rem; color: #64748b; margin-top: 4px;">
                    <span>Vistoriadas: ${unidade.visitadas}</span>
                    <span>Total: ${unidade.total}</span>
                </div>
            </div>
        `;
    }).join('');
}