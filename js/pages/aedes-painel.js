// js/pages/aedes-painel.js
import { AedesAPI } from '../modules/aedes/aedes-api.js';



let df_completo = [];
let df_focais = [];
let lista_unidades_original = [];

const fmtInt = (num) => new Intl.NumberFormat('pt-BR').format(num);

function injetarEstilosCSS() {
    if (document.getElementById('css-modulo-aedes-painel')) return;

    const style = document.createElement('style');
    style.id = 'css-modulo-aedes-painel';
    style.innerHTML = `
        .painel-filtros-topo { display: flex; gap: 20px; margin-bottom: 20px; background: white; padding: 20px; border-radius: 12px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0; }
        .filtro-campo { flex: 1; }
        .filtro-campo label { font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.05em; }
        .filtro-campo select { width: 100%; padding: 10px; border-radius: 8px; border: 1px solid #cbd5e1; margin-top: 6px; background-color: #f8fafc; font-weight: 500; color: #1e293b; }
        
        .btn-dashboard-voltar { background: white; border: 1px solid #cbd5e1; padding: 10px 16px; border-radius: 6px; font-weight: 600; color: #334155; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: all 0.2s; }
        .btn-dashboard-voltar:hover { background: #f8fafc; border-color: #94a3b8; }

        .sub-tabs-container { display: flex; gap: 10px; margin-bottom: 25px; border-bottom: 2px solid #e2e8f0; }
        .sub-tab-btn { padding: 10px 20px; background: none; border: none; border-bottom: 3px solid transparent; font-weight: 600; color: #64748b; cursor: pointer; font-size: 14px; margin-bottom: -2px; transition: all 0.2s; }
        .sub-tab-btn.active { font-weight: 700; color: #2563eb; border-bottom-color: #2563eb; }

        .grid-kpi-cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 28px; }
        .kpi-card { background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 22px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05); }
        .kpi-label { font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; }
        .kpi-valor { font-size: 32px; font-weight: 800; color: #0f172a; margin-top: 8px; }
        .card-blue { border-left: 5px solid #2563eb; }
        .card-amber { border-left: 5px solid #f59e0b; }
        .card-green { border-left: 5px solid #10b981; }
        .card-red { border-left: 5px solid #ef4444; }

        .panel-grafico-box { background: white; padding: 24px; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05); }
        .panel-grafico-titulo { font-size: 15px; font-weight: 700; margin-top: 0; margin-bottom: 20px; color: #1e293b; display: flex; align-items: center; gap: 8px; }

        .grid-unidades-layout { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 20px; margin-bottom: 25px; }
        .card-unidade-clicavel { background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.02); display: flex; flex-direction: column; justify-content: space-between; cursor: pointer; transition: transform 0.2s, box-shadow 0.2s; }
        .card-unidade-clicavel:hover { transform: translateY(-2px); box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05); border-color: #cbd5e1; }

        .modal-backdrop-blur { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(15, 23, 42, 0.6); z-index: 9999; backdrop-filter: blur(4px); align-items: center; justify-content: center; padding: 20px; }
        .modal-container-box { background: white; width: 100%; max-width: 750px; max-height: 85vh; border-radius: 16px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); display: flex; flex-direction: column; overflow: hidden; animation: modalFadeInAedes 0.2s ease-out; }
        .modal-header-container { padding: 20px 24px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; background: #f8fafc; }
        .modal-header-container h3 { margin: 0; color: #0f172a; font-size: 1.3rem; font-weight: 800; }
        .modal-header-container p { margin: 4px 0 0 0; color: #64748b; font-size: 0.85rem; }
        #modal-fechar-btn { background: none; border: none; font-size: 20px; color: #94a3b8; cursor: pointer; padding: 5px; }
        .modal-corpo-scroll { padding: 24px; overflow-y: auto; flex: 1; font-family: sans-serif; }
        .focal-container-alert { border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 24px; background: #f0fdf4; border-left: 5px solid #10b981; }
        .focal-container-alert h4 { margin: 0 0 10px 0; color: #14532d; font-size: 13px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em; }
        .tabela-scroll-wrapper { border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; }
        .tabela-analitica-modal { width: 100%; border-collapse: collapse; text-align: left; font-size: 13px; }
        .tabela-analitica-modal thead { background: #f1f5f9; color: #475569; font-weight: 700; border-bottom: 1px solid #e2e8f0; }
        .tabela-analitica-modal th, .tabela-analitica-modal td { padding: 12px 14px; }
        .modal-footer-container { padding: 16px 24px; border-top: 1px solid #e2e8f0; display: flex; justify-content: flex-end; gap: 12px; background: #f8fafc; }
        .btn-modal-primario { background: #2563eb; border: none; padding: 10px 16px; border-radius: 8px; font-weight: 600; color: white; cursor: pointer; display: flex; align-items: center; gap: 8px; font-size: 13px; }
        .btn-modal-secundario { background: white; border: 1px solid #cbd5e1; padding: 10px 16px; border-radius: 8px; font-weight: 600; color: #334155; cursor: pointer; display: flex; align-items: center; gap: 8px; font-size: 13px; }
        
        @keyframes modalFadeInAedes { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
    `;
    document.head.appendChild(style);
}

