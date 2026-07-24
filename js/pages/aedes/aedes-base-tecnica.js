const AEDES_BASE_API_TIMEOUT_MS = 90000;
const DASH_VALUE = "-";

const VIRTUAL_ROW_HEIGHT = 52;
const VIRTUAL_BUFFER_ROWS = 18;

const state = {
  apiBatchSummaries: [],
  apiBatchDetails: new Map(),
  apiRows: [],
  filteredRows: [],
  charts: {
    conformidade: null,
    locaisFoco: null,
    motivosNaoVistoria: null
  },
  virtual: {
    startIndex: 0,
    endIndex: 0
  }
};

const els = {
  summaryTotalRegistros: document.getElementById("summaryTotalRegistros"),
  summaryFocaisComEnvio: document.getElementById("summaryFocaisComEnvio"),
  summaryLotesRecebidos: document.getElementById("summaryLotesRecebidos"),
  summaryVistoriasRealizadas: document.getElementById("summaryVistoriasRealizadas"),
  summaryFocosEncontrados: document.getElementById("summaryFocosEncontrados"),

  btnAtualizarBaseTecnica: document.getElementById("btnAtualizarBaseTecnica"),
  btnExportarBaseCsv: document.getElementById("btnExportarBaseCsv"),
  btnExportarBaseJson: document.getElementById("btnExportarBaseJson"),

  filterBuscaGeral: document.getElementById("filterBuscaGeral"),
  filterAno: document.getElementById("filterAno"),
  filterSemana: document.getElementById("filterSemana"),
  filterFocal: document.getElementById("filterFocal"),
  filterUnidade: document.getElementById("filterUnidade"),
  filterMunicipio: document.getElementById("filterMunicipio"),
  filterVistoria: document.getElementById("filterVistoria"),
  filterFoco: document.getElementById("filterFoco"),
  filterRemediacao: document.getElementById("filterRemediacao"),

  btnAplicarFiltrosBase: document.getElementById("btnAplicarFiltrosBase"),
  btnLimparFiltrosBase: document.getElementById("btnLimparFiltrosBase"),

  baseTableCount: document.getElementById("baseTableCount"),
  baseTecnicaTableBody: document.getElementById("baseTecnicaTableBody"),
  basePaginationInfo: document.getElementById("basePaginationInfo"),

  baseVirtualViewport: document.getElementById("baseVirtualViewport"),
  baseVirtualSpacer: document.getElementById("baseVirtualSpacer"),

  tabTabela: document.getElementById("tabTabela"),
  tabIndicadores: document.getElementById("tabIndicadores"),
  painelIndicadores: document.getElementById("painelIndicadores"),
  tabelaCard: document.querySelector(".base-table-card"),

  chartConformidade: document.getElementById("chartConformidade"),
  chartLocaisFoco: document.getElementById("chartLocaisFoco"),
  chartMotivosNaoVistoria: document.getElementById("chartMotivosNaoVistoria"),

  summaryTotalRegistrosIndicadores: document.getElementById("summaryTotalRegistrosIndicadores"),
  indicatorConformes: document.getElementById("indicatorConformes"),
  indicatorNaoConformes: document.getElementById("indicatorNaoConformes"),
  indicatorLocaisFocoTotal: document.getElementById("indicatorLocaisFocoTotal"),
  indicatorMotivosNaoVistoriaTotal: document.getElementById("indicatorMotivosNaoVistoriaTotal"),


};

/* =========================================================
   HELPERS
========================================================= */

function formatNumber(value) {
  return new Intl.NumberFormat("pt-BR").format(Number(value || 0));
}

