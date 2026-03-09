function formatNumber(value) {
  return new Intl.NumberFormat("pt-BR").format(Number(value || 0));
}

function formatDate(dateStr) {
  if (!dateStr) return "-";
  const [year, month, day] = String(dateStr).split("-");
  if (!year || !month || !day) return dateStr;
  return `${day}/${month}/${year}`;
}

function monthFromIso(dateStr) {
  if (!dateStr) return null;
  const date = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return date.getMonth() + 1;
}

function getStatusLabel(value) {
  if (value === "sim") {
    return { text: "Sim", className: "status-pill status-pill--success" };
  }
  if (value === "nao") {
    return { text: "Não", className: "status-pill status-pill--danger" };
  }
  return { text: "Não informado", className: "status-pill status-pill--muted" };
}

function escapeHtml(text) {
  return String(text ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function countBy(items, getKey) {
  const map = new Map();

  for (const item of items) {
    const key = getKey(item);
    if (key == null || key === "") continue;
    map.set(key, (map.get(key) || 0) + 1);
  }

  return map;
}

function topEntries(map, limit = 8) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]), "pt-BR"))
    .slice(0, limit);
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => {
    if (typeof a === "number" && typeof b === "number") return a - b;
    return String(a).localeCompare(String(b), "pt-BR");
  });
}

function renderStackChart(container, segments, total) {
  if (!container) return;

  const safeTotal = total > 0 ? total : 1;

  container.innerHTML = `
    <div class="stack-row">
      <div class="stack-bar">
        ${segments
          .map(
            (segment) => `
          <div
            class="stack-segment ${segment.className}"
            style="width:${(segment.value / safeTotal) * 100}%"
            title="${escapeHtml(segment.label)}: ${segment.value}"
          ></div>
        `
          )
          .join("")}
      </div>
      <div class="stack-legend">
        ${segments
          .map(
            (segment) => `
          <span>${escapeHtml(segment.label)}: <strong>${formatNumber(segment.value)}</strong></span>
        `
          )
          .join("")}
      </div>
    </div>
  `;
}

function renderBarList(container, entries) {
  if (!container) return;

  if (!entries.length) {
    container.innerHTML = `<p class="empty-state">Sem dados para exibição.</p>`;
    return;
  }

  const max = Math.max(...entries.map(([, value]) => value), 1);

  container.innerHTML = entries
    .map(
      ([label, value]) => `
    <div class="bar-item">
      <div class="bar-item__head">
        <span class="bar-item__label">${escapeHtml(label)}</span>
        <span class="bar-item__value">${formatNumber(value)}</span>
      </div>
      <div class="bar-item__track">
        <div class="bar-item__fill" style="width:${(value / max) * 100}%"></div>
      </div>
    </div>
  `
    )
    .join("");
}

function renderTags(items) {
  if (!items || !items.length) return `<span class="tag">-</span>`;
  return items.map((item) => `<span class="tag">${escapeHtml(item)}</span>`).join("");
}

function filterVistorias(vistorias, filters) {
  return vistorias.filter((item) => {
    const byUnidade =
      !filters.unidadeId || String(item.unidadeId) === String(filters.unidadeId);
    const byAno = !filters.ano || String(item.ano) === String(filters.ano);
    const byStatus = !filters.status || item.vistoriaRealizada === filters.status;
    return byUnidade && byAno && byStatus;
  });
}

function calculateCertificateEligibleUnits(vistorias, unidades) {
  const map = new Map();

  for (const vistoria of vistorias) {
    if (!vistoria.unidadeId || !vistoria.dataVistoria) continue;

    const month = monthFromIso(vistoria.dataVistoria);
    const year = vistoria.ano;

    if (!month || !year) continue;

    const key = `${vistoria.unidadeId}-${year}-${month}`;
    map.set(key, (map.get(key) || 0) + 1);
  }

  const eligibleKeys = [...map.entries()]
    .filter(([, count]) => count >= 4)
    .map(([key]) => key);

  const eligibleUnitIds = new Set(eligibleKeys.map((key) => key.split("-")[0]));
  return unidades.filter((u) => eligibleUnitIds.has(String(u.id))).length;
}

function populateSelect(
  select,
  items,
  getValue,
  getLabel,
  includeAll = false,
  allLabel = "Todos"
) {
  if (!select) return;

  const currentValue = select.value;
  const options = [];

  if (includeAll) {
    options.push(`<option value="">${escapeHtml(allLabel)}</option>`);
  }

  for (const item of items) {
    options.push(
      `<option value="${escapeHtml(getValue(item))}">${escapeHtml(getLabel(item))}</option>`
    );
  }

  select.innerHTML = options.join("");

  if ([...select.options].some((option) => option.value === currentValue)) {
    select.value = currentValue;
  }
}

