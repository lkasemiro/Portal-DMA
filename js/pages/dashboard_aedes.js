// ─── CONFIGURAÇÃO DE ROTAS DO SERVIDOR ─────────────────────────────────────
const API_BASE = window.location.hostname === "localhost" 
    ? "http://localhost:3001" 
    : "https://dma-aedes-api.onrender.com";

const AedesAPI = {
    async getDadosPainel() {
        try {
            const response = await fetch(`${API_BASE}/api/aedes/painel-dados`);
            
            // Se a resposta do servidor não for 200 OK (ex: deu 404 ou 500)
            if (!response.ok) {
                const erroServidor = await response.json().catch(() => ({}));
                console.error("❌ O servidor respondeu com erro técnico:", erroServidor);
                return [];
            }

            const data = await response.json();
            
            // PROTEÇÃO CRÍTICA: Se o back-end devolveu um objeto de erro {error:...} em vez de uma lista []
            if (data && data.error) {
                console.error("⚠️ O back-end retornou uma mensagem de falha interna:", data.error);
                return [];
            }
            
            return Array.isArray(data) ? data : [];
        } catch (error) {
            console.error("❌ Falha de rede ou conexão com a API:", error);
            return [];
        }
    },
    
    async getFocalDossie(nomeUnidade) {
        try {
            const response = await fetch(`${API_BASE}/api/aedes/focal-dossie?unidade=${encodeURIComponent(nomeUnidade)}`);
            if (!response.ok) throw new Error(`Status HTTP: ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error("❌ AedesAPI.getFocalDossie:", error);
            return { nome: null, matricula: null, email: null };
        }
    }
    
};

// ─── GERENCIAMENTO DE ABAS NATIVO (Atendido pelo onclick do seu HTML) ──────
window.switchTab = function(tab) {
    const tabGerencial = document.getElementById('tab-gerencial');
    const tabTecnico = document.getElementById('tab-tecnico');
    
    if (!tabGerencial || !tabTecnico) return;

    const botoes = document.querySelectorAll('.navbar-nav .nav-link');

    if (tab === 'gerencial') {
        tabGerencial.classList.remove('d-none');
        tabTecnico.classList.add('d-none');
        if (botoes[0]) botoes[0].classList.add('active');
        if (botoes[1]) botoes[1].classList.remove('active');
    } else {
        tabGerencial.classList.add('d-none');
        tabTecnico.classList.remove('d-none');
        if (botoes[0]) botoes[0].classList.remove('active');
        if (botoes[1]) botoes[1].classList.add('active');
    }
};

// ─── EXECUÇÃO E CARREGAMENTO PRINCIPAL DO PAINEL ───────────────────────────
document.addEventListener("DOMContentLoaded", async function() {
    
    // Abrir modal introdutório automaticamente após 300ms
    setTimeout(() => {
        const modalEl = document.getElementById('introModal');
        if (modalEl) {
            const introModal = new bootstrap.Modal(modalEl);
            introModal.show();
        }
    }, 300);

    // Inicialização do Mapa Leaflet
    const map = L.map('mapa_aedes').setView([-22.5, -42.8], 8);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

    // Gerador de Coordenadas determinísticas via Nome da Unidade (Simula set.seed do R)
    function obterCoordsFixas(unidadeNome) {
        let hash = 0;
        for (let i = 0; i < unidadeNome.length; i++) {
            hash = unidadeNome.charCodeAt(i) + ((hash << 5) - hash);
        }
        let m_w = 123456789 + Math.abs(hash);
        let m_z = 987654321 - Math.abs(hash);
        const random = () => {
            m_z = (36969 * (m_z & 65535) + (m_z >> 16)) & 4294967295;
            m_w = (18000 * (m_w & 65535) + (m_w >> 16)) & 4294967295;
            return (((m_z << 16) + m_w) & 4294967295) / 4294967296;
        };
        return { lat: -23.0 + random() * 0.9, lng: -43.6 + random() * 1.6 };
    }

    // Requisição assíncrona dos dados consolidados
    const dadosBrutos = await AedesAPI.getDadosPainel();
    if (!dadosBrutos || dadosBrutos.length === 0) {
        console.warn("⚠️ Nenhuma informação válida recebida do back-end ou rota offline.");
        return;
    }

    // ─── POPULAR FILTROS DINÂMICOS DA ABA TÉCNICA ────────────────────────────
    const unidadesUnicas = [...new Set(dadosBrutos.map(d => d.Unidade))].filter(Boolean).sort();
    const selectUnidade = document.getElementById('filtro_unidade');
    if (selectUnidade) {
        unidadesUnicas.forEach(u => selectUnidade.add(new Option(u, u)));
    }

    const mapaMesesId = { "Janeiro": "01", "Fevereiro": "02", "Março": "03", "Abril": "04", "Maio": "05", "Junho": "06", "Julho": "07", "Agosto": "08", "Setembro": "09", "Outubro": "10", "Novembro": "11", "Dezembro": "12" };
    const mesesUnicos = [...new Set(dadosBrutos.map(d => d.Mes_Nome && d.Ano ? `${mapaMesesId[d.Mes_Nome] || '01'}/${d.Ano}` : null))].filter(Boolean).sort().reverse();
    const selectMes = document.getElementById('filtro_mes_ano');
    if (selectMes) {
        mesesUnicos.forEach(m => selectMes.add(new Option(m, m)));
    }

    // ─── PROCESSAMENTO ANALÍTICO DE MÉTRICAS (KPIs E MAPA) ────────────────────
    const sumarioUnidades = {};
    let totalVistoriasRealizadas = 0;
    let totalFocosEncontradosGlobal = 0;
    let totalFocosRemediadosGlobal = 0;

    dadosBrutos.forEach(d => {
        if (!d.Unidade) return;
        if (!sumarioUnidades[d.Unidade]) {
            sumarioUnidades[d.Unidade] = {
                nome: d.Unidade, vistorias: 0, focos: 0, remediados: 0, semanasLimpas: 0, critico: false
            };
        }

        const s = sumarioUnidades[d.Unidade];
        
        if (d.visitada === 1) {
            s.vistorias++;
            totalVistoriasRealizadas++;
            
            if (d.foco_encontrado === 1) {
                s.focos++;
                totalFocosEncontradosGlobal++;
                
                if (d.foco_remediado === 1) {
                    s.remediados++;
                    totalFocosRemediadosGlobal++;
                } else {
                    s.critico = true;
                }
            }
        }
    });

    // Atualização dos Cards de KPI
    const kpiVist = document.getElementById('kpi_vistorias');
    if (kpiVist) kpiVist.innerText = totalVistoriasRealizadas;

    const totalUnidadesCadastradas = Object.keys(sumarioUnidades).length;
    const unidadesComFocoRegistrado = Object.values(sumarioUnidades).filter(u => u.focos > 0).length;
    const taxaConformidadeGeral = totalUnidadesCadastradas 
        ? (((totalUnidadesCadastradas - unidadesComFocoRegistrado) / totalUnidadesCadastradas) * 100).toFixed(1) + "%" 
        : "100%";
    const kpiFoco = document.getElementById('kpi_sem_foco');
    if (kpiFoco) kpiFoco.innerText = taxaConformidadeGeral;

    const percentualRemediacao = totalFocosEncontradosGlobal 
        ? ((totalFocosRemediadosGlobal / totalFocosEncontradosGlobal) * 100).toFixed(1) + "%" 
        : "100.0%";
    const kpiRemed = document.getElementById('kpi_remediados');
    if (kpiRemed) kpiRemed.innerText = percentualRemediacao;

    // ─── PLOTAGEM DOS MARCADORES E INTEGRALIZAÇÃO DO DOSSIÊ TÉCNICO ───────────
    Object.values(sumarioUnidades).forEach(u => {
        const coords = obterCoordsFixas(u.nome);
        const corPino = u.critico ? '#cc0000' : '#28a745';

        const marker = L.circleMarker([coords.lat, coords.lng], {
            radius: 8, fillColor: corPino, color: '#ffffff', weight: 2, fillOpacity: 0.9
        }).addTo(map);

        marker.on('click', async function() {
            marker.bindPopup("<div class='text-center p-2'><i class='fas fa-spinner fa-spin text-danger'></i> Buscando Dossiê...</div>").openPopup();
            
            const focalData = await AedesAPI.getFocalDossie(u.nome);
            const gestorNome = focalData.nome || "Não Vinculado";
            const gestorMatricula = focalData.matricula || "-";
            const gestorEmail = focalData.email || "-";

            const txtDossie = `DOSSIÊ OFICIAL DO PROGRAMA\nUnidade: ${u.nome}\nResponsável Técnico: ${gestorNome} (Matrícula: ${gestorMatricula})\nE-mail: ${gestorEmail}\nVistorias Registradas: ${u.vistorias}\nFocos Identificados: ${u.focos} (${u.remediados} Remediados).`;
            const uriDossie = "data:text/plain;charset=utf-8," + encodeURIComponent(txtDossie);

            const htmlPopup = `
                <div class='dossie-popup-card'>
                    <div class='dossie-popup-title'>📋 DOSSIÊ: ${u.nome}</div>
                    <div class='dossie-popup-text'>
                        <b>Focal Técnico:</b> ${gestorNome}<br>
                        <b>Matrícula:</b> ${gestorMatricula} | <b>E-mail:</b> ${gestorEmail}<br><br>
                        Realizou <b>${u.vistorias} vistorias</b> mapeadas no histórico. Encontrou <b>${u.focos} focos</b> em seus reservatórios, com um total de <b>${u.remediados} focos devidamente sanados</b>.
                    </div>
                    <a class='dossie-btn-down' download='Dossie_${u.nome.replace(/\s+/g, '_')}.txt' href='${uriDossie}'>📥 BAIXAR RELATÓRIO (TXT)</a>
                </div>`;
            
            marker.setPopupContent(htmlPopup);
        });
    });

    // ─── TABELA 1: RANKING DE CONFORMIDADE SEMANAL ───────────────────────────
    const totalSemanasLimpasPorUnidade = {};
    unidadesUnicas.forEach(u => totalSemanasLimpasPorUnidade[u] = 0);

    dadosBrutos.forEach(d => {
        if (d.foco_encontrado === 0 && d.visitada === 1 && d.Unidade) {
            totalSemanasLimpasPorUnidade[d.Unidade]++;
        }
    });

    const datasetRanking = Object.keys(totalSemanasLimpasPorUnidade).map(u => ({
        unidade: u, qtd: totalSemanasLimpasPorUnidade[u]
    })).sort((a, b) => b.qtd - a.qtd || a.unidade.localeCompare(b.unidade))
       .map((d, idx) => [`<span style="font-weight:bold; color:#cc0000">${idx + 1}º</span>`, d.unidade, d.qtd]);

    $('#tabela_unidades_resumo').DataTable({
        data: datasetRanking,
        columns: [{ title: "Posição" }, { title: "Unidade" }, { title: "Semanas 100% Limpas" }],
        pageLength: 5, dom: 'tp', ordering: false, language: { paginate: { next: "👉", previous: "👈" } }
    });

    // ─── COMPILAÇÃO GRÁFICA DOS DADOS REAIS (CHART.JS) ──────────────────────────
    function criarEstruturaGraficoPizza(idCanvas, labels, data, titulo) {
        const el = document.getElementById(idCanvas);
        if (!el) return;
        new Chart(el, {
            type: 'pie',
            data: {
                labels: labels,
                datasets: [{ data: data, backgroundColor: ['#ec1c24', '#22b14c', '#ff7f27', '#3f48cc', '#a349a4', '#00a2e8', '#e066ff'] }]
            },
            options: { responsive: true, plugins: { title: { display: true, text: titulo, font: { family: 'Inter', weight: 'bold' } } } }
        });
    }

    const contagemMotivosVistoria = {};
    const contagemMotivosRemediacao = {};
    const contagemLocaisFoco = {};

    // Arrays para guardar as strings de texto livre ("Outros") reais cadastradas pelas equipes
    const listaOutrosVistoria = [];
    const listaOutrosRemediacao = [];
    const listaOutrosLocais = [];

    dadosBrutos.forEach(d => {
        // Coleta de strings livres do banco ("Outros") para preenchimento das sub-tabelas
        if (d.outros_motivo_nao_vistoria && d.outros_motivo_nao_vistoria !== "-") {
            listaOutrosVistoria.push([d.data_registro || "01/02/2026", d.Unidade, d.outros_motivo_nao_vistoria]);
        }
        if (d.outros_motivo_nao_remediacao && d.outros_motivo_nao_remediacao !== "-") {
            listaOutrosRemediacao.push([d.data_registro || "01/02/2026", d.Unidade, d.outros_motivo_nao_remediacao]);
        }
        if (d.outros_local && d.outros_local !== "-") {
            listaOutrosLocais.push([d.data_registro || "01/02/2026", d.Unidade, d.outros_local]);
        }

        // Processamento das chaves agrupadas para os gráficos de pizza
        if (d.motivos_nao_vistoria) {
            try {
                const motivos = typeof d.motivos_nao_vistoria === 'string' ? JSON.parse(d.motivos_nao_vistoria) : d.motivos_nao_vistoria;
                if (Array.isArray(motivos)) motivos.forEach(m => { if(m) contagemMotivosVistoria[m] = (contagemMotivosVistoria[m] || 0) + 1; });
            } catch(e) { if(d.motivos_nao_vistoria) contagemMotivosVistoria[d.motivos_nao_vistoria] = (contagemMotivosVistoria[d.motivos_nao_vistoria] || 0) + 1; }
        }
        if (d.motivos_nao_remediacao) {
            try {
                const motivosRem = typeof d.motivos_nao_remediacao === 'string' ? JSON.parse(d.motivos_nao_remediacao) : d.motivos_nao_remediacao;
                if (Array.isArray(motivosRem)) motivosRem.forEach(m => { if(m) contagemMotivosRemediacao[m] = (contagemMotivosRemediacao[m] || 0) + 1; });
            } catch(e) { if(d.motivos_nao_remediacao) contagemMotivosRemediacao[d.motivos_nao_remediacao] = (contagemMotivosRemediacao[d.motivos_nao_remediacao] || 0) + 1; }
        }
        if (d.locais_foco) {
            try {
                const locais = typeof d.locais_foco === 'string' ? JSON.parse(d.locais_foco) : d.locais_foco;
                if (Array.isArray(locais)) locais.forEach(l => { if(l) contagemLocaisFoco[l] = (contagemLocaisFoco[l] || 0) + 1; });
            } catch(e) { if(d.locais_foco) contagemLocaisFoco[d.locais_foco] = (contagemLocaisFoco[d.locais_foco] || 0) + 1; }
        }
    });

    criarEstruturaGraficoPizza('chart_vistoria', Object.keys(contagemMotivosVistoria), Object.values(contagemMotivosVistoria), 'Motivos de Não Vistoria');
    criarEstruturaGraficoPizza('chart_remediacao', Object.keys(contagemMotivosRemediacao), Object.values(contagemMotivosRemediacao), 'Motivos de Não Remediação');
    criarEstruturaGraficoPizza('chart_locais', Object.keys(contagemLocaisFoco), Object.values(contagemLocaisFoco), 'Locais de Foco Identificados');

    // ─── ALIMENTAÇÃO DAS SUB-TABELAS DE TEXTO LIVRE ("OUTROS") COM DADOS REAIS ──
    const colunasSubTabela = [{ title: "Data" }, { title: "Unidade" }, { title: "Descrição" }];
    $('#table_outros_vistoria').DataTable({ data: listaOutrosVistoria, columns: colunasSubTabela, pageLength: 4, dom: 'tp' });
    $('#table_outros_remediacao').DataTable({ data: listaOutrosRemediacao, columns: colunasSubTabela, pageLength: 4, dom: 'tp' });
    $('#table_outros_locais').DataTable({ data: listaOutrosLocais, columns: colunasSubTabela, pageLength: 4, dom: 'tp' });

    // ─── TABELA 2: ÁREA TÉCNICA CONSOLIDADA (INTEGRAÇÃO COMPLETA) ────────────
    const datasetTecnicoFull = dadosBrutos.map(d => {
        const textoVistoria = d.visitada === 1 ? "Realizada" : "Não Realizada";
        let textoFoco = "Sem foco";
        if (d.visitada === 0) textoFoco = "Não Aplicável (Sem Vistoria)";
        else if (d.foco_encontrado === 1 && d.foco_remediado === 1) textoFoco = "Remediado";
        else if (d.foco_encontrado === 1 && d.foco_remediado === 0) textoFoco = "Não Remediado";

        const chaveMesFiltro = d.Mes_Nome && d.Ano ? `${mapaMesesId[d.Mes_Nome] || '01'}/${d.Ano}` : "01/2026";
        const dataVisual = d.Mes_Nome && d.Ano ? `01/${mapaMesesId[d.Mes_Nome] || '01'}/${d.Ano}` : "-";

        // Junta amigavelmente arrays em texto legível separado por vírgulas para a grade técnica principal
        const formataCampoMúltiplo = (val) => {
            if(!val) return "-";
            if(typeof val === 'string') { try { const p = JSON.parse(val); return Array.isArray(p) ? p.join(', ') : val; } catch(e) { return val; } }
            if(Array.isArray(val)) return val.join(', ');
            return "-";
        };

        return [
            dataVisual,
            d.Unidade || "-",
            textoVistoria,
            textoFoco,
            formataCampoMúltiplo(d.motivos_nao_vistoria),
            d.outros_motivo_nao_vistoria || "-",
            formataCampoMúltiplo(d.motivos_nao_remediacao),
            d.outros_motivo_nao_remediacao || "-",
            formataCampoMúltiplo(d.locais_foco),
            d.outros_local || "-",
            chaveMesFiltro
        ];
    });

    const tableTecnica = $('#tabela_mensal_tecnica').DataTable({
        data: datasetTecnicoFull,
        columns: [
            { title: "Data" }, { title: "Unidade" }, { title: "Vistoria" }, { title: "Foco" },
            { title: "Motivo Não Vistoria" }, { title: "Outros (Vistoria)" },
            { title: "Motivo Não Remediação" }, { title: "Outros (Remediação)" },
            { title: "Locais do Foco" }, { title: "Outros Locais" },
            { visible: false } 
        ],
        scrollX: true, dom: 't', paging: false,
        createdRow: function(row, data) {
            if (data[2] === "Realizada") $('td', row).eq(2).css('background-color', '#d4edda');
            else $('td', row).eq(2).css('background-color', '#f8d7da');

            if (data[3] === "Sem foco") $('td', row).eq(3).css('background-color', '#d4edda');
            else if (data[3] === "Remediado") $('td', row).eq(3).css('background-color', '#fff3cd');
            else if (data[3] === "Não Remediado") $('td', row).eq(3).css('background-color', '#f8d7da');
            else $('td', row).eq(3).css('background-color', '#e9ecef');
        }
    });

    $('#filtro_unidade, #filtro_mes_ano').on('change', function() {
        const valUnid = $('#filtro_unidade').val();
        const valMes = $('#filtro_mes_ano').val();

        tableTecnica.column(1).search(valUnid === "Todas" ? "" : `^${valUnid}$`, true, false);
        tableTecnica.column(10).search(valMes === "Todos" ? "" : valMes);
        tableTecnica.draw();
    });
});