function formatDateTime(value) {
  if (!value) return DASH_VALUE;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(date);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeTrim(value) {
  return String(value || "").trim();
}

function normalizeText(value) {
  return safeTrim(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function normalizeStatus(value) {
  const v = normalizeText(value);

  if (!v) return "nao_informado";
  if (v === DASH_VALUE) return "na";
  if (["na", "n/a", "nao aplicavel", "não aplicável"].includes(v)) return "na";

  if (["sim", "s", "true", "1", "x", "realizada", "remediado"].includes(v)) {
    return "sim";
  }

  if (
    ["nao", "não", "n", "false", "0", "nao realizada", "não realizada", "nao remediado", "não remediado"].includes(v)
  ) {
    return "nao";
  }

  return "nao_informado";
}

function normalizeSummaryArray(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") return safeTrim(item);

        if (item && typeof item === "object") {
          if (item.label && item.detalhe) {
            return `${safeTrim(item.label)}: ${safeTrim(item.detalhe)}`;
          }
          if (item.label) return safeTrim(item.label);
          if (item.tipo) return safeTrim(item.tipo);
        }

        return "";
      })
      .filter(Boolean)
      .filter((item) => item !== DASH_VALUE);
  }

  if (typeof value === "string") {
    const text = safeTrim(value);
    if (!text || text === DASH_VALUE) return [];

    return text
      .split(/[;,]/)
      .map((item) => safeTrim(item))
      .filter(Boolean)
      .filter((item) => item !== DASH_VALUE);
  }

  return [];
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))]
    .sort((a, b) => String(a).localeCompare(String(b), "pt-BR"));
}

function csvEscape(value) {
  const str = String(value ?? "");
  if (/[",;\n]/.test(str)) {
    return `"${str.replaceAll('"', '""')}"`;
  }
  return str;
}

function buildCsv(rows) {
  if (!rows.length) return "";

  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(";"),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(";"))
  ];

  return lines.join("\n");
}

function downloadTextFile(filename, content, mime = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}

function downloadJson(filename, data) {
  downloadTextFile(
    filename,
    JSON.stringify(data, null, 2),
    "application/json;charset=utf-8"
  );
}

function getStatusPillClass(value) {
  const normalized = normalizeStatus(value);

  if (normalized === "sim") return "status-pill status-pill--success";
  if (normalized === "nao") return "status-pill status-pill--danger";
  return "status-pill status-pill--muted";
}

function readSelectValue(el) {
  return el ? String(el.value || "") : "";
}

function getActiveRows() {
  return state.filteredRows.length || hasAnyFilterApplied()
    ? state.filteredRows
    : state.apiRows;
}

function hasAnyFilterApplied() {
  return [
    els.filterBuscaGeral?.value,
    els.filterAno?.value,
    els.filterSemana?.value,
    els.filterFocal?.value,
    els.filterUnidade?.value,
    els.filterMunicipio?.value,
    els.filterVistoria?.value,
    els.filterFoco?.value,
    els.filterRemediacao?.value
  ].some((value) => safeTrim(value).length > 0);
}

function isConforme(row) {
  return (
    normalizeStatus(row.vistoria_realizada) === "sim" &&
    normalizeStatus(row.foco_encontrado) === "nao"
  );
}

function isNaoConforme(row) {
  return (
    normalizeStatus(row.vistoria_realizada) === "nao" ||
    normalizeStatus(row.foco_encontrado) === "sim" ||
    normalizeStatus(row.foco_remediado) === "nao"
  );
}

function normalizeDisplayValue(value) {
  const text = safeTrim(value);
  return text || DASH_VALUE;
}

function aggregateTextField(rows, fieldName) {
  const counter = new Map();

  rows.forEach((row) => {
    const values = normalizeSummaryArray(row[fieldName]);
    values.forEach((value) => {
      counter.set(value, (counter.get(value) || 0) + 1);
    });
  });

  return [...counter.entries()]
    .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]), "pt-BR"));
}

function destroyChart(instance) {
  if (instance && typeof instance.destroy === "function") {
    instance.destroy();
  }
}

function buildChart(canvas, type, labels, data, label) {
  if (!canvas || typeof Chart === "undefined") return null;

  return new Chart(canvas, {
    type,
    data: {
      labels,
      datasets: [
        {
          label,
          data
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom"
        }
      },
      scales: type === "bar"
        ? {
            y: {
              beginAtZero: true,
              ticks: {
                precision: 0
              }
            }
          }
        : undefined
    }
  });
}

/* =========================================================
   API
========================================================= */

