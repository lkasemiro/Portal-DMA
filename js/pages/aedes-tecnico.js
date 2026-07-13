
import { AedesAPI } from '../modules/aedes/aedes-api.js';


const LABELS_MAP = {
    "objetos_acumulando_agua": "Objetos acumulando água",
    "reservatorio_de_agua": "Reservatório de água",
    "bromelias": "Bromélias",
    "outros": "Outros",
    "sem_condicao_acesso": "Sem acesso",
    "sem_brigadista": "Sem brigadista",
    "sem_viatura_disponivel": "Sem viatura disponível",
    "esquecimento": "Esquecimento",
    "falta_de_cloro_larvicida": "Falta de cloro/larvicida",
    "necessidade_limpeza_terreno": "Necessidade de limpeza do terreno",
    "reservatorio_sem_cobertura": "Reservatório sem cobertura"
};

async function inicializarModuloAedes() {
    try {
        console.log("A carregar Módulo Aedes...");
        const todosLotes = await AedesAPI.getLotes();
        const todasUnidades = await AedesAPI.getUnidades();

        const dataCorte = new Date('2026-05-14T00:00:00');
        const lotesValidos = todosLotes.filter(lote => {
            const dataLote = new Date(lote.data_envio);
            return dataLote >= dataCorte;
        });

        const lotesConsolidadosCompleto = integrarUnidadesAusentes(lotesValidos, todasUnidades);
        renderizarTabelaConsolidada(lotesConsolidadosCompleto);

        const btnExport = document.getElementById('btnExportExcel');
        if (btnExport) {
            btnExport.onclick = () => exportarParaExcel(lotesConsolidadosCompleto);
        }
    } catch (error) {
        console.error("Erro crítico no Módulo Aedes:", error);
    }
}

function integrarUnidadesAusentes(lotes, todasUnidades) {
    if (!todasUnidades || !Array.isArray(todasUnidades)) {
        console.warn("Lista de unidades não encontrada ou inválida. Ignorando cruzamento.");
        return lotes;
    }

    const unidadesQueEnviaram = new Set();
    lotes.forEach(lote => {
        const registros = lote.payload_completo?.dados || lote.dados || [];
        registros.forEach(r => {
            if (r[1]) unidadesQueEnviaram.add(String(r[1]).trim().toLowerCase());
        });
    });

    const unidadesAusentes = todasUnidades.filter(u => {
        const nomeUnidade = typeof u === 'string' ? u : (u.nome || u.nome_unidade);
        return nomeUnidade && !unidadesQueEnviaram.has(nomeUnidade.trim().toLowerCase());
    });

    if (unidadesAusentes.length === 0) return lotes;

    const dadosAusentes = unidadesAusentes.map(u => {
        const nomeUnidade = typeof u === 'string' ? u : (u.nome || u.nome_unidade);
        return [
            null,
            nomeUnidade,
            "Não Informado",
            "-",
            "-",
            "-",
            "",
            "-",
            "",
            "-",
            "",
            "Unidade não enviou o lote até o momento."
        ];
    });

    const loteFaltantes = {
        data_envio: null,
        focal_nome: "Sistema (Ausente)",
        dados: dadosAusentes
    };

    return [...lotes, loteFaltantes];
}

