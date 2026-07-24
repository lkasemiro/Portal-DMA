// js/modules/aedes/dashboard_aedes.js

const API_BASE =
    window.location.hostname === "localhost"
        ? "http://localhost:3001"
        : "https://portal-dma.onrender.com";

console.log("🌐 API Conectada em:", `${API_BASE}/api/aedes/painel-dados`);

let mapaAedes = null;
// Estrutura de Zonas do Rio de Janeiro para dispersar os pins de forma realista
const ZONAS_RJ = [
    { nome: "Zona Sul", latMin: -22.98, latMax: -22.95, lngMin: -43.22, lngMax: -43.17 },
    { nome: "Centro / Porto", latMin: -22.91, latMax: -22.89, lngMin: -43.20, lngMax: -43.17 },
    { nome: "Zona Norte (Tijuca/Méier)", latMin: -22.93, latMax: -22.88, lngMin: -43.28, lngMax: -43.22 },
    { nome: "Zona Norte (Suburbana)", latMin: -22.88, latMax: -22.82, lngMin: -43.35, lngMax: -43.25 },
    { nome: "Baixada Fluminense (Margem)", latMin: -22.81, latMax: -22.75, lngMin: -43.40, lngMax: -43.30 },
    { nome: "Zona Oeste (Jacarepaguá/Barra)", latMin: -23.00, latMax: -22.93, lngMin: -43.42, lngMax: -43.30 },
    { nome: "Zona Oeste (Campo Grande/Bangu)", latMin: -22.92, latMax: -22.85, lngMin: -43.60, lngMax: -43.43 }
];

// Auxiliar para categorizar as strings longas nos gráficos de pizza/rosca
function agruparTermosAedes(motivoCru) {
    const texto = String(motivoCru || '').toLowerCase().trim();
    if (!texto || texto === 'null' || texto === 'não informado') return 'Não Informado';
    if (texto.includes('não há necessidade') || texto.includes('sem necessidade')) return 'Dispensa de Controlo';
    if (texto.includes('prédio cedido') || texto.includes('não pertence') || texto.includes('fechado')) return 'Prédio Inativo/Cedido';
    if (texto.includes('treinamento') || texto.includes('brigadista') || texto.includes('funcionário')) return 'Falta Recursos Humanos';
    if (texto.includes('cloro') || texto.includes('larvicida') || texto.includes('limpeza')) return 'Falta Insumos/Manutenção';
    if (texto.length > 30 || texto.includes(',') || texto.includes('-')) return 'Especificações Individuais';
    return motivoCru;
}