async function apiFetch(path, options = {}) {
  if (
    !window.AEDES_API_BASE_URL ||
    String(window.AEDES_API_BASE_URL).includes("seu-servico.onrender.com")
  ) {
    throw new Error("A API do sistema não está configurada corretamente.");
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), AEDES_BASE_API_TIMEOUT_MS);

  try {
    const response = await fetch(`${window.AEDES_API_BASE_URL}${path}`, {
      cache: "no-store",
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {})
      },
      signal: controller.signal
    });

    const contentType = response.headers.get("content-type") || "";

    if (!response.ok) {
      let errorMessage = `Falha na API (${response.status})`;

      try {
        if (contentType.includes("application/json")) {
          const body = await response.json();
          errorMessage = body?.error || errorMessage;
        } else {
          const text = await response.text();
          errorMessage = text || errorMessage;
        }
      } catch (_error) {}

      throw new Error(errorMessage);
    }

    if (contentType.includes("application/json")) {
      return response.json();
    }

    return null;
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("Tempo limite excedido ao consultar a API.");
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function wakeUpApi() {
  try {
    await apiFetch("/api/health", { method: "GET" });
  } catch (_error) {}
}

async function fetchInboxSummariesFromApi() {
  return apiFetch("/api/aedes/lotes", { method: "GET" });
}

async function fetchBatchDetailFromApi(loteId) {
  return apiFetch(`/api/aedes/lotes/${encodeURIComponent(loteId)}`, { method: "GET" });
}

/* =========================================================
   CARGA E TRANSFORMAÇÃO
========================================================= */

async function loadApiData() {
  await wakeUpApi();

  const summaries = await fetchInboxSummariesFromApi();
  state.apiBatchSummaries = Array.isArray(summaries) ? summaries : [];
  state.apiBatchDetails.clear();

  const detailPromises = state.apiBatchSummaries.map(async (summary) => {
    if (!summary?.loteId) return;
    const detail = await fetchBatchDetailFromApi(summary.loteId);
    state.apiBatchDetails.set(summary.loteId, detail);
  });

  await Promise.all(detailPromises);
}

function buildApiFlattenedRows() {
  const rows = [];

  for (const summary of state.apiBatchSummaries) {
    const detail = state.apiBatchDetails.get(summary.loteId);
    const registros = Array.isArray(detail?.registros) ? detail.registros : [];

    for (const item of registros) {
      rows.push({
        lote_id: detail?.loteId || summary?.loteId || "",
        data_envio: detail?.createdAt || summary?.createdAt || "",
        focal_nome: item?.focalNome || detail?.focal?.nome || summary?.focalNome || "",
        unidade_id: item?.unidadeId ?? "",
        unidade_nome: item?.unidadeNome || item?.unidade || "",
        municipio: item?.municipio || "",
        data_vistoria: item?.dataVistoria || detail?.dataVistoria || summary?.dataVistoria || "",
        ano: item?.ano ?? detail?.ano ?? summary?.ano ?? "",
        semana: item?.semana ?? detail?.semana ?? summary?.semana ?? "",
        semana_acumulada:
          item?.semanaAcumulada ??
          detail?.semanaAcumulada ??
          summary?.semanaAcumulada ??
          "",
        vistoria_realizada: normalizeDisplayValue(item?.vistoriaRealizada || item?.statusVistoria || ""),
        foco_encontrado: normalizeDisplayValue(item?.focoEncontrado || item?.statusFoco || ""),
        foco_remediado: normalizeDisplayValue(item?.focoRemediado || item?.statusRemediacao || ""),
        locais_foco_resumo: normalizeSummaryArray(
          item?.locaisFocoResumo || item?.locaisFoco
        ).join("; "),
        motivos_nao_remediacao_resumo: normalizeSummaryArray(
          item?.motivosNaoRemediacaoResumo || item?.motivosNaoRemediacao
        ).join("; "),
        motivos_nao_vistoria_resumo: normalizeSummaryArray(
          item?.motivosNaoVistoriaResumo || item?.motivosNaoVistoria
        ).join("; "),
        observacoes: normalizeDisplayValue(item?.observacoes || "")
      });
    }
  }

  return rows.sort((a, b) => {
    const dateA = new Date(a.data_envio || a.data_vistoria || 0).getTime();
    const dateB = new Date(b.data_envio || b.data_vistoria || 0).getTime();
    return dateB - dateA;
  });
}

