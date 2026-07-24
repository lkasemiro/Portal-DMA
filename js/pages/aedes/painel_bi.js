import { AedesAPI } from '/js/modules/aedes/aedes-api.js';

// Variáveis de Estado da Aplicação
let dadosCompletos = [];
let unidadesOriginais = [];
let graficosInstanciados = {};

// Cores Oficiais CEDAE / Painel
const CORES = {
    vistoriaRealizada: '#0d4a86',
    vistoriaNaoRealizada: '#e53e3e',
    vistoriaNaoInformada: '#718096',
    fundoCinza: '#e2e8f0'
};

document.addEventListener('DOMContentLoaded', async () => {
    await inicializarDashboard();
});

// Inicialização de Dados, Eventos e Elementos Dinâmicos
async function inicializarDashboard() {
    // 1. Mostrar Data de Atualização
    document.getElementById('data-atualizacao').innerText = '10 de outubro de 2024';

    // 2. Buscar Dados Primários das APIs com fallback caso falhem
    let unidades = [];
    let dadosPainel = [];
    let motivos = [];

    try {
        // Promise.all executa em paralelo. Se alterarmos a API para retornar [] no catch, 
        // nenhuma dessas variáveis lançará exceções fatais.
        [unidades, dadosPainel, motivos] = await Promise.all([
            AedesAPI.getUnidades(),
            AedesAPI.getDadosPainel(),
            AedesAPI.getMotivosNaoVistoria()
        ]);
    } catch (err) {
        console.error("Erro crítico ao carregar dados do Promise.all:", err);
    }

    // Salva nos estados globais (garante que sejam arrays mesmo se vierem nulos)
    unidadesOriginais = Array.isArray(unidades) ? unidades : [];
    dadosCompletos = Array.isArray(dadosPainel) ? dadosPainel : [];

    // 3. Renderizar Filtros de forma segura
    popularFiltroUnidades(unidadesOriginais);
    popularFiltrosDropdowns(dadosCompletos);
    atualizarContadoresGerais(unidadesOriginais.length);

    // 4. Renderizar Gráficos
    processarEAtualizarPainel();

    // 5. Configurar Ouvintes de Eventos para os Filtros
    configurarFiltros();
}

// Popular Checklist de Unidades
// Altere para mapear unidade_id em vez de id_unidade
function popularFiltroUnidades(unidades) {
    const container = document.getElementById('lista-unidades');
    container.innerHTML = '';
    unidades.forEach(un => {
        const item = document.createElement('div');
        item.className = 'flex items-center space-x-2';
        
        // CORRIGIDO: un.unidade_id e un.nome_unidade
        const idUnidade = un.unidade_id; 
        const nomeUnidade = un.nome_unidade;

        item.innerHTML = `
            <input type="checkbox" value="${nomeUnidade}" class="filtro-chk-unidade rounded text-blue-600 focus:ring-blue-500">
            <span class="truncate" title="${nomeUnidade}">${nomeUnidade}</span>
        `;
        container.appendChild(item);
    });
}

// Popular Filtros de Diretoria e Setores baseados nos dados coletados
function popularFiltrosDropdowns(dados) {
    const diretorias = [...new Set(dados.map(d => d.diretoria).filter(Boolean))];
    const setores = [...new Set(dados.map(d => d.setor).filter(Boolean))];

    const selDiretoria = document.getElementById('filtro-diretoria');
    diretorias.forEach(dir => {
        const opt = new Option(dir, dir);
        selDiretoria.add(opt);
    });

    const selSetor = document.getElementById('filtro-setor');
    setores.forEach(setor => {
        const opt = new Option(setor, setor);
        selSetor.add(opt);
    });

    const selSemana = document.getElementById('filtro-semana');
    const semanas = [...new Set(dados.map(d => d.semana_projeto).filter(Boolean))].sort((a,b)=>a-b);
    semanas.forEach(sem => {
        const opt = new Option(`Semana ${sem}`, sem);
        selSemana.add(opt);
    });
}

function atualizarContadoresGerais(totalUnidades) {
    document.getElementById('total-unidades-num').innerText = totalUnidades;
}