function construirEstruturaHTML() {
    return `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 1px solid #e2e8f0;">
          <div>
            <h1 style="color: #0f172a; font-size: 2.2rem; font-weight: 800; letter-spacing: -0.025em; margin: 0;">Aedes Intelligence</h1>
            <p style="color: #64748b; margin: 5px 0 0 0; font-size: 0.95rem;">Análise analítica de performance operacional em tempo real.</p>
          </div>
          <div>
            <button id="btn-sair-painel" class="btn-dashboard-voltar"><i class="fas fa-arrow-left"></i> Voltar aos Registros</button>
          </div>
        </div>

        <div class="painel-filtros-topo">
            <div class="filtro-campo"><label>Ano de Exercício</label><select id="p_filtro_ano"></select></div>
            <div class="filtro-campo"><label>Unidade Avançada</label><select id="p_filtro_unidade"></select></div>
            <div class="filtro-campo"><label>Janela Mensal</label><select id="p_filtro_mes"></select></div>
        </div>

        <div class="sub-tabs-container">
            <button id="sub-tab-graficos" class="sub-tab-btn active"><i class="fas fa-chart-pie"></i> Visão Gráfica Global</button>
            <button id="sub-tab-unidades" class="sub-tab-btn"><i class="fas fa-th-large"></i> Desempenho por Unidade</button>
        </div>

        <div id="wrapper-sub-visao-grafica" style="display: block;">
            <div class="grid-kpi-cards">
                <div class="kpi-card card-blue"><div class="kpi-label">Vistorias Efetuadas</div><div id="kpi_vistorias" class="kpi-valor">0</div></div>
                <div class="kpi-card card-amber"><div class="kpi-label">Focos Identificados</div><div id="kpi_focos" class="kpi-valor">0</div></div>
                <div class="kpi-card card-green"><div class="kpi-label">Casos Remediados</div><div id="kpi_remediados" class="kpi-valor">0</div></div>
                <div class="kpi-card card-red"><div class="kpi-label">Demandas Pendentes</div><div id="kpi_pendentes" class="kpi-valor">0</div></div>
            </div>

            <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 24px; margin-bottom: 24px;">
                <div class="panel-grafico-box">
                    <h3 class="panel-grafico-titulo"><i class="fas fa-chart-line" style="color:#2563eb;"></i> Evolução Temporal de Focos vs Remediação</h3>
                    <div id="chart_focos_remediados" style="width:100%; height: 320px;"></div>
                </div>
                <div class="panel-grafico-box">
                    <h3 class="panel-grafico-titulo"><i class="fas fa-pie-chart" style="color:#10b981;"></i> Índice de Vulnerabilidade</h3>
                    <div id="chart_donuts_risco" style="width:100%; height: 320px;"></div>
                </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 20px;">
                <div class="panel-grafico-box">
                    <h3 class="panel-grafico-titulo" style="color:#b45309;"><i class="fas fa-exclamation-triangle"></i> Motivos de Não Vistoria (Gargalos NV)</h3>
                    <div id="chart_impedimentos_nv" style="width:100%; height: 280px;"></div>
                </div>
                <div class="panel-grafico-box">
                    <h3 class="panel-grafico-titulo" style="color:#1e3a8a;"><i class="fas fa-tools"></i> Causas de Não Remediação (Gargalos MNR)</h3>
                    <div id="chart_impedimentos_mnr" style="width:100%; height: 280px;"></div>
                </div>
            </div>
        </div>

        <div id="wrapper-sub-visao-unidades" style="display: none;">
            <div id="grid-caixas-unidades" class="grid-unidades-layout"></div>
        </div>

        <div id="modal-detalhe-unidade" class="modal-backdrop-blur">
            <div class="modal-container-box">
                <div class="modal-header-container">
                    <div><h3 id="modal-titulo-unidade">Nome da Unidade</h3><p>Dossiê Operacional e Ficha de Contato Oficial</p></div>
                    <button id="modal-fechar-btn"><i class="fas fa-times"></i></button>
                </div>
                <div class="modal-corpo-scroll">
                    <div class="focal-container-alert"><h4><i class="fas fa-user-shield"></i> Focal Técnico Responsável</h4><div id="modal-corpo-focal"></div></div>
                    <h4><i class="fas fa-history"></i> Histórico Sequencial de Vistorias</h4>
                    <div class="tabela-scroll-wrapper">
                        <table class="tabela-analitica-modal">
                            <thead><tr><th>Janela/Mês</th><th style="text-align:center;">Vistorias</th><th style="text-align:center;">Focos</th><th style="text-align:center;">Remediados</th><th style="text-align:center;">Pendentes</th></tr></thead>
                            <tbody id="modal-tabela-linhas"></tbody>
                        </table>
                    </div>
                </div>
                <div class="modal-footer-container">
                    <button id="modal-btn-copiar" class="btn-modal-secundario"><i class="fas fa-copy"></i> Copiar Resumo</button>
                    <button id="modal-btn-baixar" class="btn-modal-primario"><i class="fas fa-download"></i> Baixar CSV</button>
                </div>
            </div>
        </div>
    `;
}