function renderizarTabelaConsolidada(lotes) {
    const container = document.getElementById('containerTabelaAedes');
    if (!container) return;

    let html = `
        <table class="tabela-custom">
            <thead>
                <tr>
                    <th>DATA</th>
                    <th>UNIDADE</th>
                    <th>VISTORIA</th>
                    <th>FOCO</th>
                    <th>LOCAL FOCO</th>
                    <th>REMEDIAÇÃO</th>  
                    <th>DETALHES / OUTROS</th>
                    <th>OBSERVAÇÕES</th>
                </tr>
            </thead>
            <tbody>
    `;

    lotes.forEach(lote => {
        const registros = lote.payload_completo?.dados || lote.dados || []; 
        const dataEnvio = lote.data_envio ? new Date(lote.data_envio).toLocaleDateString('pt-BR') : "---";

        registros.forEach(r => {
            const statusVistoria = String(r[2]).toLowerCase();
            const fezVistoria  = statusVistoria === 'sim';
            const naoInformado = statusVistoria === 'não informado' || statusVistoria === 'nao informado';
            
            const temFoco      = String(r[3]).toLowerCase() === 'sim';
            const foiRemediado = String(r[4]).toLowerCase() === 'sim';
            
            let localFoco = Array.isArray(r[5]) ? r[5].join(", ") : (r[5] || "");
            
            const outrosLocalFoco           = (r[6] && !['sim', 'nao', 'não', '-'].includes(String(r[6]).toLowerCase().trim())) ? r[6] : "";
            const outrosMotivoNaoVistoria   = (r[8] && !['sim', 'nao', 'não', '-'].includes(String(r[8]).toLowerCase().trim())) ? r[8] : "";
            const outrosMotivoNaoRemediacao = (r[10] && !['sim', 'nao', 'não', '-'].includes(String(r[10]).toLowerCase().trim())) ? r[10] : "";
            const observacoes = r[11] || "-";

            let iconVistoria = '<span style="color: #000; font-weight: bold;">✖</span>';
            if (fezVistoria) {
                iconVistoria = '<span style="color: #16a34a; font-weight: bold;">✔</span>';
            } else if (naoInformado) {
                iconVistoria = '<span style="color: #d97706; font-weight: bold;">Não Informado</span>';
            }
            
            const displayFoco = (fezVistoria && !naoInformado)
                ? (temFoco 
                    ? `<span class="badge badge--danger"><span style="color: #ef4444; font-weight: bold;">✔</span></span>`
                    : '<span style="color: #000; font-weight: bold;">✖</span>')
                : '-';
            const displayRemediacao = (fezVistoria && temFoco && !naoInformado)
                ? (foiRemediado 
                    ? '<span style="color: #16a34a; font-weight: bold;">✔</span>' 
                    : '<span style="color: #ef4444; font-weight: bold;">✖</span>')
                : '-';
            const detalheOutros = [outrosMotivoNaoVistoria, outrosLocalFoco, outrosMotivoNaoRemediacao]
                                  .filter(txt => txt && txt.trim().length > 0)
                                  .join(" | ");

            html += `
                <tr>
                    <td>${dataEnvio}</td>
                    <td><b>${r[1]}</b></td>
                    <td style="text-align:center">${iconVistoria}</td>
                    <td style="text-align:center">${displayFoco}</td>
                    <td style="text-align:center;">
                        ${(fezVistoria && temFoco) ? `<b>${localFoco}</b>` : '-'}
                    </td>
                    <td style="text-align:center">${displayRemediacao}</td>
                    <td style="font-size:0.8rem; color:#1C1C1C; text-align:center;">${detalheOutros || "-"}</td>
                    <td style="font-size:0.8rem;">${observacoes}</td>
                </tr>
            `;
        });
    });

    html += `</tbody></table>`;
    container.innerHTML = html;
}