// Processamento e cruzamento de dados para montar os Gráficos
function processarEAtualizarPainel() {
    const dadosFiltrados = obterDadosFiltrados();

    // Cálculos para os Medidores (Gauges)
    const total = dadosFiltrados.length || 1; // Prevenir divisão por zero
    
    // Supondo estrutura de dados onde:
    // status: 1 = Realizada, 2 = Não Realizada, 3 = Não Informada (Ou equivalente textual/booleano)
    const realizadas = dadosFiltrados.filter(d => d.vistoria_realizada === true || d.status === 'Realizada').length;
    const naoRealizadas = dadosFiltrados.filter(d => d.vistoria_realizada === false || d.status === 'Não Realizada').length;
    const naoInformadas = dadosFiltrados.filter(d => d.status_vistoria === 'Não informado' || d.status === 'Não informado' || !d.status).length;

    const pctRealizadas = Math.round((realizadas / total) * 100);
    const pctNaoRealizadas = Math.round((naoRealizadas / total) * 100);
    const pctNaoInformadas = Math.round((naoInformadas / total) * 100);

    // Atualizar Elementos HTML
    document.getElementById('pct-realizadas').innerText = `${pctRealizadas}%`;
    document.getElementById('qtd-realizadas').innerText = realizadas;

    document.getElementById('pct-nao-realizadas').innerText = `${pctNaoRealizadas}%`;
    document.getElementById('qtd-nao-realizadas').innerText = naoRealizadas;

    document.getElementById('pct-nao-informadas').innerText = `${pctNaoInformadas}%`;
    document.getElementById('qtd-nao-informadas').innerText = naoInformadas;

    document.querySelectorAll('.total-base').forEach(el => el.innerText = total);

    // Atualizar Gráficos Redondos (Gauge / Semicírculo)
    renderizarMedidor('chart-realizadas', pctRealizadas, CORES.vistoriaRealizada);
    renderizarMedidor('chart-nao-realizadas', pctNaoRealizadas, CORES.vistoriaNaoRealizada);
    renderizarMedidor('chart-nao-informadas', pctNaoInformadas, CORES.vistoriaNaoInformada);

    // Atualizar Gráfico de Barras Empilhadas por Semana de Projeto
    renderizarGraficoBarrasEmpilhadas(dadosFiltrados);

    // Atualizar os Motivos de Impedimento exibidos na tela
    renderizarMotivosNaoVistoria();
}

// Retorna os dados com base na interação do usuário nos inputs e dropdowns
function obterDadosFiltrados() {
    let filtrados = [...dadosCompletos];

    const diretoriaVal = document.getElementById('filtro-diretoria').value;
    const setorVal = document.getElementById('filtro-setor').value;
    const semanaVal = document.getElementById('filtro-semana').value;
    const dataInicio = new Date(document.getElementById('data-inicio').value);
    const dataFim = new Date(document.getElementById('data-fim').value);

    // Filtro Diretoria
    if (diretoriaVal !== 'Todos') {
        filtrados = filtrados.filter(d => d.diretoria === diretoriaVal);
    }

    // Filtro Setor
    if (setorVal !== 'Todos') {
        filtrados = filtrados.filter(d => d.setor === setorVal);
    }

    // Filtro Semana Acumulada
    if (semanaVal !== 'Todos') {
        filtrados = filtrados.filter(d => d.semana_projeto == semanaVal);
    }

    // Filtro por Data/Período (Supondo que haja um atributo data_registro)
    filtrados = filtrados.filter(d => {
        if (!d.data_registro) return true;
        const dReg = new Date(d.data_registro);
        return dReg >= dataInicio && dReg <= dataFim;
    });

    // Filtro Unidades Checklist corrigido para ler a propriedade "Unidade" retornada pelo banco
    const checkboxesSelecionados = Array.from(document.querySelectorAll('.filtro-chk-unidade:checked')).map(cb => cb.value);
    if (checkboxesSelecionados.length > 0) {
        // CORRIGIDO: d.Unidade mapeia para o nome textual gravado na fato_vistorias
        filtrados = filtrados.filter(d => checkboxesSelecionados.includes(d.Unidade));
    }

    return filtrados;
}

// Renderizador Genérico de Medidor Semicírculo (Gauge Style)
function renderizarMedidor(canvasId, percentual, corAtiva) {
    if (graficosInstanciados[canvasId]) {
        graficosInstanciados[canvasId].destroy();
    }

    const ctx = document.getElementById(canvasId).getContext('2d');
    graficosInstanciados[canvasId] = new Chart(ctx, {
        type: 'doughnut',
        data: {
            datasets: [{
                data: [percentual, 100 - percentual],
                backgroundColor: [corAtiva, CORES.fundoCinza],
                borderWidth: 0
            }]
        },
        options: {
            rotation: 270,
            circumference: 180,
            cutout: '75%',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { enabled: false }
            }
        }
    });
}