export async function inicializarPainelAedes() {
    const container = document.getElementById('secao-painel-dashboard');
    if (!container) return;

    try {
        injetarEstilosCSS();
        container.innerHTML = construirEstruturaHTML();

        df_completo = await AedesAPI.getDadosPainel();
        try { df_focais = await AedesAPI.getFocais(); } catch (fError) { df_focais = []; }

        if (!df_completo || df_completo.length === 0) {
            container.innerHTML = `<div style="padding:50px; text-align:center; color:#eab308;"><i class="fas fa-exclamation-circle fa-2x"></i><p style="margin-top:15px; font-weight:600;">Nenhum registro encontrado a partir da data de corte.</p></div>`;
            return;
        }

        const anos = [...new Set(df_completo.map(d => d.Ano))].sort((a, b) => b - a);
        lista_unidades_original = [...new Set(df_completo.map(d => d.Unidade))].sort();

        const ordemMesesRef = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
        const meses = [...new Set(df_completo.map(d => d.Mes_Nome))].sort((a, b) => ordemMesesRef.indexOf(a) - ordemMesesRef.indexOf(b));

        popularSeletores(anos, meses);
        configurarListeners();
        atualizarPainelGeral();

    } catch (err) {
        console.error("Erro crítico na inicialização do painel:", err);
        container.innerHTML = `<div style="padding:50px; text-align:center; color:#ef4444;"><i class="fas fa-times-circle fa-2x"></i><h3 style="margin:10px 0;">Falha ao carregar Painel Analítico</h3><p style="color:#64748b;">${err.message}</p></div>`;
    }
}

function popularSeletores(anos, meses) {
    document.getElementById('p_filtro_ano').innerHTML = `<option value="Todos">Todos os Anos</option>` + anos.map(a => `<option value="${a}">${a}</option>`).join('');
    document.getElementById('p_filtro_unidade').innerHTML = `<option value="Todas">Todas as Unidades</option>` + lista_unidades_original.map(u => `<option value="${u}">${u}</option>`).join('');
    document.getElementById('p_filtro_mes').innerHTML = `<option value="Todos">Todos os Meses</option>` + meses.map(m => `<option value="${m}">${m}</option>`).join('');
}