/* =========================================================
   FILTROS
========================================================= */

function fillSelect(selectEl, values) {
  if (!selectEl) return;

  const current = selectEl.value;
  const options = uniqueSorted(values.map((value) => String(value)));

  selectEl.innerHTML =
    `<option value="">Todos</option>` +
    options
      .map(
        (value) =>
          `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`
      )
      .join("");

  if (options.includes(current)) {
    selectEl.value = current;
  }
}

function populateFilterOptions() {
  const rows = state.apiRows;

  fillSelect(els.filterAno, rows.map((row) => row.ano).filter(Boolean));
  fillSelect(els.filterSemana, rows.map((row) => row.semana).filter(Boolean));
  fillSelect(els.filterFocal, rows.map((row) => row.focal_nome).filter(Boolean));
  fillSelect(els.filterUnidade, rows.map((row) => row.unidade_nome).filter(Boolean));
  fillSelect(els.filterMunicipio, rows.map((row) => row.municipio).filter(Boolean));
}

function applyFilters() {
  const buscaGeral = normalizeText(els.filterBuscaGeral?.value || "");
  const ano = readSelectValue(els.filterAno);
  const semana = readSelectValue(els.filterSemana);
  const focal = readSelectValue(els.filterFocal);
  const unidade = readSelectValue(els.filterUnidade);
  const municipio = readSelectValue(els.filterMunicipio);
  const vistoria = readSelectValue(els.filterVistoria);
  const foco = readSelectValue(els.filterFoco);
  const remediacao = readSelectValue(els.filterRemediacao);

  state.filteredRows = state.apiRows.filter((row) => {
    if (ano && String(row.ano) !== ano) return false;
    if (semana && String(row.semana) !== semana) return false;
    if (focal && String(row.focal_nome) !== focal) return false;
    if (unidade && String(row.unidade_nome) !== unidade) return false;
    if (municipio && String(row.municipio) !== municipio) return false;
    if (vistoria && normalizeStatus(row.vistoria_realizada) !== vistoria) return false;
    if (foco && normalizeStatus(row.foco_encontrado) !== foco) return false;
    if (remediacao && normalizeStatus(row.foco_remediado) !== remediacao) return false;

    if (buscaGeral) {
      const haystack = normalizeText([
        row.lote_id,
        row.focal_nome,
        row.unidade_nome,
        row.municipio,
        row.locais_foco_resumo,
        row.motivos_nao_remediacao_resumo,
        row.motivos_nao_vistoria_resumo,
        row.observacoes
      ].join(" "));

      if (!haystack.includes(buscaGeral)) return false;
    }

    return true;
  });

  renderSummary();
  resetVirtualScroll();
  updateIndicatorsIfVisible();
}

function clearFilters() {
  if (els.filterBuscaGeral) els.filterBuscaGeral.value = "";
  if (els.filterAno) els.filterAno.value = "";
  if (els.filterSemana) els.filterSemana.value = "";
  if (els.filterFocal) els.filterFocal.value = "";
  if (els.filterUnidade) els.filterUnidade.value = "";
  if (els.filterMunicipio) els.filterMunicipio.value = "";
  if (els.filterVistoria) els.filterVistoria.value = "";
  if (els.filterFoco) els.filterFoco.value = "";
  if (els.filterRemediacao) els.filterRemediacao.value = "";

  state.filteredRows = [...state.apiRows];
  renderSummary();
  resetVirtualScroll();
  updateIndicatorsIfVisible();
}

/* =========================================================
   VIRTUALIZAÇÃO
========================================================= */

function resetVirtualScroll() {
  state.virtual.startIndex = 0;
  state.virtual.endIndex = 0;

  if (els.baseVirtualViewport) {
    els.baseVirtualViewport.scrollTop = 0;
  }

  renderVirtualTable();
}

