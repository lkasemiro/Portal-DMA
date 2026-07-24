/**
 * ==========================================================================
 * RECICLA CEDAE FASE 2 - MOTOR DE CRÉDITOS, RANKINGS E DASHBOARDS R
 * Coordenação de Resíduos Sólidos · CEDAE · CRS 2026
 * ==========================================================================
 */

const state = { registros: [], kpis: {}, dadosReciclados: null };
const BR_NUMBER = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });
const BR_INTEGER = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

const PREMIOS = [
  { premio_id: "broche", nome: "Broche", custo_pontos: 10, estoque_inicial: 80, ativo: true },
  { premio_id: "copo", nome: "Copo", custo_pontos: 20, estoque_inicial: 45, ativo: true },
  { premio_id: "mochila", nome: "Mochila", custo_pontos: 100, estoque_inicial: 12, ativo: true },
  { premio_id: "composto", nome: "Composto orgânico", custo_pontos: 0, estoque_inicial: 200, ativo: true }
];

const CORES_GRAFICO = { Metal: "#2ec4b6", Papel: "#e67e22", Plastico: "#4361ee", Vidro: "#ff006e" };

const els = {
  fase2DbStatus: document.getElementById("fase2DbStatus"),
  publicKpiParticipantes: document.getElementById("publicKpiParticipantes"),
  publicKpiPesoTotal: document.getElementById("publicKpiPesoTotal"),
  awardCatalog: document.getElementById("awardCatalog"),
  historicTop5Body: document.getElementById("historicTop5Body"),
  historicTop5Count: document.getElementById("historicTop5Count"),
  historicTop5Highlight: document.getElementById("historicTop5Highlight"),
  consultaForm: document.getElementById("consultaForm"),
  consultaId: document.getElementById("consultaId"),
  consultaResultado: document.getElementById("consultaResultado"),
  grafico2024: document.getElementById("graficoRadial2024"),
  grafico2025: document.getElementById("graficoRadial2025")
};