function configurarListeners() {
    ['p_filtro_ano', 'p_filtro_unidade', 'p_filtro_mes'].forEach(id => {
        document.getElementById(id).addEventListener('change', atualizarPainelGeral);
    });

    const btnSair = document.getElementById('btn-sair-painel');
    if (btnSair) btnSair.onclick = () => window.location.href = './aedes-tecnico.html';

    const tabGraficos = document.getElementById('sub-tab-graficos');
    const tabUnidades = document.getElementById('sub-tab-unidades');
    const visaoGrafica = document.getElementById('wrapper-sub-visao-grafica');
    const visaoUnidades = document.getElementById('wrapper-sub-visao-unidades');

    if (tabGraficos && tabUnidades) {
        tabGraficos.onclick = () => {
            tabUnidades.classList.remove('active'); tabGraficos.classList.add('active');
            visaoUnidades.style.display = 'none'; visaoGrafica.style.display = 'block';
            window.dispatchEvent(new Event('resize'));
        };
        tabUnidades.onclick = () => {
            tabGraficos.classList.remove('active'); tabUnidades.classList.add('active');
            visaoGrafica.style.display = 'none'; visaoUnidades.style.display = 'block';
        };
    }

    const modal = document.getElementById('modal-detalhe-unidade');
    const btnFechar = document.getElementById('modal-fechar-btn');
    if (modal && btnFechar) {
        btnFechar.onclick = () => modal.style.display = 'none';
        modal.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };
    }
}

function atualizarPainelGeral() {
    const anoSel = document.getElementById('p_filtro_ano').value;
    const unidadeSel = document.getElementById('p_filtro_unidade').value;
    const mesSel = document.getElementById('p_filtro_mes').value;

    let dadosFiltrados = df_completo.filter(d => {
        if (anoSel !== "Todos" && d.Ano !== parseInt(anoSel)) return false;
        if (unidadeSel !== "Todas" && d.Unidade !== unidadeSel) return false;
        if (mesSel !== "Todos" && d.Mes_Nome !== mesSel) return false;
        return true;
    });

    let totais = dadosFiltrados.reduce((acc, curr) => {
        acc.vistorias += curr.visitada; acc.focos += curr.foco_encontrado;
        acc.remediados += curr.foco_remediado; acc.pendentes += curr.foco_pendente;
        return acc;
    }, { vistorias: 0, focos: 0, remediados: 0, pendentes: 0 });

    document.getElementById('kpi_vistorias').innerText = fmtInt(totais.vistorias);
    document.getElementById('kpi_focos').innerText = fmtInt(totais.focos);
    document.getElementById('kpi_remediados').innerText = fmtInt(totais.remediados);
    document.getElementById('kpi_pendentes').innerText = fmtInt(totais.pendentes);

    renderizarGraficoBarrasAgrupadas(dadosFiltrados);
    renderizarGraficoDonutRisco(totais);
    renderizarGraficosImpedimentos(dadosFiltrados);
    renderizarBoxesPorUnidade(dadosFiltrados);
}

function renderizarGraficoBarrasAgrupadas(dados) {
    let mesesMap = {};
    dados.forEach(d => {
        if (!mesesMap[d.Mes_Nome]) mesesMap[d.Mes_Nome] = { focos: 0, remediados: 0 };
        mesesMap[d.Mes_Nome].focos += d.foco_encontrado;
        mesesMap[d.Mes_Nome].remediados += d.foco_remediado;
    });
    const ordemMesesRef = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    let eixosX = Object.keys(mesesMap).sort((a, b) => ordemMesesRef.indexOf(a) - ordemMesesRef.indexOf(b));
    
    Plotly.newPlot('chart_focos_remediados', [
        { x: eixosX, y: eixosX.map(m => mesesMap[m].focos), name: 'Focos', type: 'bar', marker: { color: '#ef4444' } },
        { x: eixosX, y: eixosX.map(m => mesesMap[m].remediados), name: 'Remediados', type: 'bar', marker: { color: '#10b981' } }
    ], { barmode: 'group', margin: { l: 40, r: 20, t: 15, b: 40 }, legend: { orientation: 'h', x: 0, y: 1.15 } }, { displayModeBar: false, responsive: true });
}

function renderizarGraficoDonutRisco(totais) {
    Plotly.newPlot('chart_donuts_risco', [{
        values: [totais.pendentes, totais.remediados, Math.max(0, totais.vistorias - totais.focos)],
        labels: ['Crítico', 'Remediado', 'Sem Focos'],
        type: 'pie', hole: 0.55, marker: { colors: ['#ef4444', '#10b981', '#cbd5e1'] }
    }], { margin: { l: 20, r: 20, t: 15, b: 20 }, legend: { orientation: 'h', x: 0, y: -0.1 } }, { displayModeBar: false, responsive: true });
}

