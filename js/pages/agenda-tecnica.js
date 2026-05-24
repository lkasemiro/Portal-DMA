/**
 * Portal DMA - Módulo de Agenda Técnica
 * Gerenciamento de eventos operacionais e ambientais
 */

// Configuração de endpoints da API (Ajuste as URLs conforme seu ambiente)
const API_AGENDA_URL = '/api/agenda'; 

// Estado local dos eventos carregados da API
let eventosAgenda = [];
let eventoEdicaoId = null;

document.addEventListener('DOMContentLoaded', () => {
    initAgendaTecnica();
});

function initAgendaTecnica() {
    const form = document.getElementById('formAgendaEnvio');
    const btnCancelar = document.getElementById('btnCancelarEdicao');

    // Carrega a listagem inicial vinda do Banco de Dados
    buscarEventosAPI();

    // Evento de Submissão (Salvar / Atualizar)
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await salvarEvento();
        });
    }

    // Botão de Cancelar Edição
    if (btnCancelar) {
        btnCancelar.addEventListener('click', limparFormularioAgenda);
    }
}

/**
 * Busca a lista de eventos ativa no Banco de Dados através da rota cadastrada
 */
async function buscarEventosAPI() {
    try {
        const response = await fetch(API_AGENDA_URL);
        if (!response.ok) throw new Error('Erro ao buscar dados da agenda.');
        
        eventosAgenda = await response.json();
        renderizarTabelaAgenda();
    } catch (error) {
        console.error('Erro na requisição da agenda:', error);
        // Exibe mensagem amigável na tabela em caso de erro na rota
        const tabela = document.getElementById('tabelaAgendaCorpo');
        if (tabela) {
            tabela.innerHTML = `<tr><td colspan="6" style="color: var(--danger-red); text-align:center; padding:20px;">
                <i class="fas fa-exclamation-triangle"></i> Erro ao conectar com o servidor de rotas.
            </td></tr>`;
        }
    }
}

/**
 * Renderiza as linhas da tabela de gerenciamento com base nos dados da API
 */
function renderizarTabelaAgenda() {
    const tabelaCorpo = document.getElementById('tabelaAgendaCorpo');
    if (!tabelaCorpo) return;

    if (eventosAgenda.length === 0) {
        tabelaCorpo.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#64748b; padding:20px;">
            Nenhum evento ambiental agendado.
        </td></tr>`;
        return;
    }

    // Mapeamento de categorias para exibição de badges amigáveis
    const categoriasLabels = {
        'geracao': 'Geração/Destinação',
        'sinalizacao': 'Sinalização e Placas',
        'pgrs': 'PGRS',
        'externo': 'Eventos Externos',
        'reuniao': 'Reuniões Técnicas'
    };

    tabelaCorpo.innerHTML = eventosAgenda.map(evento => {
        // Formata data ISO para padrão brasileiro (PT-BR)
        const dataFormatada = new Date(evento.data_evento).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
        
        return `
            <tr data-id="${evento.id}">
                <td><span class="agenda-badge badge-${evento.categoria}">${categoriasLabels[evento.categoria] || evento.categoria}</span></td>
                <td><strong>${evento.titulo}</strong></td>
                <td><i class="far fa-calendar-alt"></i> ${dataFormatada}</td>
                <td><i class="far fa-clock"></i> ${evento.horario || 'O dia todo'}</td>
                <td><i class="fas fa-map-marker-alt"></i> ${evento.local}</td>
                <td>
                    <div class="agenda-acoes">
                        <button type="button" class="btn-agenda-acao btn-edit" onclick="prepararEdicao(${evento.id})" title="Editar Evento">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button type="button" class="btn-agenda-acao btn-delete" onclick="deletarEventoAPI(${evento.id})" title="Excluir Evento">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

/**
 * Envia os dados do formulário para a rota correspondente (POST ou PUT)
 */
async function salvarEvento() {
    const idInput = document.getElementById('agenda_id')?.value;
    const titulo = document.getElementById('agenda_titulo').value;
    const categoria = document.getElementById('agenda_categoria').value;
    const data_evento = document.getElementById('agenda_data').value;
    const horario = document.getElementById('agenda_horario').value;
    const local = document.getElementById('agenda_local').value;
    const descricao = document.getElementById('agenda_descricao').value;

    const payload = { titulo, categoria, data_evento, horario, local, descricao };
    
    const url = idInput ? `${API_AGENDA_URL}/${idInput}` : API_AGENDA_URL;
    const method = idInput ? 'PUT' : 'POST';

    try {
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error('Não foi possível salvar o registro.');

        limparFormularioAgenda();
        await buscarEventosAPI(); // Atualiza a tabela imediatamente
    } catch (error) {
        alert('Erro ao salvar o evento na agenda. Verifique o console ou a rota.');
        console.error(error);
    }
}

/**
 * Puxa os dados da linha selecionada para os inputs do formulário para edição
 */
function prepararEdicao(id) {
    const evento = eventosAgenda.find(e => e.id === id);
    if (!evento) return;

    document.getElementById('agenda_id').value = evento.id;
    document.getElementById('agenda_titulo').value = evento.titulo;
    document.getElementById('agenda_categoria').value = evento.categoria;
    
    // Formata a data para preencher o input type="date" (AAAA-MM-DD)
    const dataIso = evento.data_evento.split('T')[0];
    document.getElementById('agenda_data').value = dataIso;
    
    document.getElementById('agenda_horario').value = evento.horario || '';
    document.getElementById('agenda_local').value = evento.local;
    document.getElementById('agenda_descricao').value = evento.descricao || '';

    // Modifica o aspecto visual do formulário para modo edição
    document.getElementById('agendaFormTitulo').innerText = 'Editar Evento Comercial/Ambiental';
    document.getElementById('btnSalvarAgenda').innerHTML = '<i class="fas fa-check"></i> Atualizar Evento';
    document.getElementById('btnCancelarEdicao').style.display = 'inline-flex';
    
    // Rola a tela suavemente para o formulário
    document.getElementById('secaoFormAgenda').scrollIntoView({ behavior: 'smooth' });
}

/**
 * Executa a chamada DELETE para remover o registro do banco de dados
 */
async function deletarEventoAPI(id) {
    if (!confirm('Deseja realmente remover este evento de forma permanente da agenda pública?')) return;

    try {
        const response = await fetch(`${API_AGENDA_URL}/${id}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('Erro ao excluir registro.');

        await buscarEventosAPI();
    } catch (error) {
        alert('Não foi possível deletar o registro.');
        console.error(error);
    }
}

/**
 * Reseta o formulário limpando os campos e voltando ao estado de cadastro (POST)
 */
function limparFormularioAgenda() {
    const form = document.getElementById('formAgendaEnvio');
    if (form) form.reset();
    
    document.getElementById('agenda_id').value = '';
    document.getElementById('agendaFormTitulo').innerText = 'Lançar Novo Evento na Agenda';
    document.getElementById('btnSalvarAgenda').innerHTML = '<i class="fas fa-plus"></i> Lançar Evento';
    document.getElementById('btnCancelarEdicao').style.display = 'none';
}