function formatNumber(value) { return BR_NUMBER.format(Number(value || 0)); }
function formatInteger(value) { return BR_INTEGER.format(Number(value || 0)); }
function escapeHtml(t) { return String(t??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;"); }

function extractRecords(json) {
  if (!json) return [];
  if (Array.isArray(json)) return json;
  if (Array.isArray(json.registros)) return json.registros;
  return [];
}

// Agrupa as pesagens individuais por participante para gerar o Ranking e os KPIs globais
function processarRegistrosDoConsolidado(dados) {
  let agrupado = {};
  
  dados.forEach(item => {
    const id = String(item.n_id || item.id);
    const diretoria = String(item.diretoria || "DMA / CRS");
    const quantidade = Number(item.Quantidade || 0);
    
    if (!agrupado[id]) {
      agrupado[id] = { n_id: id, diretoria: diretoria, somatorio: 0 };
    }
    agrupado[id].somatorio += quantidade;
  });
  
  return Object.values(agrupado);
}

function extractKpis(regs, dadosBrutos) {
  const totalPeso = dadosBrutos.reduce((a, b) => a + Number(b.Quantidade || 0), 0);
  return { total_participantes: regs.length, somatorio_total: totalPeso };
}

function renderAwardCatalog() {
  if (!els.awardCatalog) return;
  els.awardCatalog.innerHTML = PREMIOS.filter(p => p.ativo).map(p => `
    <div style="padding: 12px; background: rgba(0,0,0,0.01); border-radius: 8px; border: 1px solid #e2e8f0; display: flex; gap: 12px; align-items: center;">
      <div style="background: rgba(0, 86, 179, 0.08); color: var(--azul-cedae); width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1rem; flex-shrink: 0;">
        <i class="fa-solid ${p.premio_id === 'composto' ? 'fa-seedling' : 'fa-award'}"></i>
      </div>
      <div>
        <strong style="color: var(--azul-escuro); display: block; font-size: 0.85rem;">${escapeHtml(p.nome)}</strong>
        <span style="font-size: 0.72rem; color: var(--verde-sustentavel); font-weight: 700;">
          Requisito: ${p.premio_id === "composto" ? "10 kg = 1 pacote" : `${formatInteger(p.custo_pontos)} pontos`}
        </span>
      </div>
    </div>
  `).join("");
}

function renderKpis() {
  if (els.publicKpiParticipantes) els.publicKpiParticipantes.textContent = formatInteger(state.kpis.total_participantes ?? 0);
  if (els.publicKpiPesoTotal) els.publicKpiPesoTotal.textContent = `${formatNumber(state.kpis.somatorio_total ?? 0)} kg`;
}

function renderHistoricTop5() {
  if (!els.historicTop5Body || !state.dadosDiretorias) return;
  
  // 1. Ordena as diretorias pelo maior peso total coletado
  const rankingDiretorias = [...state.dadosDiretorias]
    .sort((a, b) => b.pesoTotal - a.pesoTotal);
  
  // Pega o maior peso para servir de base (100%) para a barra de progresso visual
  const maxPesoElemento = rankingDiretorias[0]?.pesoTotal || 1;

  // 2. Renderiza as linhas focando em Diretoria, Qtd de Pessoas e Peso
  els.historicTop5Body.innerHTML = rankingDiretorias.map((dir, idx) => {
    let posicao = idx + 1;
    let medalhaOuPosicao = posicao === 1 ? "🥇" : posicao === 2 ? "🥈" : posicao === 3 ? "🥉" : `${posicao}º`;
    
    // Calcula a porcentagem da barra de preenchimento proporcional
    let pctBarra = (dir.pesoTotal / maxPesoElemento) * 100;

    return `
      <tr>
        <td style="font-weight: 800; text-align: center; font-size: 1.1rem; width: 50px;">${medalhaOuPosicao}</td>
        <td style="vertical-align: middle;">
          <div style="font-weight: 800; color: #0f172a; font-size: 0.9rem; letter-spacing: 0.5px;">
            DIRETORIA ${escapeHtml(dir.diretoria)}
          </div>
          <div style="width: 100%; background: #f1f5f9; height: 6px; border-radius: 3px; margin-top: 6px; overflow: hidden;">
            <div style="width: ${pctBarra}%; background: var(--azul-cedae); height: 100%; border-radius: 3px; transition: width 0.5s ease;"></div>
          </div>
        </td>
        <td style="vertical-align: middle; text-align: center;">
          <span style="background: rgba(15, 23, 42, 0.06); color: #334155; font-size: 0.72rem; font-weight: 700; padding: 4px 10px; border-radius: 12px; display: inline-block;">
            <i class="fa-solid fa-users" style="font-size:0.65rem; margin-right:4px;"></i> ${dir.totalParticipantes} ${dir.totalParticipantes === 1 ? 'colaborador' : 'colaboradores'}
          </span>
        </td>
        <td style="text-align: right; font-weight: 800; color: var(--verde-sustentavel); font-size: 0.95rem; vertical-align: middle;">
          ${formatNumber(dir.pesoTotal)} kg
        </td>
      </tr>
    `;
  }).join("");

  // 3. Atualiza os cabeçalhos e destaques textuais superiores do bloco
  if (els.historicTop5Count) {
    els.historicTop5Count.textContent = `${state.dadosDiretorias.length} diretorias disputando`;
  }
  
  if (els.historicTop5Highlight && rankingDiretorias[0]) {
    els.historicTop5Highlight.innerHTML = `
      <i class="fa-solid fa-chart-line" style="color: #0284c7; margin-right: 4px;"></i> 
      <strong>Gincana Interna:</strong> A <strong>DIRETORIA ${escapeHtml(rankingDiretorias[0].diretoria)}</strong> 
      <span style="color: #64748b;">lidera o engajamento institucional com uma força operacional de</span> 
      <strong>${rankingDiretorias[0].totalParticipantes} pessoas</strong>!
      `;
  }
}



function bindConsulta() {
  if (!els.consultaForm) return;
  els.consultaForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const id = String(els.consultaId?.value || "").trim();
    const part = state.registros.find(r => String(r.n_id) === id);
    
    if (!els.consultaResultado) return;
    if (!part) {
      els.consultaResultado.innerHTML = `<div style="background: rgba(239, 68, 68, 0.08); border: 1px solid #ef4444; border-radius: 8px; padding: 14px; color: #ef4444; font-size: 0.8rem; text-align: center;"><strong>ID não localizado!</strong> Verifique os dados ou contate a CRS.</div>`;
      return;
    }
    
    els.consultaResultado.innerHTML = `
      <div style="background: rgba(255,255,255,0.15); border: 1px solid var(--verde-sustentavel); border-radius: 8px; padding: 14px; color: #fff;">
        <strong style="font-size: 0.95rem; color: var(--verde-sustentavel); display:block; margin-bottom:8px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:4px;">ID Homologado: ${escapeHtml(part.n_id)}</strong>
        <p style="margin: 4px 0; font-size: 0.8rem;"><strong>Lotação:</strong> ${escapeHtml(part.diretoria)}</p>
        <div style="margin-top: 10px; display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 0.85rem;">Volume Acumulado:</span>
          <strong style="font-size: 1.2rem; color: var(--verde-sustentavel);">${formatNumber(part.somatorio)} kg</strong>
        </div>
      </div>`;
  });
}