function renderizarGraficosImpedimentos(dados) {
    // Alinhamento exato com as chaves geradas em AedesAPI.getDadosPainel()
    let imp = dados.reduce((acc, c) => {
        acc.nv_acesso += c.nv_acesso; 
        acc.nv_brigadista += c.nv_brigadista;
        acc.nv_viatura += c.nv_viatura; 
        acc.nv_esquecimento += c.nv_esquecimento;
        acc.mnr_capacitacao += c.mnr_capacitacao; 
        acc.mnr_larvicida += c.mnr_larvicida;
        acc.mnr_limpeza += c.mnr_limpeza; 
        acc.mnr_cobertura += c.mnr_cobertura;
        return acc;
    }, { nv_acesso:0, nv_brigadista:0, nv_viatura:0, nv_esquecimento:0, mnr_capacitacao:0, mnr_larvicida:0, mnr_limpeza:0, mnr_cobertura:0 });

    Plotly.newPlot('chart_impedimentos_nv', [{ x: ['Acesso', 'Brigadista', 'Viatura', 'Esquecimento'], y: [imp.nv_acesso, imp.nv_brigadista, imp.nv_viatura, imp.nv_esquecimento], type: 'bar', marker: { color: '#f59e0b' } }], { margin: { l:40, r:20, t:15, b:40 } }, { displayModeBar: false, responsive: true });
    Plotly.newPlot('chart_impedimentos_mnr', [{ x: ['Treino/Cap.', 'Larvicida', 'Limpeza', 'Cobertura'], y: [imp.mnr_capacitacao, imp.mnr_larvicida, imp.mnr_limpeza, imp.mnr_cobertura], type: 'bar', marker: { color: '#2563eb' } }], { margin: { l:40, r:20, t:15, b:40 } }, { displayModeBar: false, responsive: true });
}

function renderizarBoxesPorUnidade(dados) {
    const gridContainer = document.getElementById('grid-caixas-unidades');
    if (!gridContainer) return;

    let agrupado = {};
    dados.forEach(d => {
        if (!agrupado[d.Unidade]) agrupado[d.Unidade] = { vistorias: 0, focos: 0, remediados: 0, pendentes: 0 };
        agrupado[d.Unidade].vistorias += d.visitada; agrupado[d.Unidade].focos += d.foco_encontrado;
        agrupado[d.Unidade].remediados += d.foco_remediado; agrupado[d.Unidade].pendentes += d.foco_pendente;
    });

    const chavesUnidades = Object.keys(agrupado).sort();
    if (chavesUnidades.length === 0) { gridContainer.innerHTML = `<div style="grid-column:1/-1; padding:30px; text-align:center; color:#64748b;">Sem registros para os filtros selecionados.</div>`; return; }

    gridContainer.innerHTML = chavesUnidades.map(unidade => {
        const info = agrupado[unidade];
        const taxa = info.focos > 0 ? Math.round((info.remediados / info.focos) * 100) : 100;
        let cor = taxa >= 80 ? '#10b981' : (taxa >= 50 ? '#f59e0b' : '#ef4444');

        return `
        <div class="card-unidade-clicavel" data-unidade="${unidade}">
            <div style="display:flex; justify-content:space-between; margin-bottom:15px;">
                <h4 style="margin:0; font-size:14px;"><i class="fas fa-building"></i> ${unidade}</h4>
                <span style="background:${cor}15; color:${cor}; padding:4px 8px; border-radius:6px; font-size:11px; font-weight:700;">${taxa}% Eficácia</span>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; background:#f8fafc; padding:12px; border-radius:8px; font-size:13px;">
                <div>Vistorias: <b>${fmtInt(info.vistorias)}</b></div><div>Focos: <b style="color:#f59e0b">${fmtInt(info.focos)}</b></div>
                <div>Remediados: <b style="color:#10b981">${fmtInt(info.remediados)}</b></div><div>Pendentes: <b style="color:#ef4444">${fmtInt(info.pendentes)}</b></div>
            </div>
            <div style="font-size:11px; color:#3b82f6; text-align:right; margin-top:10px;">Ver dossiê completo →</div>
        </div>`;
    }).join('');

    document.querySelectorAll('.card-unidade-clicavel').forEach(card => {
        card.onclick = () => abrirDossieModal(card.getAttribute('data-unidade'), dados);
    });
}

