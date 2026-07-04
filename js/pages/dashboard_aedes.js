// ─────────────────────────────────────────────────────────────
// CONFIGURAÇÃO DA API
// ─────────────────────────────────────────────────────────────

const API_BASE =
    window.location.hostname === "localhost"
        ? "http://localhost:3001"
        : "https://dma-aedes-api.onrender.com";

// Opcional: deixa visível no console qual API está sendo usada
console.log("🌐 API:", API_BASE);

// ─────────────────────────────────────────────────────────────
// CLIENTE DA API AEDES
// ─────────────────────────────────────────────────────────────

const AedesAPI = {

    /**
     * Busca os dados consolidados do dashboard.
     */
    async getDadosPainel() {

        try {

            const response = await fetch(`${API_BASE}/api/aedes/painel-dados`);

            if (!response.ok) {
                console.error(
                    `❌ Erro HTTP ${response.status} ao consultar painel.`
                );
                return [];
            }

            const json = await response.json();

            console.log("📦 Dados recebidos:", json);

            // API nova (caso futuramente devolva { registros: [...] })
            if (Array.isArray(json?.registros)) {
                return json.registros;
            }

            // API atual (retorna diretamente um array)
            if (Array.isArray(json)) {
                return json;
            }

            console.warn("⚠️ Estrutura inesperada retornada pela API:", json);

            return [];

        } catch (error) {

            console.error(
                "❌ Erro de conexão com /api/aedes/painel-dados:",
                error
            );

            return [];

        }

    },

    /**
     * Busca o focal técnico da unidade.
     */
    async getFocalDossie(nomeUnidade) {

        try {

            const response = await fetch(
                `${API_BASE}/api/aedes/focal-dossie?unidade=${encodeURIComponent(nomeUnidade)}`
            );

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            return await response.json();

        } catch (error) {

            console.error(
                "❌ Erro ao buscar focal técnico:",
                error
            );

            return {
                nome: null,
                matricula: null,
                email: null
            };

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

        // ─────────────────────────────────────────────────────────────
// REQUISIÇÃO DOS DADOS CONSOLIDADOS
// ─────────────────────────────────────────────────────────────

let dadosBrutos = await AedesAPI.getDadosPainel();

if (!Array.isArray(dadosBrutos) || dadosBrutos.length === 0) {
    console.warn("⚠️ Nenhum dado recebido da API.");
    return;
}

// Compatibilização entre diferentes versões da API
const nomesMeses = [
    "",
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro"
];

dadosBrutos = dadosBrutos.map(r => ({

    ...r,

    Unidade: r.Unidade ?? r.unidade_nome,

    Ano: Number(r.Ano ?? r.ano),

    Mes_Nome: r.Mes_Nome ?? nomesMeses[Number(r.mes)],

    data_registro: r.data_registro ?? r.data_formatada,

    visitada: Number(r.visitada),

    foco_encontrado: Number(r.foco_encontrado),

    foco_remediado: Number(r.foco_remediado)

}));

console.log(`✔ ${dadosBrutos.length} registros compatibilizados.`);
console.table(dadosBrutos.slice(0, 5));

// ─────────────────────────────────────────────────────────────
// POPULAR FILTROS DA ABA TÉCNICA
// ─────────────────────────────────────────────────────────────

const unidadesUnicas = [
    ...new Set(
        dadosBrutos
            .map(d => d.Unidade)
            .filter(Boolean)
    )
].sort();

const selectUnidade = document.getElementById("filtro_unidade");

if (selectUnidade) {
    unidadesUnicas.forEach(unidade => {
        selectUnidade.add(new Option(unidade, unidade));
    });
}

const mapaMesesId = {
    Janeiro: "01",
    Fevereiro: "02",
    Março: "03",
    Abril: "04",
    Maio: "05",
    Junho: "06",
    Julho: "07",
    Agosto: "08",
    Setembro: "09",
    Outubro: "10",
    Novembro: "11",
    Dezembro: "12"
};

const mesesUnicos = [
    ...new Set(
        dadosBrutos.map(d => {

            if (!d.Mes_Nome || !d.Ano) return null;

            return `${mapaMesesId[d.Mes_Nome]}/${d.Ano}`;

        })
    )
]
.filter(Boolean)
.sort()
.reverse();

const selectMes = document.getElementById("filtro_mes_ano");

if (selectMes) {
    mesesUnicos.forEach(mes => {
        selectMes.add(new Option(mes, mes));
    });
}                                                                                                                                                                                                                     
    // ─────────────────────────────────────────────────────────────
// PROCESSAMENTO ANALÍTICO (KPIs E MAPA)
// ─────────────────────────────────────────────────────────────

const sumarioUnidades = {};

let totalVistoriasRealizadas = 0;
let totalFocosEncontradosGlobal = 0;
let totalFocosRemediadosGlobal = 0;

dadosBrutos.forEach(registro => {

    if (!registro.Unidade) return;

    // Cria a unidade caso ainda não exista
    if (!sumarioUnidades[registro.Unidade]) {

        sumarioUnidades[registro.Unidade] = {

            nome: registro.Unidade,

            vistorias: 0,

            focos: 0,

            remediados: 0,

            semanasLimpas: 0,

            critico: false

        };

    }

    const unidade = sumarioUnidades[registro.Unidade];

    // Vistoria realizada
    if (registro.visitada === 1) {

        unidade.vistorias++;
        totalVistoriasRealizadas++;

        // Unidade sem foco
        if (registro.foco_encontrado === 0) {
            unidade.semanasLimpas++;
        }

        // Unidade com foco
        if (registro.foco_encontrado === 1) {

            unidade.focos++;
            totalFocosEncontradosGlobal++;

            if (registro.foco_remediado === 1) {

                unidade.remediados++;
                totalFocosRemediadosGlobal++;

            } else {

                unidade.critico = true;

            }

        }

    }

});

console.log("📊 Resumo das unidades:", sumarioUnidades);
    // ─────────────────────────────────────────────────────────────
// FUNÇÕES AUXILIARES
// ─────────────────────────────────────────────────────────────

function atualizarKPI(id, valor) {
    const elemento = document.getElementById(id);
    if (elemento) {
        elemento.textContent = valor;
    }
}

function gerarTextoDossie(unidade, gestor) {

    return `
DOSSIÊ OFICIAL DO PROGRAMA AEDES

Unidade: ${unidade.nome}

Responsável Técnico:
${gestor.nome}

Matrícula:
${gestor.matricula}

E-mail:
${gestor.email}

--------------------------------------------

Vistorias realizadas: ${unidade.vistorias}

Focos encontrados: ${unidade.focos}

Focos remediados: ${unidade.remediados}

Semanas sem foco: ${unidade.semanasLimpas}

--------------------------------------------

Relatório gerado automaticamente pelo Portal Ambiental.
`;

}

function gerarPopupHTML(unidade, gestor, uriArquivo) {

    return `
        <div class="dossie-popup-card">

            <div class="dossie-popup-title">
                📋 DOSSIÊ DA UNIDADE
            </div>

            <div class="dossie-popup-text">

                <b>Unidade:</b><br>
                ${unidade.nome}

                <hr>

                <b>Focal Técnico</b><br>

                ${gestor.nome}<br>

                Matrícula: ${gestor.matricula}<br>

                E-mail: ${gestor.email}

                <hr>

                <b>Vistorias:</b> ${unidade.vistorias}<br>

                <b>Focos encontrados:</b> ${unidade.focos}<br>

                <b>Focos remediados:</b> ${unidade.remediados}<br>

                <b>Semanas sem foco:</b> ${unidade.semanasLimpas}

            </div>

            <a
                class="dossie-btn-down"
                download="Dossie_${unidade.nome.replace(/\s+/g, "_")}.txt"
                href="${uriArquivo}">

                📥 Baixar Relatório

            </a>

        </div>
    `;

}

// ─────────────────────────────────────────────────────────────
// ATUALIZAÇÃO DOS KPIs
// ─────────────────────────────────────────────────────────────

const totalUnidades = Object.keys(sumarioUnidades).length;

const unidadesComFoco =
    Object.values(sumarioUnidades)
        .filter(u => u.focos > 0)
        .length;

const taxaConformidade =
    totalUnidades === 0
        ? "100%"
        : `${(((totalUnidades - unidadesComFoco) / totalUnidades) * 100).toFixed(1)}%`;

const taxaRemediacao =
    totalFocosEncontradosGlobal === 0
        ? "100.0%"
        : `${((totalFocosRemediadosGlobal / totalFocosEncontradosGlobal) * 100).toFixed(1)}%`;

atualizarKPI("kpi_vistorias", totalVistoriasRealizadas);
atualizarKPI("kpi_sem_foco", taxaConformidade);
atualizarKPI("kpi_remediados", taxaRemediacao);

// ─────────────────────────────────────────────────────────────
// MAPA LEAFLET
// ─────────────────────────────────────────────────────────────

Object.values(sumarioUnidades).forEach(unidade => {

    const coords = obterCoordsFixas(unidade.nome);

    let corPino = "#28a745";

    if (unidade.critico) {

        corPino = "#dc3545";

    } else if (unidade.focos > 0) {

        corPino = "#ffc107";

    }

    const marker = L.circleMarker([coords.lat, coords.lng], {

        radius: 8,

        fillColor: corPino,

        color: "#ffffff",

        weight: 2,

        fillOpacity: 0.9

    }).addTo(map);

    marker.on("click", async () => {

        marker
            .bindPopup(`
                <div class="text-center p-2">
                    <i class="fas fa-spinner fa-spin text-danger"></i>
                    Carregando dossiê...
                </div>
            `)
            .openPopup();

        const gestor = await AedesAPI.getFocalDossie(unidade.nome);

        gestor.nome = gestor.nome || "Não vinculado";
        gestor.matricula = gestor.matricula || "-";
        gestor.email = gestor.email || "-";

        const textoDossie = gerarTextoDossie(unidade, gestor);

        const uriArquivo =
            "data:text/plain;charset=utf-8," +
            encodeURIComponent(textoDossie);

        marker.setPopupContent(

            gerarPopupHTML(

                unidade,

                gestor,

                uriArquivo

            )

        );

    });

});
    // ─── TABELA 1: RANKING DE CONFORMIDADE SEMANAL ───────────────────────────

const totalSemanasLimpasPorUnidade = {};

unidadesUnicas.forEach(u => {
    totalSemanasLimpasPorUnidade[u] = 0;
});

dadosBrutos.forEach(d => {

    if (
        d.Unidade &&
        d.visitada === 1 &&
        d.foco_encontrado === 0
    ) {
        totalSemanasLimpasPorUnidade[d.Unidade]++;
    }

});

const datasetRanking = Object.keys(totalSemanasLimpasPorUnidade)
    .map(unidade => ({
        unidade,
        qtd: totalSemanasLimpasPorUnidade[unidade]
    }))
    .sort((a, b) => {

        if (b.qtd !== a.qtd)
            return b.qtd - a.qtd;

        return a.unidade.localeCompare(b.unidade);

    })
    .map((d, index) => [

        `<span style="font-weight:bold;color:#cc0000">${index + 1}º</span>`,
        d.unidade,
        d.qtd

    ]);

$('#tabela_unidades_resumo').DataTable({

    destroy: true,
    data: datasetRanking,

    columns: [

        { title: "Posição" },
        { title: "Unidade" },
        { title: "Semanas 100% Limpas" }

    ],

    pageLength: 5,
    ordering: false,
    dom: "tp",

    language: {
        paginate: {
            previous: "👈",
            next: "👉"
        }
    }

});


// ─── GRÁFICOS ─────────────────────────────────────────────────────────────

function criarEstruturaGraficoPizza(idCanvas, labels, valores, titulo) {

    const canvas = document.getElementById(idCanvas);

    if (!canvas)
        return;

    new Chart(canvas, {

        type: "pie",

        data: {

            labels,

            datasets: [{

                data: valores,

                backgroundColor: [
                    "#ec1c24",
                    "#22b14c",
                    "#ff7f27",
                    "#3f48cc",
                    "#a349a4",
                    "#00a2e8",
                    "#e066ff"
                ]

            }]

        },

        options: {

            responsive: true,

            plugins: {

                title: {

                    display: true,
                    text: titulo

                }

            }

        }

    });

}


// ─── CONTADORES DOS GRÁFICOS ──────────────────────────────────────────────

const contagemMotivosVistoria = {};
const contagemMotivosRemediacao = {};
const contagemLocaisFoco = {};

const listaOutrosVistoria = [];
const listaOutrosRemediacao = [];
const listaOutrosLocais = [];

dadosBrutos.forEach(d => {

    // ===============================
    // OUTROS (texto livre)
    // ===============================

    if (
        d.outros_motivo_nao_vistoria &&
        d.outros_motivo_nao_vistoria !== "-"
    ) {

        listaOutrosVistoria.push([
            d.data_formatada || d.data_registro,
            d.Unidade,
            d.outros_motivo_nao_vistoria
        ]);

    }

    if (
        d.outros_motivo_nao_remediacao &&
        d.outros_motivo_nao_remediacao !== "-"
    ) {

        listaOutrosRemediacao.push([
            d.data_formatada || d.data_registro,
            d.Unidade,
            d.outros_motivo_nao_remediacao
        ]);

    }

    if (
        d.outros_local &&
        d.outros_local !== "-"
    ) {

        listaOutrosLocais.push([
            d.data_formatada || d.data_registro,
            d.Unidade,
            d.outros_local
        ]);

    }

    // ===============================
    // MOTIVOS DE NÃO VISTORIA
    // ===============================

    let motivosVistoria = [];

    try {

        motivosVistoria =
            typeof d.motivos_nao_vistoria === "string"
                ? JSON.parse(d.motivos_nao_vistoria)
                : d.motivos_nao_vistoria || [];

    } catch {

        motivosVistoria = [];

    }

    motivosVistoria.forEach(item => {

        contagemMotivosVistoria[item] =
            (contagemMotivosVistoria[item] || 0) + 1;

    });

    // ===============================
    // MOTIVOS DE NÃO REMEDIAÇÃO
    // ===============================

    let motivosRem = [];

    try {

        motivosRem =
            typeof d.motivos_nao_remediacao === "string"
                ? JSON.parse(d.motivos_nao_remediacao)
                : d.motivos_nao_remediacao || [];

    } catch {

        motivosRem = [];

    }

    motivosRem.forEach(item => {

        contagemMotivosRemediacao[item] =
            (contagemMotivosRemediacao[item] || 0) + 1;

    });

    // ===============================
    // LOCAIS DOS FOCOS
    // ===============================

    let locais = [];

    try {

        locais =
            typeof d.locais_foco === "string"
                ? JSON.parse(d.locais_foco)
                : d.locais_foco || [];

    } catch {

        locais = [];

    }

    locais.forEach(item => {

        contagemLocaisFoco[item] =
            (contagemLocaisFoco[item] || 0) + 1;

    });

});


// ─── DESENHA OS GRÁFICOS ───────────────────────────────────────────────────

criarEstruturaGraficoPizza(
    "chart_vistoria",
    Object.keys(contagemMotivosVistoria),
    Object.values(contagemMotivosVistoria),
    "Motivos de Não Vistoria"
);

criarEstruturaGraficoPizza(
    "chart_remediacao",
    Object.keys(contagemMotivosRemediacao),
    Object.values(contagemMotivosRemediacao),
    "Motivos de Não Remediação"
);

criarEstruturaGraficoPizza(
    "chart_locais",
    Object.keys(contagemLocaisFoco),
    Object.values(contagemLocaisFoco),
    "Locais de Foco Encontrados"
);

   // ─── GRÁFICOS ───────────────────────────────────────────────────────────────

criarEstruturaGraficoPizza(
    "chart_vistoria",
    Object.keys(contagemMotivosVistoria),
    Object.values(contagemMotivosVistoria),
    "Motivos de Não Vistoria"
);

criarEstruturaGraficoPizza(
    "chart_remediacao",
    Object.keys(contagemMotivosRemediacao),
    Object.values(contagemMotivosRemediacao),
    "Motivos de Não Remediação"
);

criarEstruturaGraficoPizza(
    "chart_locais",
    Object.keys(contagemLocaisFoco),
    Object.values(contagemLocaisFoco),
    "Locais de Foco Identificados"
);


// ─── TABELAS "OUTROS" ───────────────────────────────────────────────────────

const colunasSubTabela = [
    { title: "Data" },
    { title: "Unidade" },
    { title: "Descrição" }
];

$("#table_outros_vistoria").DataTable({
    destroy: true,
    data: listaOutrosVistoria,
    columns: colunasSubTabela,
    pageLength: 4,
    dom: "tp"
});

$("#table_outros_remediacao").DataTable({
    destroy: true,
    data: listaOutrosRemediacao,
    columns: colunasSubTabela,
    pageLength: 4,
    dom: "tp"
});

$("#table_outros_locais").DataTable({
    destroy: true,
    data: listaOutrosLocais,
    columns: colunasSubTabela,
    pageLength: 4,
    dom: "tp"
});


// ─── TABELA TÉCNICA CONSOLIDADA ─────────────────────────────────────────────

function formatarCampoMultiplo(valor) {

    if (!valor)
        return "-";

    if (Array.isArray(valor))
        return valor.join(", ");

    if (typeof valor === "string") {

        try {

            const arr = JSON.parse(valor);

            if (Array.isArray(arr))
                return arr.length ? arr.join(", ") : "-";

        } catch {

            return valor || "-";

        }

    }

    return "-";

}

const datasetTecnicoFull = dadosBrutos.map(d => {

    let statusVistoria =
        d.visitada === 1
            ? "Realizada"
            : "Não Realizada";

    let statusFoco = "Sem foco";

    if (d.visitada === 0)
        statusFoco = "Não Aplicável";

    else if (d.foco_encontrado === 1 && d.foco_remediado === 1)
        statusFoco = "Remediado";

    else if (d.foco_encontrado === 1)
        statusFoco = "Não Remediado";

    return [

        d.data_formatada || d.data_registro || "-",

        d.Unidade,

        statusVistoria,

        statusFoco,

        formatarCampoMultiplo(d.motivos_nao_vistoria),

        d.outros_motivo_nao_vistoria || "-",

        formatarCampoMultiplo(d.motivos_nao_remediacao),

        d.outros_motivo_nao_remediacao || "-",

        formatarCampoMultiplo(d.locais_foco),

        d.outros_local || "-",

        `${mapaMesesId[d.Mes_Nome]}/${d.Ano}`

    ];

});


const tableTecnica = $("#tabela_mensal_tecnica").DataTable({

    destroy: true,

    data: datasetTecnicoFull,

    columns: [

        { title: "Data" },
        { title: "Unidade" },
        { title: "Vistoria" },
        { title: "Foco" },
        { title: "Motivo Não Vistoria" },
        { title: "Outros (Vistoria)" },
        { title: "Motivo Não Remediação" },
        { title: "Outros (Remediação)" },
        { title: "Locais do Foco" },
        { title: "Outros Locais" },
        { visible: false }

    ],

    scrollX: true,

    paging: false,

    dom: "t",

    createdRow: function (row, data) {

        if (data[2] === "Realizada")
            $("td", row).eq(2).css("background-color", "#d4edda");
        else
            $("td", row).eq(2).css("background-color", "#f8d7da");

        switch (data[3]) {

            case "Sem foco":
                $("td", row).eq(3).css("background-color", "#d4edda");
                break;

            case "Remediado":
                $("td", row).eq(3).css("background-color", "#fff3cd");
                break;

            case "Não Remediado":
                $("td", row).eq(3).css("background-color", "#f8d7da");
                break;

            default:
                $("td", row).eq(3).css("background-color", "#e9ecef");

        }

    }

});


// ─── FILTROS ────────────────────────────────────────────────────────────────

$("#filtro_unidade, #filtro_mes_ano").on("change", function () {

    const unidade = $("#filtro_unidade").val();
    const mes = $("#filtro_mes_ano").val();

    tableTecnica
        .column(1)
        .search(unidade === "Todas" ? "" : "^" + unidade + "$", true, false);

    tableTecnica
        .column(10)
        .search(mes === "Todos" ? "" : mes);

    tableTecnica.draw();

});

});