function buildCertificateHtml({ unidadeNome, ano, mes, total }) {
  const meses = [
    "",
    "janeiro",
    "fevereiro",
    "março",
    "abril",
    "maio",
    "junho",
    "julho",
    "agosto",
    "setembro",
    "outubro",
    "novembro",
    "dezembro"
  ];

  return `
    <div class="certificate-status certificate-status--ok">
      <strong>Unidade apta para certificado.</strong>
      <p>
        A unidade <strong>${escapeHtml(unidadeNome)}</strong> registrou
        <strong>${formatNumber(total)} vistorias</strong> em
        <strong>${escapeHtml(meses[mes])} de ${escapeHtml(ano)}</strong>.
      </p>
      <p>O download do certificado foi liberado.</p>
    </div>
  `;
}

function buildCertificateNotOkHtml({ unidadeNome, ano, mes, total }) {
  const meses = [
    "",
    "janeiro",
    "fevereiro",
    "março",
    "abril",
    "maio",
    "junho",
    "julho",
    "agosto",
    "setembro",
    "outubro",
    "novembro",
    "dezembro"
  ];

  return `
    <div class="certificate-status certificate-status--not-ok">
      <strong>Unidade ainda não apta para certificado.</strong>
      <p>
        A unidade <strong>${escapeHtml(unidadeNome)}</strong> registrou
        <strong>${formatNumber(total)} vistorias</strong> em
        <strong>${escapeHtml(meses[mes])} de ${escapeHtml(ano)}</strong>.
      </p>
      <p>São necessárias pelo menos <strong>4 vistorias no mês</strong>.</p>
    </div>
  `;
}