function calculateVisibleRange() {
  const totalRows = state.filteredRows.length;

  if (!els.baseVirtualViewport) {
    return { startIndex: 0, endIndex: totalRows };
  }

  const scrollTop = els.baseVirtualViewport.scrollTop;
  const viewportHeight = els.baseVirtualViewport.clientHeight;

  const firstVisibleRow = Math.floor(scrollTop / VIRTUAL_ROW_HEIGHT);
  const visibleRowCount = Math.ceil(viewportHeight / VIRTUAL_ROW_HEIGHT);

  const startIndex = Math.max(0, firstVisibleRow - VIRTUAL_BUFFER_ROWS);
  const endIndex = Math.min(
    totalRows,
    firstVisibleRow + visibleRowCount + VIRTUAL_BUFFER_ROWS
  );

  return { startIndex, endIndex };
}

function renderPaginationInfo(start, end, total) {
  if (!els.basePaginationInfo) return;
  els.basePaginationInfo.textContent =
    `Exibindo ${formatNumber(start)}–${formatNumber(end)} de ${formatNumber(total)} registros.`;
}

function renderVirtualTable() {
  if (!els.baseTecnicaTableBody || !els.baseVirtualSpacer) return;

  const total = state.filteredRows.length;

  if (els.baseTableCount) {
    els.baseTableCount.textContent = `${formatNumber(total)} registros`;
  }

  // Ajuste do colspan para 13 (total de colunas que você quer exibir)
  if (!total) {
    els.baseVirtualSpacer.style.height = "auto";
    els.baseTecnicaTableBody.innerHTML = `
      <tr>
        <td colspan="13" class="base-empty">
          Nenhum registro encontrado com os filtros atuais.
        </td>
      </tr>
    `;
    renderPaginationInfo(0, 0, 0);
    return;
  }

  const { startIndex, endIndex } = calculateVisibleRange();
  state.virtual.startIndex = startIndex;
  state.virtual.endIndex = endIndex;

  const visibleRows = state.filteredRows.slice(startIndex, endIndex);
  const totalHeight = total * VIRTUAL_ROW_HEIGHT;
  const offsetTop = startIndex * VIRTUAL_ROW_HEIGHT;

  els.baseVirtualSpacer.style.height = `${totalHeight}px`;

  const table = els.baseTecnicaTableBody.closest("table");
  if (table) {
    table.style.transform = `translateY(${offsetTop}px)`;
  }

  // MAPEAMENTO ALINHADO COM A ORDEM SOLICITADA
  els.baseTecnicaTableBody.innerHTML = visibleRows
    .map((row) => `
      <tr style="height:${VIRTUAL_ROW_HEIGHT}px;">
        <td>${escapeHtml(row.data_registro ? formatDateTime(row.data_registro) : DASH_VALUE)}</td>
        <td>${escapeHtml(row.unidade_id || DASH_VALUE)}</td>
        <td><strong>${escapeHtml(row.unidade_nome || DASH_VALUE)}</strong></td>
        
        <td><span class="${getStatusPillClass(row.vistoria_realizada)}">${escapeHtml(row.vistoria_realizada || DASH_VALUE)}</span></td>
        <td>${escapeHtml(Array.isArray(row.motivos_nao_vistoria) ? row.motivos_nao_vistoria.join(", ") : row.motivos_nao_vistoria || DASH_VALUE)}</td>
        
        <td><span class="${getStatusPillClass(row.foco_encontrado)}">${escapeHtml(row.foco_encontrado || DASH_VALUE)}</span></td>
        <td>${escapeHtml(Array.isArray(row.locais_foco) ? row.locais_foco.join(", ") : row.locais_foco || DASH_VALUE)}</td>
        
        <td><span class="${getStatusPillClass(row.foco_remediado)}">${escapeHtml(row.foco_remediado || DASH_VALUE)}</span></td>
        <td>${escapeHtml(Array.isArray(row.motivos_nao_remediacao) ? row.motivos_nao_remediacao.join(", ") : row.motivos_nao_remediacao || DASH_VALUE)}</td>
        
        <td><small>${escapeHtml(row.outros_local || DASH_VALUE)}</small></td>
        <td><small>${escapeHtml(row.outros_motivo_nao_vistoria || DASH_VALUE)}</small></td>
        <td><small>${escapeHtml(row.outros_motivo_nao_remediacao || DASH_VALUE)}</small></td>
        
        <td><small>${escapeHtml(row.observacoes || DASH_VALUE)}</small></td>
      </tr>
    `)
    .join("");

  renderPaginationInfo(startIndex + 1, endIndex, total);
}

