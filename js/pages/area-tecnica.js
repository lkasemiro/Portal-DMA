/**
 * Portal DMA - Hub de Gestão Técnico
 * Regras de Negócio, Conexões Assíncronas de Auditoria e Agenda Operacional
 */

// Endpoints Estruturais das Rotas de API
const API_DADOS_ORIGINAL = "https://api.puredengue.com.br/arquivos/lista/todos";
const API_AGENDA_URL = "/api/agenda";

let eventosAgenda = [];

// Escuta inicial do carregamento de página
document.addEventListener("DOMContentLoaded", () => {
    // 1. Processamento de Lotes e Indicadores (Aedes/Recicla)
    carregarDadosOriginais();
    
    // 2. Processamento do Módulo Interativo da Agenda
    initGerenciadorAgenda();
});

/* =========================================================================
   MÓDULO 1: PROCESSAMENTO DE KPIS E AUDITORIA DE LOTES RECENTES
   ========================================================================= */
async function carregarDadosOriginais() {
    const domElements = {
        vistoriasSim: document.getElementById('kpi-vistorias-sim'),
        vistoriasNao: document.getElementById('kpi-vistorias-nao'),
        focos: document.getElementById('kpi-focos'),
        remediados: document.getElementById('kpi-remediados'),
        lotes: document.getElementById('kpi-lotes'),
        esperados: document.getElementById('kpi-esperados')
    };

    try {
        const res = await fetch(API_DADOS_ORIGINAL);
        if (!res.ok) throw new Error("Erro de comunicação HTTP");
        const lotes = await res.json();

        let kpis = { sim: 0, nao: 0, focos: 0, remediados: 0 };

        lotes.forEach(l => {
            if (l.payload_completo && l.payload_completo.dados) {
                l.payload_completo.dados.forEach(u => {
                    if (u.vistoria_realizada === "sim") kpis.sim++;
                    if (u.vistoria_realizada === "nao") kpis.nao++;
                    if (parseInt(u.focos_encontrados) > 0) kpis.focos += parseInt(u.focos_encontrados);
                    if (parseInt(u.focos_remediados) > 0) kpis.remediados += parseInt(u.focos_remediados);
                });
            }
        });

        if (domElements.vistoriasSim) domElements.vistoriasSim.innerText = kpis.sim;
        if (domElements.vistoriasNao) domElements.vistoriasNao.innerText = kpis.nao;
        if (domElements.focos) domElements.focos.innerText = kpis.focos;
        if (domElements.remediados) domElements.remediados.innerText = kpis.remediados;
        if (domElements.lotes) domElements.lotes.innerText = lotes.length;
        if (domElements.esperados) domElements.esperados.innerText = "126";

        renderizarTabelaRecentes(lotes);

    } catch (error) {
        console.error("Erro operacional ao requisitar API de auditoria:", error);
    }
}

function renderizarTabelaRecentes(lotes) {
    const container = document.getElementById('mainDataTable');
    if (!container) return;

    // Isola os 10 lotes de envio mais novos
    const recentes = lotes.slice(0, 10);

    container.innerHTML = `
        <table>
            <thead>
                <tr>
                    <th>DATA ENVIO</th>
                    <th>FOCAL</th>
                    <th>UNIDADES NO LOTE</th>
                    <th>STATUS</th>
                </tr>
            </thead>
            <tbody>
                ${recentes.map(l => {
                    const nome = l.focal_nome || l.payload_completo?.cabecalho?.focal_nome || 'N/A';
                    const qtd = l.payload_completo?.dados?.length || 0;
                    return `
                    <tr>
                        <td style="font-weight:600">${l.data_envio ? new Date(l.data_envio).toLocaleDateString('pt-BR') : 'N/A'}</td>
                        <td>${nome}</td>
                        <td>${qtd} unidades</td>
                        <td><span style="color:var(--accent-green)">●</span> Sincronizado</td>
                    </tr>
                `}).join('')}
            </tbody>
        </table>`;
}

/* =========================================================================
   MÓDULO 2: GERENCIAMENTO DE ROTAS DA AGENDA OPERACIONAL (POST, GET, PUT, DELETE)
   ========================================================================= */
function initGerenciadorAgenda() {
    const form = document.getElementById('formAgendaEnvio');
    const btnCancelar = document.getElementById('btnCancelarEdicao');

    // Executa GET inicial das rotas do banco
    buscarEventosAgendaAPI();

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await salvarEventoAgenda();
        });
    }

    if (btnCancelar) {
        btnCancelar.addEventListener('click', limparFormularioAgenda);
    }
}

async function buscarEventosAgendaAPI() {
    try {
        const response = await fetch(API_AGENDA_URL);
        if (!response.ok) throw new Error('Falha na resposta da rota.');
        
        eventosAgenda = await response.json();
        renderizarTabelaAgenda();
    } catch (error) {
        console.error('Erro de sincronização da agenda:', error);
        const tabela = document.getElementById('tabelaAgendaCorpo');
        if (tabela) {
            tabela.innerHTML = `<tr><td colspan="6" style="color:var(--danger-red); text-align:center; padding:15px; font-weight:600;">
                <i class="fas fa-exclamation-triangle"></i> Erro ao conectar com o servidor da Agenda.
            </td></tr>`;
        }
    }
}