function prepararDadosOrigemR(dados, sufixoAno) {
  // Inicializa o acumulador zerado para os 4 materiais da CRS
  let totaisMaterial = { Papel: 0, Plastico: 0, Metal: 0, Vidro: 0 };
  let totalAno = 0;

  dados.forEach(r => {
    const dataCamp = String(r.Data || "");
    const matCamp = String(r.Material || "Papel");
    const qtdCamp = Number(r.Quantidade || 0);

    // Filtra pelo sufixo do ano correspondente (ex: "24" ou "25")
    if (dataCamp.endsWith(sufixoAno)) {
      if (/papel/i.test(matCamp)) totaisMaterial.Papel += qtdCamp;
      else if (/plastico|pl[aá]stico/i.test(matCamp)) totaisMaterial.Plastico += qtdCamp;
      else if (/metal/i.test(matCamp)) totaisMaterial.Metal += qtdCamp;
      else if (/vidro/i.test(matCamp)) totaisMaterial.Vidro += qtdCamp;
      
      totalAno += qtdCamp;
    }
  });

  // Lista fixa de materiais ( corrigido para 'categorias' )
  const categorias = ['Papel', 'Plastico', 'Metal', 'Vidro'];
  
  // Calcula as porcentagens com base no total do respectivo ano
  let porcentagensRelativas = categorias.map(mat => {
    if (totalAno === 0) return 0;
    return (totaisMaterial[mat] / totalAno) * 100;
  });

  // CORRIGIDO: alterado de categories.map para categorias.map
  let valoresReais = categorias.map(mat => totaisMaterial[mat]);

  return {
    porcentagensRelativas: porcentagensRelativas, // Tamanho visual do arco (%)
    valoresReais: valoresReais,                   // Valor real em kg
    labels: categorias,                           // Apenas os 4 materiais fixos
    totalAno: totalAno
  };
}