/* =========================================================
   RENDER
========================================================= */

function renderSummary() {
  const sourceRows = getActiveRows();

  const totalRegistros = sourceRows.length;
  const focaisComEnvio = uniqueSorted(sourceRows.map((row) => row.focal_nome)).length;
  const lotesRecebidos = uniqueSorted(sourceRows.map((row) => row.lote_id)).length;
  const vistoriasRealizadas = sourceRows.filter(
    (row) => normalizeStatus(row.vistoria_realizada) === "sim"
  ).length;
  const focosEncontrados = sourceRows.filter(
    (row) => normalizeStatus(row.foco_encontrado) === "sim"
  ).length;

  if (els.summaryTotalRegistros) els.summaryTotalRegistros.textContent = formatNumber(totalRegistros);
  if (els.summaryFocaisComEnvio) els.summaryFocaisComEnvio.textContent = formatNumber(focaisComEnvio);
  if (els.summaryLotesRecebidos) els.summaryLotesRecebidos.textContent = formatNumber(lotesRecebidos);
  if (els.summaryVistoriasRealizadas) els.summaryVistoriasRealizadas.textContent = formatNumber(vistoriasRealizadas);
  if (els.summaryFocosEncontrados) els.summaryFocosEncontrados.textContent = formatNumber(focosEncontrados);
}

/* =========================================================
   INDICADORES
========================================================= */

function renderCharts() {
  const rows = getActiveRows();

  const conformes = rows.filter(isConforme).length;
  const naoConformes = rows.filter(isNaoConforme).length;
  const neutros = Math.max(0, rows.length - conformes - naoConformes);

  const locaisFocoData = aggregateTextField(
    rows.filter((row) => normalizeStatus(row.foco_encontrado) === "sim"),
    "locais_foco_resumo"
  ).slice(0, 10);

  const motivosNaoVistoriaData = aggregateTextField(
    rows.filter((row) => normalizeStatus(row.vistoria_realizada) === "nao"),
    "motivos_nao_vistoria_resumo"
  ).slice(0, 10);

  destroyChart(state.charts.conformidade);
  destroyChart(state.charts.locaisFoco);
  destroyChart(state.charts.motivosNaoVistoria);

  state.charts.conformidade = buildChart(
    els.chartConformidade,
    "doughnut",
    ["Conforme", "Não conforme", "Demais registros"],
    [conformes, naoConformes, neutros],
    "Conformidade"
  );

  state.charts.locaisFoco = buildChart(
    els.chartLocaisFoco,
    "bar",
    locaisFocoData.map(([label]) => label),
    locaisFocoData.map(([, value]) => value),
    "Locais de foco"
  );

  state.charts.motivosNaoVistoria = buildChart(
    els.chartMotivosNaoVistoria,
    "bar",
    motivosNaoVistoriaData.map(([label]) => label),
    motivosNaoVistoriaData.map(([, value]) => value),
    "Motivos de não vistoria"
  );
}

function updateIndicatorsIfVisible() {
  const visible =
    els.painelIndicadores &&
    !els.painelIndicadores.classList.contains("hidden");

  if (visible) {
    renderCharts();
  }
}

/* =========================================================
   EXPORTAÇÃO
========================================================= */

function exportFilteredCsv() {
  if (!state.filteredRows.length) return;
  const csv = buildCsv(state.filteredRows);
  downloadTextFile("aedes-base-tecnica-novos-registros.csv", csv, "text/csv;charset=utf-8");
}

function exportFilteredJson() {
  const payload = {
    exportedAt: new Date().toISOString(),
    totalRows: state.filteredRows.length,
    totalBatches: uniqueSorted(state.filteredRows.map((row) => row.lote_id)).length,
    rows: state.filteredRows
  };

  downloadJson("aedes-base-tecnica-novos-registros.json", payload);
}