async function exportarParaExcel(lotes) {
    if (typeof ExcelJS === 'undefined') {
        alert("Erro: A biblioteca ExcelJS não foi carregada no HTML.");
        return;
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Relatório Consolidado Aedes');
    worksheet.columns = [
        { header: 'DATA', key: 'data', width: 12 },
        { header: 'FOCAL', key: 'focal', width: 20 },
        { header: 'UNIDADE', key: 'unidade', width: 25 },
        { header: 'VISTORIA', key: 'vistoria', width: 15 },
        { header: 'MOTIVO NÃO VISTORIA', key: 'motivo_nao_vistoria', width: 25 },
        { header: 'FOCO', key: 'foco', width: 12 },
        { header: 'LOCAL FOCO', key: 'local_foco', width: 25 },
        { header: 'REMEDIAÇÃO', key: 'remediacao', width: 15 },
        { header: 'MOTIVO NÃO REMEDIAÇÃO', key: 'motivo_nao_remediacao', width: 25 },
        { header: 'DETALHES / OUTROS', key: 'detalhes_outros', width: 35 },
        { header: 'OBSERVAÇÕES', key: 'obs', width: 30 }
    ];

    lotes.forEach(lote => {
        const registros = lote.payload_completo?.dados || lote.dados || [];
        const dataEnvio = lote.data_envio ? new Date(lote.data_envio).toLocaleDateString('pt-BR') : "-";
        const focalNome = lote.focal_nome || "N/A";

        registros.forEach(r => {
            const statusVistoria = String(r[2]).toLowerCase();
            const fezVistoria = statusVistoria === 'sim';
            const naoInformado = statusVistoria === 'não informado' || statusVistoria === 'nao informado';
            const temFoco     = String(r[3]).toLowerCase() === 'sim';
            let localFoco     = Array.isArray(r[5]) ? r[5].join(", ") : (r[5] || "");

            const motivoNaoVistoria = (!fezVistoria && !naoInformado) ? (Array.isArray(r[7]) ? r[7].join(", ") : (r[7] || "-")) : "-";
            const motivoNaoRemediacao = (fezVistoria && temFoco && String(r[4]).toLowerCase() !== 'sim' && !naoInformado)
                ? (Array.isArray(r[9]) ? r[9].join(", ") : (r[9] || "-"))
                : "-";
            
            const outrosLocalFoco           = (r[6] && !['sim', 'nao', 'não', '-'].includes(String(r[6]).toLowerCase().trim())) ? r[6] : "";
            const outrosMotivoNaoVistoria   = (r[8] && !['sim', 'nao', 'não', '-'].includes(String(r[8]).toLowerCase().trim())) ? r[8] : "";
            const outrosMotivoNaoRemediacao = (r[10] && !['sim', 'nao', 'não', '-'].includes(String(r[10]).toLowerCase().trim())) ? r[10] : "";
            const detalheOutros = [outrosMotivoNaoVistoria, outrosLocalFoco, outrosMotivoNaoRemediacao]
                                  .filter(txt => txt && txt.trim().length > 0)
                                  .join(" | ") || "-";

            const excelFoco        = fezVistoria ? (r[3] || "-") : "-";
            const excelLocalFoco   = (fezVistoria && temFoco) ? localFoco : "-";
            const excelRemediacao  = (fezVistoria && temFoco) ? (r[4] || "-") : "-";

            const row = worksheet.addRow({
                data: dataEnvio,
                focal: focalNome,
                unidade: r[1] || "-",
                vistoria: r[2] || "-",
                motivo_nao_vistoria: motivoNaoVistoria,
                foco: excelFoco,
                local_foco: excelLocalFoco,
                remediacao: excelRemediacao,
                motivo_nao_remediacao: motivoNaoRemediacao,
                detalhes_outros: detalheOutros,
                obs: r[11] || "-"
            });
            
            row.getCell('data').alignment = { horizontal: 'center' };
            row.getCell('vistoria').alignment = { horizontal: 'center' };
            row.getCell('motivo_nao_vistoria').alignment = { horizontal: 'center' };
            row.getCell('foco').alignment = { horizontal: 'center' };
            row.getCell('local_foco').alignment = { horizontal: 'center' };
            row.getCell('remediacao').alignment = { horizontal: 'center' };
            row.getCell('motivo_nao_remediacao').alignment = { horizontal: 'center' };
        });
    });

    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };
    worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '16A34A' } };
    worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    
    if (window.saveAs) {
        window.saveAs(blob, `Relatorio_Aedes_DMA_${new Date().getTime()}.xlsx`);
    } else {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `DMA_Aedes_Consolidado_${new Date().getTime()}.xlsx`;
        a.click();
    }
}

document.addEventListener("DOMContentLoaded", inicializarModuloAedes);