function downloadCertificateText({ unidadeNome, ano, mes, total }) {
  const meses = [
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

  return `
CERTIFICADO DE CONFORMIDADE
Programa de combate ao Aedes aegypti
Portal DMA - Sistema de Gestão Ambiental

Certificamos que a unidade ${unidadeNome}
registrou ${total} vistorias no mês de ${meses[mes]} de ${ano},
atendendo ao critério mínimo de 4 vistorias mensais.

Documento gerado pelo módulo Aedes do Portal DMA.
`.trim();
}

const state = {
  metadata: null,
  unidades: [],
  vistorias: [],
  filteredVistorias: [],
  currentCertificate: null
};

const els = {
  dbStatus: document.getElementById("dbStatus"),
  filterUnidade: document.getElementById("filterUnidade"),
  filterAno: document.getElementById("filterAno"),
  filterStatus: document.getElementById("filterStatus"),
  clearFiltersBtn: document.getElementById("clearFiltersBtn"),
  reloadSeedBtn: document.getElementById("reloadSeedBtn"),

  kpiTotalVistorias: document.getElementById("kpiTotalVistorias"),
  kpiRealizadas: document.getElementById("kpiRealizadas"),
  kpiFocos: document.getElementById("kpiFocos"),
  kpiNaoRemediadas: document.getElementById("kpiNaoRemediadas"),
  kpiAptas: document.getElementById("kpiAptas"),

  chartStatusVistoria: document.getElementById("chartStatusVistoria"),
  chartFocoEncontrado: document.getElementById("chartFocoEncontrado"),
  chartTopUnidades: document.getElementById("chartTopUnidades"),
  chartMotivosNaoVistoria: document.getElementById("chartMotivosNaoVistoria"),

  historyTableBody: document.getElementById("historyTableBody"),
  historyCount: document.getElementById("historyCount"),

  certUnidade: document.getElementById("certUnidade"),
  certMes: document.getElementById("certMes"),
  certAno: document.getElementById("certAno"),
  checkCertificateBtn: document.getElementById("checkCertificateBtn"),
  downloadCertificateBtn: document.getElementById("downloadCertificateBtn"),
  certificateStatus: document.getElementById("certificateStatus")
};

// NAVEGAÇÃO POR ABAS
const tabButtons = Array.from(document.querySelectorAll(".module-nav-card"));
const tabPanels = Array.from(document.querySelectorAll(".tab-panel"));

function activateTab(tabName) {
  for (const button of tabButtons) {
    button.classList.toggle("is-active", button.dataset.tab === tabName);
  }

  for (const panel of tabPanels) {
    panel.classList.toggle("is-active", panel.id === `tab-${tabName}`);
  }
}

function refreshFilters() {
  populateSelect(
    els.filterUnidade,
    state.unidades,
    (item) => item.id,
    (item) => item.nome,
    true,
    "Todas"
  );

  populateSelect(
    els.certUnidade,
    state.unidades,
    (item) => item.id,
    (item) => item.nome,
    false
  );

  const years = uniqueSorted(state.vistorias.map((item) => item.ano));

  populateSelect(
    els.filterAno,
    years,
    (item) => item,
    (item) => item,
    true,
    "Todos"
  );

  populateSelect(
    els.certAno,
    years,
    (item) => item,
    (item) => item,
    false
  );
}

function applyFilters() {
  const filters = {
    unidadeId: els.filterUnidade.value,
    ano: els.filterAno.value,
    status: els.filterStatus.value
  };

  state.filteredVistorias = filterVistorias(state.vistorias, filters);
  renderDashboard();
}

function renderKPIs() {
  const items = state.filteredVistorias;

  const total = items.length;
  const realizadas = items.filter((item) => item.vistoriaRealizada === "sim").length;
  const focos = items.filter((item) => item.focoEncontrado === "sim").length;
  const naoRemediadas = items.filter((item) => item.focoRemediado === "nao").length;
  const aptas = calculateCertificateEligibleUnits(items, state.unidades);

  els.kpiTotalVistorias.textContent = formatNumber(total);
  els.kpiRealizadas.textContent = formatNumber(realizadas);
  els.kpiFocos.textContent = formatNumber(focos);
  els.kpiNaoRemediadas.textContent = formatNumber(naoRemediadas);
  els.kpiAptas.textContent = formatNumber(aptas);
}

function renderCharts() {
  const items = state.filteredVistorias;

  const statusCounts = {
    realizadas: items.filter((item) => item.vistoriaRealizada === "sim").length,
    naoRealizadas: items.filter((item) => item.vistoriaRealizada === "nao").length,
    naoInformadas: items.filter((item) => item.vistoriaRealizada === "nao_informado").length
  };

  renderStackChart(
    els.chartStatusVistoria,
    [
      {
        label: "Realizadas",
        value: statusCounts.realizadas,
        className: "stack-segment--success"
      },
      {
        label: "Não realizadas",
        value: statusCounts.naoRealizadas,
        className: "stack-segment--danger"
      },
      {
        label: "Não informadas",
        value: statusCounts.naoInformadas,
        className: "stack-segment--muted"
      }
    ],
    items.length
  );

  const focoCounts = {
    sim: items.filter((item) => item.focoEncontrado === "sim").length,
    nao: items.filter((item) => item.focoEncontrado === "nao").length,
    naoInformado: items.filter((item) => !item.focoEncontrado).length
  };

  renderStackChart(
    els.chartFocoEncontrado,
    [
      {
        label: "Foco encontrado",
        value: focoCounts.sim,
        className: "stack-segment--danger"
      },
      {
        label: "Sem foco",
        value: focoCounts.nao,
        className: "stack-segment--success"
      },
      {
        label: "Sem informação",
        value: focoCounts.naoInformado,
        className: "stack-segment--muted"
      }
    ],
    items.length
  );

  const unidadeMap = countBy(items, (item) => item.unidade || "Sem unidade");
  renderBarList(els.chartTopUnidades, topEntries(unidadeMap, 8));

  const motivosMap = new Map();
  for (const item of items) {
    const motivos = item.motivosNaoVistoriaResumo || [];
    for (const motivo of motivos) {
      if (!motivo) continue;
      motivosMap.set(motivo, (motivosMap.get(motivo) || 0) + 1);
    }
  }

  renderBarList(els.chartMotivosNaoVistoria, topEntries(motivosMap, 8));
}

function renderHistory() {
  const rows = [...state.filteredVistorias]
    .sort((a, b) => String(b.dataVistoria).localeCompare(String(a.dataVistoria)))
    .slice(0, 200);

  els.historyCount.textContent = `${formatNumber(state.filteredVistorias.length)} registros`;

  if (!rows.length) {
    els.historyTableBody.innerHTML = `
      <tr>
        <td colspan="6">Nenhum registro encontrado para os filtros selecionados.</td>
      </tr>
    `;
    return;
  }

  els.historyTableBody.innerHTML = rows
    .map((item) => {
      const vistoriaStatus = getStatusLabel(item.vistoriaRealizada);
      const focoStatus = getStatusLabel(item.focoEncontrado);
      const remedStatus = getStatusLabel(item.focoRemediado);

      const motivos = [
        ...(item.motivosNaoVistoriaResumo || []),
        ...(item.motivosNaoRemediacaoResumo || [])
      ];

      return `
        <tr>
          <td>${escapeHtml(formatDate(item.dataVistoria))}</td>
          <td>${escapeHtml(item.unidade || "-")}</td>
          <td><span class="${vistoriaStatus.className}">${escapeHtml(vistoriaStatus.text)}</span></td>
          <td><span class="${focoStatus.className}">${escapeHtml(focoStatus.text)}</span></td>
          <td><span class="${remedStatus.className}">${escapeHtml(remedStatus.text)}</span></td>
          <td>
            <div class="tags-list">
              ${renderTags(motivos)}
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

function renderDashboard() {
  renderKPIs();
  renderCharts();
  renderHistory();
}

function checkCertificateEligibility() {
  const unidadeId = els.certUnidade.value;
  const ano = Number(els.certAno.value);
  const mes = Number(els.certMes.value);

  if (!unidadeId || !ano || !mes) {
    state.currentCertificate = null;
    els.downloadCertificateBtn.disabled = true;
    els.certificateStatus.className = "certificate-status";
    els.certificateStatus.textContent =
      "Selecione unidade, mês e ano para verificar a conformidade.";
    return;
  }

  const unidade = state.unidades.find(
    (item) => String(item.id) === String(unidadeId)
  );
  const unidadeNome = unidade?.nome || "Unidade";

  const total = state.vistorias.filter((item) => {
    if (String(item.unidadeId) !== String(unidadeId)) return false;
    if (Number(item.ano) !== ano) return false;
    return monthFromIso(item.dataVistoria) === mes;
  }).length;

  const eligible = total >= 4;

  state.currentCertificate = {
    unidadeId,
    unidadeNome,
    ano,
    mes,
    total,
    eligible
  };

  els.downloadCertificateBtn.disabled = !eligible;

  if (eligible) {
    els.certificateStatus.innerHTML = buildCertificateHtml({
      unidadeNome,
      ano,
      mes,
      total
    });
  } else {
    els.certificateStatus.innerHTML = buildCertificateNotOkHtml({
      unidadeNome,
      ano,
      mes,
      total
    });
  }
}

function downloadCertificate() {
  if (!state.currentCertificate || !state.currentCertificate.eligible) return;

  const { unidadeNome, ano, mes, total } = state.currentCertificate;

  try {
    AedesCerts.openPrintableCertificate({
      unidadeNome,
      ano,
      mes,
      total
    });
  } catch (error) {
    console.error(error);
    alert("Não foi possível abrir a visualização do certificado.");
  }
}

async function loadData() {
  state.metadata = await AedesDB.getMetadata();
  state.unidades = await AedesDB.getAllUnidades();
  state.vistorias = await AedesDB.getAllVistorias();
  state.filteredVistorias = [...state.vistorias];

  const totalVistorias = state.vistorias.length;
  const totalUnidades = state.unidades.length;

  const overviewBaseText = document.getElementById("overviewBaseText");
  if (overviewBaseText) {
    overviewBaseText.textContent = `${formatNumber(totalUnidades)} unidades e ${formatNumber(totalVistorias)} vistorias carregadas`;
  }

  refreshFilters();
  renderDashboard();

  if (els.dbStatus) {
    els.dbStatus.textContent = `Base carregada com ${formatNumber(totalUnidades)} unidades e ${formatNumber(totalVistorias)} vistorias.`;
  }
}

async function bootstrap() {
  try {
    if (els.dbStatus) {
      els.dbStatus.textContent = "Verificando seed local...";
    }

    await AedesSeed.ensureSeedLoaded(false);
    await loadData();

    if (els.dbStatus) {
      els.dbStatus.textContent = "Base local pronta para uso.";
    }
  } catch (error) {
    console.error(error);

    if (els.dbStatus) {
      els.dbStatus.textContent = "Erro ao carregar a base local do módulo.";
    }
  }
}

function bindEvents() {
  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      activateTab(button.dataset.tab);
    });
  });

  els.filterUnidade?.addEventListener("change", applyFilters);
  els.filterAno?.addEventListener("change", applyFilters);
  els.filterStatus?.addEventListener("change", applyFilters);

  els.clearFiltersBtn?.addEventListener("click", () => {
    els.filterUnidade.value = "";
    els.filterAno.value = "";
    els.filterStatus.value = "";
    applyFilters();
  });

  els.reloadSeedBtn?.addEventListener("click", async () => {
    try {
      if (els.dbStatus) {
        els.dbStatus.textContent = "Recarregando dados do arquivo seed...";
      }

      await AedesSeed.ensureSeedLoaded(true);
      await loadData();

      if (els.dbStatus) {
        els.dbStatus.textContent = "Seed recarregado com sucesso.";
      }
    } catch (error) {
      console.error(error);

      if (els.dbStatus) {
        els.dbStatus.textContent = "Falha ao recarregar o seed.";
      }
    }
  });

  els.checkCertificateBtn?.addEventListener(
    "click",
    checkCertificateEligibility
  );
  els.downloadCertificateBtn?.addEventListener(
    "click",
    downloadCertificate
  );
}

bindEvents();
bootstrap();