async function abrirDossieModal(nomeUnidade, dadosGlobaisFiltrados) {
    const modal = document.getElementById('modal-detalhe-unidade');
    if (!modal) return;

    document.getElementById('modal-titulo-unidade').innerText = nomeUnidade;

    const containerFocal = document.getElementById('modal-corpo-focal');
    containerFocal.innerHTML = `<span><i class="fas fa-spinner fa-spin"></i> Buscando informações do focal técnico...</span>`;

    let focalEncontrado = null;

    // --- CHAMADA VIA API OFICIAL DO SISTEMA ---
    try {
        focalEncontrado = await AedesAPI.getFocalDossie(nomeUnidade);
    } catch (err) {
        console.error("Erro ao carregar dados do focal no modal:", err);
    }

    // Renderização das informações tratadas no container do Focal Técnico
    if (focalEncontrado && focalEncontrado.nome && !focalEncontrado.nome.includes("Sistema (Ausente)")) {
        containerFocal.innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; font-size: 13px; color: #334155;">
                <div><i class="fas fa-user" style="color: #16a34a; width: 18px;"></i> <strong>Nome:</strong> ${focalEncontrado.nome}</div>
                <div><i class="fas fa-id-card" style="color: #16a34a; width: 18px;"></i> <strong>Matrícula:</strong> ${focalEncontrado.matricula || 'Não informada'}</div>
                <div style="grid-column: 1 / -1;"><i class="fas fa-envelope" style="color: #16a34a; width: 18px;"></i> <strong>E-mail:</strong> <a href="mailto:${focalEncontrado.email || ''}" style="color: #2563eb; text-decoration: none;">${focalEncontrado.email || 'Não informado'}</a></div>
            </div>
        `;
    } else {
        containerFocal.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px; color: #64748b; font-size: 13px;">
                <i class="fas fa-info-circle" style="color: #b45309;"></i>
                <span>Nenhum fiscal ou focal técnico registrado para os envios recentes desta unidade.</span>
            </div>
        `;
    }

    // 3. Montagem do Histórico de Vistorias
    const dadosDaUnidade = dadosGlobaisFiltrados.filter(d => d.Unidade === nomeUnidade);
    let hist = {};
    dadosDaUnidade.forEach(d => {
        if (!hist[d.Mes_Nome]) hist[d.Mes_Nome] = { vistorias: 0, focos: 0, remediados: 0, pendentes: 0 };
        hist[d.Mes_Nome].vistorias += d.visitada; hist[d.Mes_Nome].focos += d.foco_encontrado;
        hist[d.Mes_Nome].remediados += d.foco_remediado; hist[d.Mes_Nome].pendentes += d.foco_pendente;
    });

    const ordemMesesRef = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    const chavesMeses = Object.keys(hist).sort((a, b) => ordemMesesRef.indexOf(a) - ordemMesesRef.indexOf(b));

    document.getElementById('modal-tabela-linhas').innerHTML = chavesMeses.map(mes => {
        const m = hist[mes];
        return `<tr><td><b>${mes}</b></td><td style="text-align:center">${m.vistorias}</td><td style="text-align:center; color:#f59e0b">${m.focos}</td><td style="text-align:center; color:#10b981">${m.remediados}</td><td style="text-align:center; color:#ef4444">${m.pendentes}</td></tr>`;
    }).join('');

    // Listeners dos botões de ação do Modal
    document.getElementById('modal-btn-copiar').onclick = () => {
        let txt = `📊 DOSSIÊ DE CONTROLE - ${nomeUnidade}\n`;
        chavesMeses.forEach(m => { txt += `- ${m}: ${hist[m].vistorias} Vistorias | ${hist[m].focos} Focos Detectados\n`; });
        navigator.clipboard.writeText(txt).then(() => alert('Resumo copiado para a área de transferência!'));
    };

    document.getElementById('modal-btn-baixar').onclick = () => {
        let csv = "Unidade;Mes;Vistorias;Focos;Remediados;Pendentes\n";
        chavesMeses.forEach(m => { csv += `${nomeUnidade};${m};${hist[m].vistorias};${hist[m].focos};${hist[m].remediados};${hist[m].pendentes}\n`; });
        const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.setAttribute("download", `Dossie_Aedes_${nomeUnidade.replace(/\s+/g, '_')}.csv`);
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
    };

    modal.style.display = 'flex';
}