/* =========================================================
   FLUXO PRINCIPAL
========================================================= */

async function refreshTechnicalBase() {
  await loadApiData();

  state.apiRows = buildApiFlattenedRows();
  populateFilterOptions();
  state.filteredRows = [...state.apiRows];

  renderSummary();
  resetVirtualScroll();
  updateIndicatorsIfVisible();
}

/* =========================================================
   EVENTOS
========================================================= */

function setupVirtualScroll() {
  if (!els.baseVirtualViewport) return;

  let ticking = false;

  els.baseVirtualViewport.addEventListener("scroll", () => {
    if (!ticking) {
      window.requestAnimationFrame(() => {
        renderVirtualTable();
        ticking = false;
      });
      ticking = true;
    }
  });
}

function bindEvents() {
  if (els.btnAtualizarBaseTecnica) {
    els.btnAtualizarBaseTecnica.addEventListener("click", async () => {
      try {
        els.btnAtualizarBaseTecnica.disabled = true;
        els.btnAtualizarBaseTecnica.textContent = "Atualizando base...";
        await refreshTechnicalBase();
      } catch (error) {
        console.error(error);
        alert(error?.message || "Não foi possível atualizar a base técnica.");
      } finally {
        els.btnAtualizarBaseTecnica.disabled = false;
        els.btnAtualizarBaseTecnica.textContent = "Atualizar base";
      }
    });
  }

  if (els.btnAplicarFiltrosBase) {
    els.btnAplicarFiltrosBase.addEventListener("click", applyFilters);
  }

  if (els.btnLimparFiltrosBase) {
    els.btnLimparFiltrosBase.addEventListener("click", clearFilters);
  }

  if (els.btnExportarBaseCsv) {
    els.btnExportarBaseCsv.addEventListener("click", exportFilteredCsv);
  }

  if (els.btnExportarBaseJson) {
    els.btnExportarBaseJson.addEventListener("click", exportFilteredJson);
  }

  [
    els.filterBuscaGeral,
    els.filterAno,
    els.filterSemana,
    els.filterFocal,
    els.filterUnidade,
    els.filterMunicipio,
    els.filterVistoria,
    els.filterFoco,
    els.filterRemediacao
  ].forEach((el) => {
    if (!el) return;
    el.addEventListener("change", applyFilters);
    if (el.tagName === "INPUT") {
      el.addEventListener("input", applyFilters);
    }
  });
}

function setupTabs() {
  if (!els.tabTabela || !els.tabIndicadores || !els.painelIndicadores || !els.tabelaCard) {
    return;
  }

  els.tabTabela.addEventListener("click", () => {
    els.painelIndicadores.classList.add("hidden");
    els.tabelaCard.classList.remove("hidden");

    els.tabTabela.classList.remove("btn--ghost");
    els.tabTabela.classList.add("btn--primary");

    els.tabIndicadores.classList.remove("btn--primary");
    els.tabIndicadores.classList.add("btn--ghost");
  });

  els.tabIndicadores.addEventListener("click", () => {
    els.painelIndicadores.classList.remove("hidden");
    els.tabelaCard.classList.add("hidden");

    els.tabIndicadores.classList.remove("btn--ghost");
    els.tabIndicadores.classList.add("btn--primary");

    els.tabTabela.classList.remove("btn--primary");
    els.tabTabela.classList.add("btn--ghost");

    renderCharts();
  });
}

/* =========================================================
   INIT
========================================================= */

async function init() {
  if (typeof requireAuth === "function") {
    requireAuth();
  }

  bindEvents();
  setupVirtualScroll();
  setupTabs();

  try {
    await refreshTechnicalBase();
  } catch (error) {
    console.error(error);

    if (els.baseTecnicaTableBody) {
      els.baseTecnicaTableBody.innerHTML = `
        <tr>
          <td colspan="11" class="base-empty">
            Não foi possível carregar os novos registros da base técnica.
          </td>
        </tr>
      `;
    }
  }
}

document.addEventListener("DOMContentLoaded", init);