// Renderiza o Gráfico de Barras Empilhadas
function renderizarGraficoBarrasEmpilhadas(dados) {
    const canvasId = 'chart-status-vistoria';
    if (graficosInstanciados[canvasId]) {
        graficosInstanciados[canvasId].destroy();
    }

    // Agrupar dados por Semana do Projeto
    const gruposSemanas = {};
    dados.forEach(d => {
        const sem = d.semana_projeto || 'N/I';
        if (!gruposSemanas[sem]) {
            gruposSemanas[sem] = { realizadas: 0, naoRealizadas: 0, naoInformadas: 0 };
        }

        if (d.vistoria_realizada === true || d.status === 'Realizada') {
            gruposSemanas[sem].realizadas++;
        } else if (d.vistoria_realizada === false || d.status === 'Não Realizada') {
            gruposSemanas[sem].naoRealizadas++;
        } else {
            gruposSemanas[sem].naoInformadas++;
        }
    });

    const labelsSemanas = Object.keys(gruposSemanas).sort((a,b) => parseInt(a) - parseInt(b));
    const dataRealizadas = labelsSemanas.map(sem => gruposSemanas[sem].realizadas);
    const dataNaoRealizadas = labelsSemanas.map(sem => gruposSemanas[sem].naoRealizadas);
    const dataNaoInformadas = labelsSemanas.map(sem => gruposSemanas[sem].naoInformadas);

    const ctx = document.getElementById(canvasId).getContext('2d');
    graficosInstanciados[canvasId] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labelsSemanas.map(sem => `S.${sem}`),
            datasets: [
                {
                    label: 'Vistorias',
                    data: dataRealizadas,
                    backgroundColor: '#48bb78', // Verde (Realizada)
                },
                {
                    label: 'Sem vistoria',
                    data: dataNaoRealizadas,
                    backgroundColor: CORES.vistoriaNaoRealizada, // Vermelho
                },
                {
                    label: 'Não informado',
                    data: dataNaoInformadas,
                    backgroundColor: CORES.vistoriaNaoInformada, // Cinza
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { stacked: true, grid: { display: false } },
                y: { stacked: true }
            },
            plugins: {
                legend: { position: 'top', labels: { boxWidth: 12 } }
            }
        }
    });
}

// Mostrar Motivos Dinamicamente
async function renderizarMotivosNaoVistoria() {
    const container = document.getElementById('motivos-container');
    const motivos = await AedesAPI.getMotivosNaoVistoria();

    if (!motivos || motivos.length === 0) {
        container.innerHTML = `<p class="italic text-gray-400 text-xs">Nenhum impedimento registrado.</p>`;
        return;
    }

    // Listar os principais motivos recebidos
    container.innerHTML = '';
    motivos.slice(0, 5).forEach(m => {
        const item = document.createElement('div');
        item.className = 'flex justify-between border-b border-gray-100 py-1';
        item.innerHTML = `
            <span class="font-medium text-gray-700">${m.motivo || m.descricao || 'Impedimento técnico'}</span>
            <span class="text-xs bg-red-100 text-red-700 font-bold px-2 py-0.5 rounded-full">${m.quantidade || m.total || 1} ocorrência(s)</span>
        `;
        container.appendChild(item);
    });
}

// Configuração de Event Listeners nos Elementos de Filtro
function configurarFiltros() {
    const filtrosInterativos = [
        'filtro-diretoria',
        'filtro-setor',
        'filtro-semana',
        'data-inicio',
        'data-fim'
    ];

    filtrosInterativos.forEach(id => {
        document.getElementById(id).addEventListener('change', () => {
            processarEAtualizarPainel();
        });
    });

    // Filtros de Checkbox de Unidade
    document.getElementById('lista-unidades').addEventListener('change', (e) => {
        if (e.target.classList.contains('filtro-chk-unidade')) {
            processarEAtualizarPainel();
        }
    });

    // Botão Limpar Filtros
    document.getElementById('btn-limpar').addEventListener('click', () => {
        document.getElementById('filtro-diretoria').value = 'Todos';
        document.getElementById('filtro-setor').value = 'Todos';
        document.getElementById('filtro-semana').value = 'Todos';
        document.getElementById('data-inicio').value = '2023-01-01';
        document.getElementById('data-fim').value = '2024-12-31';
        
        document.querySelectorAll('.filtro-chk-unidade').forEach(cb => cb.checked = false);
        
        processarEAtualizarPainel();
    });
}