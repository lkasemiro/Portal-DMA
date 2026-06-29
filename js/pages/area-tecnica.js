import { AedesAPI } from '../modules/aedes/aedes-api.js';

async function inicializarDashboard() {
    try {
        const todosLotes = await AedesAPI.getLotes();
        
        const dataCorte = new Date('2026-05-14T00:00:00');
        const lotes = todosLotes.filter(lote => {
            const dataLote = new Date(lote.data_envio);
            return dataLote >= dataCorte;
        });

        let vistoriasRealizadas = 0;
        let vistoriasNaoRealizadas = 0;
        let totalFocos = 0;
        let totalRemediados = 0;

        lotes.forEach(lote => {
            const registros = lote.payload_completo?.dados || [];
            if (Array.isArray(registros)) {
                registros.forEach(r => {
                    // [2] Vistoria, [3] Foco, [4] Remediação
                    if (r[2] && String(r[2]).toLowerCase() === 'sim') {
                        vistoriasRealizadas++;
                        if (r[3] && String(r[3]).toLowerCase() === 'sim') totalFocos++;
                        if (r[4] && String(r[4]).toLowerCase() === 'sim') totalRemediados++;
                    } else if (r[2] && String(r[2]).toLowerCase() === 'nao') {
                        vistoriasNaoRealizadas++;
                    }
                });
            }
        });

        const domElements = {
            realizadas: document.getElementById('kpi-vistorias-sim'),
            naoRealizadas: document.getElementById('kpi-vistorias-nao'),
            focos: document.getElementById('kpi-focos'),
            remediados: document.getElementById('kpi-remediados'),
            esperados: document.getElementById('kpi-esperados') 
        };

        if (domElements.realizadas) domElements.realizadas.innerText = vistoriasRealizadas;
        if (domElements.naoRealizadas) domElements.naoRealizadas.innerText = vistoriasNaoRealizadas;
        if (domElements.focos) domElements.focos.innerText = totalFocos;
        if (domElements.remediados) domElements.remediados.innerText = totalRemediados;
        if (domElements.esperados) domElements.esperados.innerText = "126";

        renderizarTabelaRecentes(lotes);

    } catch (error) {
        console.error("Erro ao carregar dados:", error);
    }
}

function renderizarTabelaRecentes(lotes) {
    const container = document.getElementById('mainDataTable');
    if (!container) return;

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
        </table>
    `;
}

document.addEventListener("DOMContentLoaded", inicializarDashboard);