// Retorna uma latitude e longitude fictícia mas bem distribuída dentro do RJ usando um hash simples do nome
function obterCoordenadasPorNome(nomeUnidade, index) {
    const zona = ZONAS_RJ[index % ZONAS_RJ.length];
    // Gerador pseudo-aleatório baseado no nome da unidade para manter o pin sempre no mesmo lugar
    let hash = 0;
    for (let i = 0; i < nomeUnidade.length; i++) {
        hash = nomeUnidade.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    const pctLat = Math.abs(Math.sin(hash)) * 0.9; 
    const pctLng = Math.abs(Math.cos(hash)) * 0.9;
    const lat = zona.latMin + pctLat * (zona.latMax - zona.latMin);
    const lng = zona.lngMin + pctLng * (zona.lngMax - zona.lngMin);
    return [lat, lng];
}

// Inicializa e desenha os Pins no Mapa do Rio de Janeiro
function renderizarMapa(unidadesEstatísticas) {
    if (mapaAedes) {
        mapaAedes.remove();
    }

    // Centra o mapa no Rio de Janeiro
    mapaAedes = L.map('mapa_aedes').setView([-22.9068, -43.3400], 11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(mapaAedes);

    const criarIcone = (cor) => L.divIcon({
        className: 'custom-pin',
        html: `<div style="background-color: ${cor}; width: 15px; height: 15px; border-radius: 50%; border: 2.5px solid #fff; box-shadow: 0 0 6px rgba(0,0,0,0.45);"></div>`,
        iconSize: [15, 15],
        iconAnchor: [7, 7]
    });

    let pinsAdicionados = 0;

    unidadesEstatísticas.forEach((unidade, index) => {
        const [lat, lng] = obterCoordenadasPorNome(unidade.nome, index);
        const corPin = unidade.conforme ? '#16a34a' : '#ef4444'; // Verde se em conformidade, Vermelho se não

        let statusBadge = unidade.conforme
            ? `<span class="badge bg-success d-block py-1 mt-2">CONFORME</span>`
            : `<span class="badge bg-danger d-block py-1 mt-2">INCONFORME</span>`;

        let detalhesInconformidade = "";
        if (!unidade.conforme) {
            detalhesInconformidade = `<div class="mt-2 text-danger small" style="font-weight: 600; line-height: 1.2;">`;
            if (!unidade.vistoriaRealizada) detalhesInconformidade += `• Sem vistoria na semana vigente<br>`;
            if (unidade.focoAtivoPendente) detalhesInconformidade += `• Foco detetado e não remediado<br>`;
            detalhesInconformidade += `</div>`;
        }

        const popupHTML = `
            <div style="font-family: 'Inter', sans-serif; min-width: 190px;">
                <h6 style="margin: 0 0 6px 0; color: #cc0000; font-weight: 700; font-size:13px;">${unidade.nome}</h6>
                <hr style="margin: 4px 0;">
                <p style="margin: 2px 0; font-size: 11px;"><b>Vistoria Realizada:</b> ${unidade.vistoriaRealizada ? 'Sim' : 'Não'}</p>
                <p style="margin: 2px 0; font-size: 11px;"><b>Focos Identificados:</b> ${unidade.focos}</p>
                <p style="margin: 2px 0; font-size: 11px;"><b>Focos Remediados:</b> ${unidade.remediados}</p>
                ${statusBadge}
                ${detalhesInconformidade}
            </div>
        `;

        L.marker([lat, lng], { icon: criarIcone(corPin) })
            .addTo(mapaAedes)
            .bindPopup(popupHTML);

        pinsAdicionados++;
    });

    if (document.getElementById("total-pins-mapa")) {
        document.getElementById("total-pins-mapa").innerText = `${pinsAdicionados} Unidades`;
    }
}

async function carregarNovoDashboard() {
    try {
        // 1. Obter base de dados bruta unificada
        const response = await fetch(`${API_BASE}/api/aedes/painel-dados`);
        if (!response.ok) throw new Error("Erro na rede ao carregar /painel-dados");
        const vistorias_raw = await response.json();

        if (!vistorias_raw || vistorias_raw.length === 0) {
            console.warn("⚠️ Nenhuma vistoria retornada pelo servidor.");
            return;
        }

        // 2. Determinar a "Semana Vigente"
        const datasOrdenadas = vistorias_raw
            .map(v => v.data_registro ? new Date(v.data_registro) : null)
            .filter(d => d !== null)
            .sort((a, b) => b - a);
        if (datasOrdenadas.length === 0) return;

        const ultimaData = datasOrdenadas[0];
        
        const fimSemanaVigente = new Date(ultimaData);
        const inicioSemanaVigente = new Date(ultimaData);
        inicioSemanaVigente.setDate(inicioSemanaVigente.getDate() - 7);

        console.log(`📅 Analisando a semana de: ${inicioSemanaVigente.toLocaleDateString()} a ${fimSemanaVigente.toLocaleDateString()}`);

        // 3. Processar Métricas Gerais (KPIs Totais Acumulados)
        let totalRegistros = vistorias_raw.length;
        let totalVistorias = vistorias_raw.filter(v => v.visitada === 1).length;
        let totalFocos = vistorias_raw.filter(v => v.foco_encontrado === 1).length;
        let totalRemediados = vistorias_raw.filter(v => v.foco_remediado === 1).length;

        if (document.getElementById("kpi-total-registros")) document.getElementById("kpi-total-registros").innerText = totalRegistros.toLocaleString();
        if (document.getElementById("kpi-total-vistorias")) document.getElementById("kpi-total-vistorias").innerText = totalVistorias.toLocaleString();
        if (document.getElementById("kpi-total-focos")) document.getElementById("kpi-total-focos").innerText = totalFocos.toLocaleString();
        if (document.getElementById("kpi-total-remediados")) document.getElementById("kpi-total-remediados").innerText = totalRemediados.toLocaleString();

        // 4. Processar Unidades e avaliar a Conformidade na Semana Vigente
        const mapaUnidades = {};
        vistorias_raw.forEach(v => {
            const nomeUnidade = v.Unidade || "Desconhecida";
            if (!mapaUnidades[nomeUnidade]) {
                mapaUnidades[nomeUnidade] = {
                    nome: nomeUnidade,
                    vistoriasSemana: [],
                    historicoGeral: []
                };
            }
            mapaUnidades[nomeUnidade].historicoGeral.push(v);

            const dataReg = v.data_registro ? new Date(v.data_registro) : null;
            if (dataReg && dataReg >= inicioSemanaVigente && dataReg <= fimSemanaVigente) {
                mapaUnidades[nomeUnidade].vistoriasSemana.push(v);
            }
        });

        // Mapeamos o estado final de cada unidade
        const listaUnidadesEstatísticas = Object.values(mapaUnidades).map(unidade => {
            const dadosSemana = unidade.vistoriasSemana.length > 0 ? unidade.vistoriasSemana : [unidade.historicoGeral[0]];
            const vistoriaRealizada = dadosSemana.some(d => d.visitada === 1);
            
            const focos = dadosSemana.filter(d => d.foco_encontrado === 1).length;
            const remediados = dadosSemana.filter(d => d.foco_remediado === 1).length;
            const focoAtivoPendente = focos > remediados;

            // REGRA DE OURO DA CONFORMIDADE:
            const conforme = vistoriaRealizada && !focoAtivoPendente;

            // Mapeamentos históricos para o ranking
            const totalRegistrosHist = unidade.historicoGeral.length;
            const totalVistoriasHist = unidade.historicoGeral.filter(h => h.visitada === 1).length;

            return {
                nome: unidade.nome,
                vistoriaRealizada,
                focos,
                remediados,
                focoAtivoPendente,
                conforme,
                totalVistoriasHist,
                totalRegistrosHist
            };
        });

        // 5. Inicializar o Mapa com Pins e Conformidades Reais
        renderizarMapa(listaUnidadesEstatísticas);

        // 6. CORREÇÃO DO RANKING LATERAL (Ordenado da unidade com mais vistorias para a que tem menos)
        const containerRanking = document.getElementById("ranking-unidades-container");
        if (containerRanking && listaUnidadesEstatísticas.length > 0) {
            
            // Realiza a ordenação decrescente de vistorias absolutas
            const rankingOrdenado = [...listaUnidadesEstatísticas].sort((a, b) => b.totalVistoriasHist - a.totalVistoriasHist);

            containerRanking.innerHTML = rankingOrdenado.map((unidade, index) => {
                const pctEficiencia = unidade.totalRegistrosHist > 0 
                    ? Math.round((unidade.totalVistoriasHist / unidade.totalRegistrosHist) * 100) 
                    : 0;
                    
                let corBarra = '#ef4444'; 
                if (pctEficiencia >= 80) corBarra = '#16a34a'; 
                else if (pctEficiencia >= 50) corBarra = '#f59e0b'; 

                return `
                    <div style="background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #f1f5f9; margin-bottom: 8px;">
                        <div style="display: flex; justify-content: space-between; font-size: 0.85rem; font-weight: 600; color: #1e293b; margin-bottom: 6px;">
                            <span>#${index + 1} ${unidade.nome}</span>
                            <span style="color: var(--text-muted); font-size: 0.75rem; font-weight: normal;">
                                ${unidade.totalVistoriasHist} vist. de ${unidade.totalRegistrosHist}
                            </span>
                            <span style="color: ${corBarra}; font-weight: 700;">${pctEficiencia}%</span>
                        </div>
                        <div style="width: 100%; height: 8px; background: #e2e8f0; border-radius: 4px; overflow: hidden;">
                            <div style="width: ${pctEficiencia}%; height: 100%; background-color: ${corBarra}; transition: width 0.5s ease-in-out;"></div>
                        </div>
                    </div>
                `;
            }).join('');
        }

        // 7. Processar Impedimentos de Vistoria (Gráfico de Pizza para Opções Fechadas e Tabela para Textos Escritos)
        let motivosVistoriaAgrupados = {};
        let listaVistoriasTexto = [];
        
        const coresVistoria = ['#3b82f6', '#ef4444', '#f59e0b', '#10b981', '#64748b', '#8b5cf6'];

        vistorias_raw.forEach(v => {
            let motivos = [];
            if (v.motivos_nao_vistoria) {
                try {
                    motivos = typeof v.motivos_nao_vistoria === 'string' 
                        ? JSON.parse(v.motivos_nao_vistoria) 
                        : v.motivos_nao_vistoria;
                } catch(e) {
                    motivos = [v.motivos_nao_vistoria];
                }
            }

            if (!Array.isArray(motivos)) motivos = [motivos];

            motivos.forEach(mot => {
                if (mot) {
                    // Se o texto for longo ou tiver traços, categoriza como escrita individual para a tabela
                    if (mot.length > 28 || mot.includes('-') || mot.includes(';')) {
                        listaVistoriasTexto.push(`<tr><td>• <b>Unidade ${v.Unidade || 'Não Especificada'}:</b> ${mot} <span class="badge bg-light text-dark float-end">Escrita</span></td></tr>`);
                        motivosVistoriaAgrupados['Especificações Individuais'] = (motivosVistoriaAgrupados['Especificações Individuais'] || 0) + 1;
                    } else {
                        // Se for uma opção curta/fechada do checkbox
                        const cat = agruparTermosAedes(mot);
                        motivosVistoriaAgrupados[cat] = (motivosVistoriaAgrupados[cat] || 0) + 1;
                    }
                }
            });
        });

        // Renderizar Gráficos e Legendas Dinâmicas de Vistoria
        const canvasVistoria = document.getElementById("graficoMotivosVistoria");
        if (canvasVistoria && Object.keys(motivosVistoriaAgrupados).length > 0) {
            const labels = Object.keys(motivosVistoriaAgrupados);
            const dados = Object.values(motivosVistoriaAgrupados);

            new Chart(canvasVistoria.getContext('2d'), {
                type: 'doughnut',
                data: {
                    labels: labels,
                    datasets: [{ data: dados, backgroundColor: coresVistoria.slice(0, labels.length) }]
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
            });

            // Geração de legenda com a cor correspondente à fatia
            const elLegenda = document.getElementById("legenda-vistoria-compacta");
            if (elLegenda) {
                elLegenda.innerHTML = labels.map((lbl, idx) => {
                    const cor = coresVistoria[idx % coresVistoria.length];
                    return `<div style="font-size: 0.8rem; margin-bottom: 4px;"><i class="fa-solid fa-circle me-1" style="color: ${cor};"></i> <b>${dados[idx]}</b> - ${lbl}</div>`;
                }).join('');
            }
        }

        const elTabela = document.getElementById("tabela-textos-vistoria");
        if (elTabela) {
            elTabela.innerHTML = listaVistoriasTexto.length > 0 
                ? `<table class="table table-sm table-borderless mb-0">${listaVistoriasTexto.slice(0, 40).join('')}</table>` 
                : '<div class="text-muted small text-center py-2">Nenhuma observação escrita registrada nesta categoria.</div>';
        }

        // 8. Processar Impedimentos de Não-Remediação (Gráfico de Pizza e Tabela)
        let motivosRemediacaoAgrupados = {};
        let listaRemediacaoTexto = [];
        const coresRemediacao = ['#8b5cf6', '#ec4899', '#f59e0b', '#64748b', '#ef4444'];

        vistorias_raw.forEach(v => {
            if (v.foco_encontrado === 1 && v.foco_remediado === 0) {
                let obs = v.observacoes || "";
                if (obs) {
                    if (obs.length > 28 || obs.includes('-')) {
                        listaRemediacaoTexto.push(`<tr><td>• <b>Unidade ${v.Unidade || 'N/A'}:</b> ${obs} <span class="badge bg-light text-dark float-end">Escrita</span></td></tr>`);
                        motivosRemediacaoAgrupados['Especificações Individuais'] = (motivosRemediacaoAgrupados['Especificações Individuais'] || 0) + 1;
                    } else {
                        const cat = agruparTermosAedes(obs);
                        motivosRemediacaoAgrupados[cat] = (motivosRemediacaoAgrupados[cat] || 0) + 1;
                    }
                } else {
                    motivosRemediacaoAgrupados['Pendente de Ação'] = (motivosRemediacaoAgrupados['Pendente de Ação'] || 0) + 1;
                }
            }
        });

        if (Object.keys(motivosRemediacaoAgrupados).length === 0) {
            motivosRemediacaoAgrupados['Tudo Remediado'] = totalRemediados;
        }

        const canvasRemediacao = document.getElementById("graficoMotivosRemediacao");
        if (canvasRemediacao) {
            const labelsRem = Object.keys(motivosRemediacaoAgrupados);
            const dadosRem = Object.values(motivosRemediacaoAgrupados);

            new Chart(canvasRemediacao.getContext('2d'), {
                type: 'doughnut',
                data: {
                    labels: labelsRem,
                    datasets: [{ data: dadosRem, backgroundColor: coresRemediacao.slice(0, labelsRem.length) }]
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
            });

            const elLegendaRem = document.getElementById("legenda-remediacao-compacta");
            if (elLegendaRem) {
                elLegendaRem.innerHTML = labelsRem.map((lbl, idx) => {
                    const cor = coresRemediacao[idx % coresRemediacao.length];
                    return `<div style="font-size: 0.8rem; margin-bottom: 4px;"><i class="fa-solid fa-circle me-1" style="color: ${cor};"></i> <b>${dadosRem[idx]}</b> - ${lbl}</div>`;
                }).join('');
            }
        }

        const elTabelaRem = document.getElementById("tabela-textos-remediacao");
        if (elTabelaRem) {
            elTabelaRem.innerHTML = listaRemediacaoTexto.length > 0 
                ? `<table class="table table-sm table-borderless mb-0">${listaRemediacaoTexto.slice(0, 40).join('')}</table>` 
                : '<div class="text-muted small text-center py-2">Nenhuma observação escrita ativa. Todos os focos resolvidos na rotina.</div>';
        }

    } catch (err) {
        console.error("❌ Falha crítica ao processar e renderizar dashboard:", err);
    }
}

document.addEventListener("DOMContentLoaded", carregarNovoDashboard);