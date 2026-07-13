import { AedesAPI } from './modules/aedes/aedes-api.js';

const loadingScreen = document.getElementById('loading-screen');
const sectionHubHome = document.getElementById('section-hub-home');
const sectionAuditoria = document.getElementById('section-auditoria-detalhada');

const btnEntrarAuditoria = document.getElementById('btn-entrar-auditoria-aedes');
const btnVoltarHub = document.getElementById('btn-voltar-ao-hub');
const menuHubLink = document.getElementById('menu-hub-link');

function removerLoading() {
    if (loadingScreen) {
        loadingScreen.style.opacity = '0';
        loadingScreen.style.visibility = 'hidden';
        setTimeout(() => { loadingScreen.remove(); }, 400);
    }
}

async function inicializarHubTecnico() {
    try {
        // Apenas busca os lotes para auditar e contar o volume básico
        const todosLotes = await AedesAPI.getLotes();
        
        const dataCorte = new Date('2026-05-14T00:00:00');
        const lotesFiltrados = todosLotes.filter(lote => {
            return new Date(lote.data_envio) >= dataCorte;
        });

        // Exibe dados superficiais de transações no Hub
        document.getElementById('hub-aedes-lotes').innerText = lotesFiltrados.length;
        document.getElementById('hub-aedes-vistorias').innerText = "Ver no Módulo";
        document.getElementById('hub-aedes-focos').innerText = "Ver no Módulo";

        // Renderiza o livro de logs brutos
        renderizarLivroAuditoria(lotesFiltrados);
        configurarNavegacao();
        removerLoading();

    } catch (error) {
        console.error("Erro no Hub Técnico:", error);
        removerLoading();
    }
}

function renderizarLivroAuditoria(lotes) {
    const tableContainer = document.getElementById('mainDataTable');
    if (!tableContainer) return;

    tableContainer.innerHTML = `
        <table>
            <thead>
                <tr>
                    <th>Data de Envio</th>
                    <th>Focal Técnico</th>
                    <th>Volume do Lote</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
                ${lotes.map(lote => `
                    <tr>
                        <td style="font-weight: 600;">${lote.data_envio ? new Date(lote.data_envio).toLocaleDateString('pt-BR') : 'N/A'}</td>
                        <td>${lote.focal_nome || 'Sistema'}</td>
                        <td>${lote.payload_completo?.dados?.length || 0} registros</td>
                        <td><span style="color: #22c55e;">●</span> Recebido no Banco</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function configurarNavegacao() {
    if (btnEntrarAuditoria) btnEntrarAuditoria.onclick = () => { sectionHubHome.style.display = 'none'; sectionAuditoria.style.display = 'flex'; };
    if (btnVoltarHub) btnVoltarHub.onclick = () => { sectionAuditoria.style.display = 'none'; sectionHubHome.style.display = 'flex'; };
    if (menuHubLink) menuHubLink.onclick = (e) => { e.preventDefault(); sectionAuditoria.style.display = 'none'; sectionHubHome.style.display = 'flex'; };
}

document.addEventListener("DOMContentLoaded", inicializarHubTecnico);