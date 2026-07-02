import { AedesAPI } from './modules/aedes/aedes-api.js'; // Ajuste o caminho relativo para o seu aedes-api.js se necessário

// Torna o switchTab acessível globalmente para o "onclick" do HTML
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

document.addEventListener("DOMContentLoaded", async function() {
    // Inicialização do Modal Introdutório
    setTimeout(() => {
        const modalEl = document.getElementById('introModal');
        if (modalEl) new bootstrap.Modal(modalEl).show();
    }, 300);

    // Inicialização do Mapa Leaflet
    const map = L.map('mapa_aedes').setView([-22.5, -42.8], 8);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

    function obterCoordsFixas(unidadeNome) {
        let hash = 0;
        for (let i = 0; i < unidadeNome.length; i++) hash = unidadeNome.charCodeAt(i) + ((hash << 5) - hash);
        let m_w = 123456789 + Math.abs(hash), m_z = 987654321 - Math.abs(hash);
        const random = () => {
            m_z = (36969 * (m_z & 65535) + (m_z >> 16)) & 4294967295;
            m_w = (18000 * (m_w & 65535) + (m_w >> 16)) & 4294967295;
            return (((m_z << 16) + m_w) & 4294967295) / 4294967296;
        };
        return { lat: -23.0 + random() * 0.9, lng: -43.6 + random() * 1.6 };
    }

    // Consumo do módulo importado
    const dadosBrutos = await AedesAPI.getDadosPainel();
    if (!dadosBrutos || dadosBrutos.length === 0) {
        console.warn("⚠️ Banco de dados retornou vazio ou rota inacessível.");
        return;
    }

    // Filtros da Interface
    const unidadesUnicas = [...new Set(dadosBrutos.map(d => d.Unidade))].filter(Boolean).sort();
    const selectUnidade = document.getElementById('filtro_unidade');
    if (selectUnidade) unidadesUnicas.forEach(u => selectUnidade.add(new Option(u, u)));

    const mapaMesesId = { "Janeiro":"01", "Fevereiro":"02", "Março":"03", "Abril":"04", "Maio":"05", "Junho":"06", "Julho":"07", "Agosto":"08", "Setembro":"09", "Outubro":"10", "Novembro":"11", "Dezembro":"12" };
    const mesesUnicos = [...new Set(dadosBrutos.map(d => d.Mes_Nome && d.Ano ? `${mapaMesesId[d.Mes_Nome]}/${d.Ano}` : null))].filter(Boolean).sort().reverse();
    const selectMes = document.getElementById('filtro_mes_ano');
    if (selectMes) mesesUnicos.forEach(m => selectMes.add(new Option(m, m)));

    // Cálculo das Métricas Gerais (KPIs)
    const sumarioUnidades = {};
    let totalVistoriasRealizadas = 0, totalFocosEncontradosGlobal = 0, totalFocosRemediadosGlobal = 0;

    dadosBrutos.forEach(d => {
        if (!d.Unidade) return;
        if (!sumarioUnidades[d.Unidade]) {
            sumarioUnidades[d.Unidade] = { nome: d.Unidade, vistorias: 0, focos: 0, remediados: 0, critico: false };
        }
        const s = sumarioUnidades[d.Unidade];
        if (d.visitada === 1) {
            s.vistorias++; totalVistoriasRealizadas++;
            if (d.foco_encontrado === 1) {
                s.focos++; totalFocosEncontradosGlobal++;
                if (d.foco_remediado === 1) s.remediados++; else s.critico = true;
            }
        }
    });

    if (document.getElementById('kpi_vistorias')) document.getElementById('kpi_vistorias').innerText = totalVistoriasRealizadas;
    const totalUnidades = Object.keys(sumarioUnidades).length;
    const comFoco = Object.values(sumarioUnidades).filter(u => u.focos > 0).length;
    if (document.getElementById('kpi_sem_foco')) document.getElementById('kpi_sem_foco').innerText = totalUnidades ? (((totalUnidades - comFoco) / totalUnidades) * 100).toFixed(1) + "%" : "100%";
    if (document.getElementById('kpi_remediados')) document.getElementById('kpi_remediados').innerText = totalFocosEncontradosGlobal ? ((totalFocosRemediadosGlobal / totalFocosEncontradosGlobal) * 100).toFixed(1) + "%" : "100.0%";

    // Plotagem do Mapa Interativo com Dossiê Assíncrono via API
    Object.values(sumarioUnidades).forEach(u => {
        const coords = obterCoordsFixas(u.nome);
        const marker = L.circleMarker([coords.lat, coords.lng], {
            radius: 8, fillColor: u.critico ? '#cc0000' : '#28a745', color: '#ffffff', weight: 2, fillOpacity: 0.9
        }).addTo(map);

        marker.on('click', async function() {
            marker.bindPopup("<div class='p-2'><i class='fas fa-spinner fa-spin text-danger'></i> Consultando Dossiê...</div>").openPopup();
            const focalData = await AedesAPI.getFocalDossie(u.nome);
            
            const txtDossie = `DOSSIÊ OFICIAL DO PROGRAMA\nUnidade: ${u.nome}\nResponsável Técnico: ${focalData.nome || "Não Vinculado"}\nE-mail: ${focalData.email || "-"}\nVistorias: ${u.vistorias}\nFocos: ${u.focos} (${u.remediados} Remediados).`;
            const uriDossie = "data:text/plain;charset=utf-8," + encodeURIComponent(txtDossie);

            marker.setPopupContent(`
                <div class='dossie-popup-card'>
                    <div class='dossie-popup-title'>📋 DOSSIÊ: ${u.nome}</div>
                    <div class='dossie-popup-text'>
                        <b>Focal:</b> ${focalData.nome || "Não Vinculado"}<br>
                        <b>E-mail:</b> ${focalData.email || "-"}<br><br>
                        Registrou <b>${u.vistorias} vistorias</b>. Identificou <b>${u.focos} focos</b>, com <b>${u.remediados} remediados</b>.
                    </div>
                    <a class='dossie-btn-down' download='Dossie_${u.nome.replace(/\s+/g,'_')}.txt' href='${uriDossie}'>📥 BAIXAR TXT</a>
                </div>`);
        });
    });

    // Ranking de Conformidade Semanal
    const totalSemanasLimpas = {};
    unidadesUnicas.forEach(u => totalSemanasLimpas[u] = 0);
    dadosBrutos.forEach(d => { if (d.foco_encontrado === 0 && d.visitada === 1 && d.Unidade) totalSemanasLimpas[d.Unidade]++; });
    const datasetRanking = Object.keys(totalSemanasLimpas).map(u => ({ unidade: u, qtd: totalSemanasLimpas[u] }))
       .sort((a,b) => b.qtd - a.qtd || a.unidade.localeCompare(b.unidade))
       .map((d, idx) => [`<span style="font-weight:bold; color:#cc0000">${idx + 1}º</span>`, d.unidade, d.qtd]);

    $('#tabela_unidades_resumo').DataTable({ data: datasetRanking, columns: [{ title: "Posição" }, { title: "Unidade" }, { title: "Semanas 100% Limpas" }], pageLength: 5, dom: 'tp', ordering: false });

    // Processamento dos Gráficos de Pizza com Dados Reais
    function criarGrafico(id, labels, data, titulo) {
        const el = document.getElementById(id);
        if (el) new Chart(el, { type: 'pie', data: { labels: labels, datasets: [{ data: data, backgroundColor: ['#ec1c24', '#22b14c', '#ff7f27', '#3f48cc', '#a349a4', '#00a2e8'] }] }, options: { responsive: true, plugins: { title: { display: true, text: titulo } } } });
    }

    const cVistoria = {}, cRemediacao = {}, cLocais = {};
    const lOutrosVist = [], lOutrosRem = [], lOutrosLoc = [];

    dadosBrutos.forEach(d => {
        if (d.outros_motivo_nao_vistoria && d.outros_motivo_nao_vistoria !== "-") lOutrosVist.push([d.data_formatada, d.Unidade, d.outros_motivo_nao_vistoria]);
        if (d.outros_motivo_nao_remediacao && d.outros_motivo_nao_remediacao !== "-") lOutrosRem.push([d.data_formatada, d.Unidade, d.outros_motivo_nao_remediacao]);
        if (d.outros_local && d.outros_local !== "-") lOutrosLoc.push([d.data_formatada, d.Unidade, d.outros_local]);

        const extrair = (campo, obj) => {
            if (!campo) return;
            const itens = typeof campo === 'string' ? (campo.startsWith('[') ? JSON.parse(campo) : [campo]) : campo;
            if (Array.isArray(itens)) itens.forEach(x => { if(x) obj[x] = (obj[x] || 0) + 1; });
        };
        extrair(d.motivos_nao_vistoria, cVistoria);
        extrair(d.motivos_nao_remediacao, cRemediacao);
        extrair(d.locais_foco, cLocais);
    });

    criarGrafico('chart_vistoria', Object.keys(cVistoria), Object.values(cVistoria), 'Motivos de Não Vistoria');
    criarGrafico('chart_remediacao', Object.keys(cRemediacao), Object.values(cRemediacao), 'Motivos de Não Remediação');
    criarGrafico('chart_locais', Object.keys(cLocais), Object.values(cLocais), 'Locais de Foco Identificados');

    const colSub = [{ title: "Data" }, { title: "Unidade" }, { title: "Descrição" }];
    $('#table_outros_vistoria').DataTable({ data: lOutrosVist, columns: colSub, pageLength: 4, dom: 'tp' });
    $('#table_outros_remediacao').DataTable({ data: lOutrosRem, columns: colSub, pageLength: 4, dom: 'tp' });
    $('#table_outros_locais').DataTable({ data: lOutrosLoc, columns: colSub, pageLength: 4, dom: 'tp' });

    // Grade Técnica Principal Unificada
    const datasetTecnico = dadosBrutos.map(d => {
        const txtVistoria = d.visitada === 1 ? "Realizada" : "Não Realizada";
        let txtFoco = d.visitada === 0 ? "Não Aplicável" : (d.foco_encontrado === 1 ? (d.foco_remediado === 1 ? "Remediado" : "Não Remediado") : "Sem foco");
        
        const formatArr = (val) => {
            if (!val) return "-";
            try { const p = typeof val === 'string' ? JSON.parse(val) : val; return Array.isArray(p) ? p.join(', ') : val; } catch(e) { return val; }
        };

        return [
            d.data_formatada, d.Unidade || "-", txtVistoria, txtFoco,
            formatArr(d.motivos_nao_vistoria), d.outros_motivo_nao_vistoria || "-",
            formatArr(d.motivos_nao_remediacao), d.outros_motivo_nao_remediacao || "-",
            formatArr(d.locais_foco), d.outros_local || "-",
            d.Mes_Nome && d.Ano ? `${mapaMesesId[d.Mes_Nome]}/${d.Ano}` : ""
        ];
    });

    const tableTecnica = $('#tabela_mensal_tecnica').DataTable({
        data: datasetTecnico,
        columns: [
            { title: "Data" }, { title: "Unidade" }, { title: "Vistoria" }, { title: "Foco" },
            { title: "Motivo Não Vistoria" }, { title: "Outros (Vistoria)" }, { title: "Motivo Não Remediação" }, 
            { title: "Outros (Remediação)" }, { title: "Locais do Foco" }, { title: "Outros Locais" }, { visible: false }
        ],
        scrollX: true, dom: 't', paging: false,
        createdRow: function(row, data) {
            $('td', row).eq(2).css('background-color', data[2] === "Realizada" ? '#d4edda' : '#f8d7da');
            if (data[3] === "Sem foco") $('td', row).eq(3).css('background-color', '#d4edda');
            else if (data[3] === "Remediado") $('td', row).eq(3).css('background-color', '#fff3cd');
            else if (data[3] === "Não Remediado") $('td', row).eq(3).css('background-color', '#f8d7da');
        }
    });

    $('#filtro_unidade, #filtro_mes_ano').on('change', function() {
        tableTecnica.column(1).search($('#filtro_unidade').val() === "Todas" ? "" : `^${$('#filtro_unidade').val()}$`, true, false);
        tableTecnica.column(10).search($('#filtro_mes_ano').val() === "Todos" ? "" : $('#filtro_mes_ano').val());
        tableTecnica.draw();
    });
});