function renderizarTabelaAgenda() {
    const tabelaCorpo = document.getElementById('tabelaAgendaCorpo');
    if (!tabelaCorpo) return;

    if (eventosAgenda.length === 0) {
        tabelaCorpo.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#64748b; padding:15px;">Nenhum evento lançado no banco.</td></tr>`;
        return;
    }

    const categoriasLabels = {
        'geracao': 'Geração/Destinação',
        'sinalizacao': 'Sinalização/Placas',
        'pgrs': 'PGRS',
        'externo': 'Eventos Externos',
        'reuniao': 'Reuniões Técnicas'
    };

    tabelaCorpo.innerHTML = eventosAgenda.map(evento => {
        // Corrige tratamento de fuso horário UTC para o input nativo de data
        const dataBr = new Date(evento.data_evento).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
        return `
            <tr data-id="${evento.id}">
                <td><span class="agenda-badge badge-${evento.categoria}">${categoriasLabels[evento.categoria] || evento.categoria}</span></td>
                <td><strong>${evento.titulo}</strong></td>
                <td>${dataBr}</td>
                <td>${evento.horario || 'O dia todo'}</td>
                <td>${evento.local}</td>
                <td>
                    <div class="agenda-acoes">
                        <button type="button" class="btn-agenda-acao btn-edit" onclick="prepararEdicaoAgenda(${evento.id})" title="Editar"><i class="fas fa-edit"></i></button>
                        <button type="button" class="btn-agenda-acao btn-delete" onclick="deletarEventoAgenda(${evento.id})" title="Excluir"><i class="fas fa-trash-alt"></i></button>
                    </div>
                </td>
            </tr>`;
    }).join('');
}

async function salvarEventoAgenda() {
    const id = document.getElementById('agenda_id').value;
    const payload = {
        titulo: document.getElementById('agenda_titulo').value,
        categoria: document.getElementById('agenda_categoria').value,
        data_evento: document.getElementById('agenda_data').value,
        horario: document.getElementById('agenda_horario').value,
        local: document.getElementById('agenda_local').value,
        descricao: document.getElementById('agenda_descricao').value
    };

    const url = id ? `${API_AGENDA_URL}/${id}` : API_AGENDA_URL;
    const method = id ? 'PUT' : 'POST';

    try {
        const res = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error('Falha no armazenamento.');

        limparFormularioAgenda();
        await buscarEventosAgendaAPI();
    } catch (error) {
        alert('Erro ao processar requisição na rota do banco de dados.');
        console.error(error);
    }
}

function prepararEdicaoAgenda(id) {
    const evento = eventosAgenda.find(e => e.id === id);
    if (!evento) return;

    document.getElementById('agenda_id').value = evento.id;
    document.getElementById('agenda_titulo').value = evento.titulo;
    document.getElementById('agenda_categoria').value = evento.categoria;
    document.getElementById('agenda_data').value = evento.data_evento.split('T')[0];
    document.getElementById('agenda_horario').value = evento.horario || '';
    document.getElementById('agenda_local').value = evento.local;
    document.getElementById('agenda_descricao').value = evento.descricao || '';

    document.getElementById('agendaFormTitulo').innerHTML = '<i class="fas fa-edit"></i> Modificar Evento';
    document.getElementById('btnSalvarAgenda').innerHTML = '<i class="fas fa-check"></i> Atualizar Registro';
    document.getElementById('btnCancelarEdicao').style.display = 'inline-block';
    document.getElementById('secaoFormAgenda').scrollIntoView({ behavior: 'smooth' });
}

async function deletarEventoAgenda(id) {
    if (!confirm('Deseja excluir definitivamente este evento da agenda pública?')) return;
    try {
        const res = await fetch(`${API_AGENDA_URL}/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error();
        await buscarEventosAgendaAPI();
    } catch (error) {
        alert('Erro ao requisitar exclusão física no banco.');
    }
}

function limparFormularioAgenda() {
    document.getElementById('formAgendaEnvio').reset();
    document.getElementById('agenda_id').value = '';
    document.getElementById('agendaFormTitulo').innerHTML = '<i class="fas fa-plus-circle"></i> Lançar Novo Evento';
    document.getElementById('btnSalvarAgenda').innerHTML = '<i class="fas fa-plus"></i> Lançar Evento';
    document.getElementById('btnCancelarEdicao').style.display = 'none';
}
function navegarParaSubmodulo(url, elementoClicado) {
    // 1. Remove a classe ativa de todos os links da barra lateral
    document.querySelectorAll('.sidebar-menu a').forEach(a => a.classList.remove('active'));

    // 2. Adiciona a classe ativa no botão que acabou de ser clicado
    elementoClicado.classList.add('active');

    // 3. Substitui toda a área útil de trabalho (coluna central) pelo submódulo via iframe limpo
    const containerCentral = document.querySelector('.dashboard-center');
    if (containerCentral) {
        containerCentral.innerHTML = `
            <iframe src="${url}" style="width: 100%; height: calc(100vh - 80px); border: none; background: transparent;" title="Submódulo Técnico"></iframe>
        `;
    }
}
window.navegarParaSubmodulo = navegarParaSubmodulo;