function renderCharts() {
  if (!els.grafico2024 || !els.grafico2025 || !state.dadosReciclados) return;
  els.grafico2024.innerHTML = ""; els.grafico2025.innerHTML = "";

  const dataset2024 = prepararDadosOrigemR(state.dadosReciclados, "24");
  const dataset2025 = prepararDadosOrigemR(state.dadosReciclados, "25");

  const obterBlueprintR = (dataset, tituloAno) => {
    return {
      chart: { type: 'radialBar', height: 350 },
      colors: [CORES_GRAFICO.Papel, CORES_GRAFICO.Plastico, CORES_GRAFICO.Metal, CORES_GRAFICO.Vidro],
      series: dataset.porcentagensRelativas, 
      labels: dataset.labels, 
      plotOptions: {
        radialBar: {
          // Diminui o buraco central de 50% para 20%, aproximando os arcos do centro
          hollow: { size: '20%' },
          track: {
            background: 'rgba(0, 0, 0, 0.04)',
            strokeWidth: '100%', // Usa a espessura máxima disponível para cada arco
            margin: 2            // Reduz a distância de 4px para apenas 2px entre as pistas
          },
          dataLabels: {
            name: { show: true, fontSize: '13px', fontWeight: 700, color: '#0f172a' },
            value: {
              fontSize: '12px',
              color: '#475569',
              formatter: (val, opts) => {
                const idx = opts.seriesIndex;
                const kgMat = dataset.valoresReais[idx] || 0;
                return `${formatNumber(kgMat)} kg (${formatNumber(val)}%)`;
              }
            },
            total: {
              show: true,
              label: `TOTAL ${tituloAno}`,
              color: '#1d3557',
              fontSize: '13px',
              fontWeight: 800,
              formatter: () => `${formatNumber(dataset.totalAno)} kg`
            }
          }
        }
      },
      legend: { show: false }
    };
  };

  if (dataset2024.totalAno > 0) {
    new ApexCharts(els.grafico2024, obterBlueprintR(dataset2024, "2024")).render();
  } else {
    els.grafico2024.innerHTML = "<div style='text-align:center; padding:40px; color:#64748b;'>Sem registros em 2024</div>";
  }

  if (dataset2025.totalAno > 0) {
    new ApexCharts(els.grafico2025, obterBlueprintR(dataset2025, "2025")).render();
  } else {
    els.grafico2025.innerHTML = "<div style='text-align:center; padding:40px; color:#64748b;'>Sem registros em 2025</div>";
  }

  adicionarCaptionEstilizado();
}
function adicionarCaptionEstilizado() {
  const containerId = "dashboardInsightCaption";
  let capEl = document.getElementById(containerId);
  if (!capEl && els.grafico2024) {
    capEl = document.createElement("div");
    capEl.id = containerId;
    capEl.style.cssText = "margin-top: 24px; padding: 16px; background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 8px; width: 100%; grid-column: span 2;";
    const gridGraficos = els.grafico2024.parentElement;
    gridGraficos.appendChild(capEl);
  }
  
  if(capEl) {
    capEl.innerHTML = `
      <h5 style="margin: 0 0 4px 0; color: #1d3557; font-size: 0.9rem; font-weight: 700;">📊 EVOLUÇÃO HISTÓRICA DA COLETA SELETIVA</h5>
      <p style="margin: 0; font-size: 0.75rem; color: #4a4e69; font-style: italic; font-weight: 600;">Análise comparativa da composição de materiais reciclados (Período 2024 - 2025)</p>
      <div style="margin-top: 8px; padding-top: 8px; border-top: 1px dashed #cbd5e1; font-size: 0.75rem; color: #1d3557; font-weight: 700; line-height: 1.3;">
        💡 INSIGHT CHAVE: Em 2024, a operação era sustentada quase exclusivamente por Papel. Já em 2025, nota-se um amadurecimento 
        relevante da diversidade da coleta a partir de agosto, marcado pela entrada massiva de Vidro e Plástico nas métricas.
      </div>
    `;
  }
}
function processarRegistrosDoConsolidado(dados) {
  let agrupadoParticipantes = {};
  let agrupadoDiretorias = {};
  
  dados.forEach(item => {
    const id = String(item.n_id || item.id || "");
    if (!id) return;

    // Normaliza a diretoria (ex: "DFI", "DSG")
    const diretoria = String(item.diretoria || "DMA / CRS").toUpperCase().trim();
    const quantidade = Number(item.Quantidade || 0);
    const nome = item["Nome do Participante:"] || item.nome || `Participante ${id}`;
    
    // 1. Agrupamento por Participante (Para uso na busca de crachá se necessário)
    if (!agrupadoParticipantes[id]) {
      agrupadoParticipantes[id] = { n_id: id, nome: nome, diretoria: diretoria, somatorio: 0 };
    }
    agrupadoParticipantes[id].somatorio += quantidade;

    // 2. Agrupamento por Diretoria (Métrica Solicitada)
    if (!agrupadoDiretorias[diretoria]) {
      agrupadoDiretorias[diretoria] = {
        nomeDiretoria: diretoria,
        pesoTotal: 0,
        participantesUnicos: new Set() // Armazena IDs únicos para contar o tamanho da equipe
      };
    }
    agrupadoDiretorias[diretoria].pesoTotal += quantidade;
    agrupadoDiretorias[diretoria].participantesUnicos.add(id);
  });
  
  // Guardamos a lista de diretorias processada no state para o render do ranking usar
  state.dadosDiretorias = Object.values(agrupadoDiretorias).map(d => ({
    diretoria: d.nomeDiretoria,
    pesoTotal: d.pesoTotal,
    totalParticipantes: d.participantesUnicos.size
  }));

  return Object.values(agrupadoParticipantes);
}
async function loadData() {
  try {
    // Executa as duas requisições em paralelo para máxima performance
    const [resConsolidado, resPesagens] = await Promise.all([
      fetch("data/dados_reciclados.json"),
      fetch("data/dados_pesagens.json")
    ]);

    if (!resConsolidado.ok) throw new Error("Falha ao ler dados_reciclados.json");
    if (!resPesagens.ok) throw new Error("Falha ao ler pesagens.json");

    // 1. Carrega os dados históricos para os Gráficos Radiais do R
    const jsonConsolidado = extractRecords(await resConsolidado.json());
    state.dadosReciclados = jsonConsolidado;

    // 2. Carrega as pesagens individuais para os Rankings e KPIs de engajamento
    const jsonPesagens = extractRecords(await resPesagens.json());
    
    // Processa os participantes e pesos agregados com base no arquivo de pesagens
    state.registros = processarRegistrosDoConsolidado(jsonPesagens);
    state.kpis = extractKpis(state.registros, jsonPesagens);

    // Feedback de sucesso na tela
    if (els.fase2DbStatus) {
      els.fase2DbStatus.innerHTML = `<i class="fa-solid fa-circle-check"></i> Sincronismo estável (Múltiplas Fontes) · CRS 2026`;
    }
    
    // Dispara as renderizações isoladas por contexto de dados
    renderKpis(); 
    renderAwardCatalog(); 
    renderHistoricTop5(); 
    renderCharts(); // Renderiza os gráficos usando state.dadosReciclados
  } catch (err) {
    if (els.fase2DbStatus) {
      els.fase2DbStatus.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="color:#ef4444;"></i> Erro de Sincronismo: ${err.message}`;
    }
    console.error(err);
  }
}

document.addEventListener("DOMContentLoaded", () => { loadData(); bindConsulta(); });