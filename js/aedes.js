function formatNumber(value) {
  return new Intl.NumberFormat("pt-BR").format(Number(value || 0));
}

function formatPercent(value) {
  return `${Number(value || 0).toFixed(1).replace(".", ",")}%`;
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

function normalizeStatus(value) {
  const v = String(value ?? "").trim().toLowerCase();

  if (["sim", "s", "true", "1"].includes(v)) return "sim";
  if (["nao", "não", "n", "false", "0"].includes(v)) return "nao";
  return "nao_informado";
}

function getStatusLabel(value) {
  const normalized = normalizeStatus(value);

  if (normalized === "sim") {
    return { text: "Sim", className: "status-pill status-pill--success" };
  }

  if (normalized === "nao") {
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

function uniqueSorted(values) {
  return [...new Set(values.filter((v) => v !== null && v !== undefined && v !== ""))].sort(
    (a, b) => {
      if (typeof a === "number" && typeof b === "number") return a - b;
      return String(a).localeCompare(String(b), "pt-BR");
    }
  );
}

function polarToCartesian(cx, cy, r, angleDeg) {
  const rad = ((angleDeg - 90) * Math.PI) / 180.0;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad)
  };
}

function describeArc(cx, cy, r, startAngle, endAngle) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";

  return [
    "M",
    start.x,
    start.y,
    "A",
    r,
    r,
    0,
    largeArcFlag,
    0,
    end.x,
    end.y
  ].join(" ");
}

/**
 * Normaliza campos que podem vir:
 * - como array
 * - como string única
 * - como string separada por vírgula, ponto e vírgula, pipe ou quebra de linha
 * - ou até com texto vazio
 *
 * Isso corrige o problema de motivos aparecerem como:
 * r / e / o / a / t
 * quando o código anterior iterava uma string como se fosse array.
 */
function normalizeListField(value) {
  if (Array.isArray(value)) {
    return value
      .flatMap((item) => normalizeListField(item))
      .filter(Boolean);
  }

  if (value == null) return [];

  const raw = String(value).trim();
  if (!raw) return [];

  // Se vier como JSON serializado de array
  if (
    (raw.startsWith("[") && raw.endsWith("]")) ||
    (raw.startsWith('["') && raw.endsWith('"]'))
  ) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed
          .flatMap((item) => normalizeListField(item))
          .filter(Boolean);
      }
    } catch (_error) {
      // segue fluxo normal
    }
  }

  // separadores comuns
  if (/[;\n|]/.test(raw)) {
    return raw
      .split(/[;\n|]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  // vírgula separadora só quando parece lista
  if (raw.includes(", ")) {
    return raw
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [raw];
}

/**
 * Humaniza rótulos técnicos/códigos.
 * Exemplo:
 * "reservatorio_sem_cobertura" -> "Reservatório sem cobertura"
 */
function prettifyLabel(value) {
  if (value == null) return "-";

  const str = String(value).trim();
  if (!str) return "-";

  // Se for uma letra isolada, mantemos como está para não inventar informação.
  // Mas o normalizeListField já evita o bug principal.
  if (str.length === 1) return str.toUpperCase();

  return str
    .replaceAll("_", " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (char) => char.toUpperCase());
}

function topEntries(map, limit = 8) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]), "pt-BR"))
    .slice(0, limit);
}

function renderGaugeChart(container, config) {
  if (!container) return;

  const {
    titleValue,
    titleLabel,
    percent,
    color = "#16a34a",
    trackColor = "#e2e8f0",
    legend = []
  } = config;

  const pct = Math.max(0, Math.min(100, Number(percent || 0)));
  const endAngle = 180 * (pct / 100);

  const trackPath = describeArc(120, 120, 82, 0, 180);
  const valuePath = pct > 0 ? describeArc(120, 120, 82, 0, endAngle) : "";

  container.innerHTML = `
    <div class="chart-wrap">
      <svg class="chart-svg" viewBox="0 0 240 150" width="220" height="140" aria-hidden="true">
        <path d="${trackPath}" fill="none" stroke="${trackColor}" stroke-width="20" stroke-linecap="round"></path>
        ${
          valuePath
            ? `<path d="${valuePath}" fill="none" stroke="${color}" stroke-width="20" stroke-linecap="round"></path>`
            : ""
        }
      </svg>

      <div class="chart-center">
        <strong>${escapeHtml(titleValue)}</strong>
        <span>${escapeHtml(titleLabel)}</span>
      </div>

      <div class="chart-legend">
        ${legend
          .map(
            (item) => `
              <div class="chart-legend__item">
                <span class="chart-legend__left">
                  <span class="chart-dot ${item.dotClass}"></span>
                  <span>${escapeHtml(item.label)}</span>
                </span>
                <strong>${escapeHtml(item.value)}</strong>
              </div>
            `
          )
          .join("")}
      </div>
    </div>
  `;
}

function renderPieChart(container, config) {
  if (!container) return;

  const {
    centerValue,
    centerLabel,
    slices = [],
    legend = []
  } = config;

  const total = slices.reduce((acc, slice) => acc + Number(slice.value || 0), 0);
  let currentAngle = 0;
  const arcs = [];

  if (total > 0) {
    for (const slice of slices) {
      const value = Number(slice.value || 0);
      if (value <= 0) continue;

      const angle = (value / total) * 360;
      const start = currentAngle;
      const end = currentAngle + angle;

      if (angle >= 360) {
        arcs.push(`
          <circle cx="120" cy="120" r="78" fill="none" stroke="${slice.color}" stroke-width="26"></circle>
        `);
      } else {
        arcs.push(`
          <path
            d="${describeArc(120, 120, 78, start, end)}"
            fill="none"
            stroke="${slice.color}"
            stroke-width="26"
            stroke-linecap="round"
          ></path>
        `);
      }

      currentAngle = end;
    }
  }

  container.innerHTML = `
    <div class="chart-wrap">
      <svg class="chart-svg" viewBox="0 0 240 240" width="220" height="220" aria-hidden="true">
        <circle cx="120" cy="120" r="78" fill="none" stroke="#e2e8f0" stroke-width="26"></circle>
        ${arcs.join("")}
      </svg>

      <div class="chart-center">
        <strong>${escapeHtml(centerValue)}</strong>
        <span>${escapeHtml(centerLabel)}</span>
      </div>

      <div class="chart-legend">
        ${legend
          .map(
            (item) => `
              <div class="chart-legend__item">
                <span class="chart-legend__left">
                  <span class="chart-dot ${item.dotClass}"></span>
                  <span>${escapeHtml(item.label)}</span>
                </span>
                <strong>${escapeHtml(item.value)}</strong>
              </div>
            `
          )
          .join("")}
      </div>
    </div>
  `;
}

function renderBarList(container, entries, fillClass = "") {
  if (!container) return;

  if (!entries.length) {
    container.innerHTML = `<p class="empty-state">Sem dados para exibição.</p>`;
    return;
  }

  const max = Math.max(...entries.map(([, value]) => value), 1);

  container.innerHTML = entries
    .map(([label, value]) => {
      const width = Math.max((value / max) * 100, 2);

      return `
        <div class="bar-item" title="${escapeHtml(label)} · ${formatNumber(value)}">
          <div class="bar-item__head">
            <span class="bar-item__label">${escapeHtml(label)}</span>
            <span class="bar-item__value">${formatNumber(value)}</span>
          </div>
          <div class="bar-item__track">
            <div class="bar-item__fill ${fillClass}" style="width:${width}%"></div>
          </div>
        </div>
      `;
    })
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
    const byStatus =
      !filters.status || normalizeStatus(item.vistoriaRealizada) === filters.status;

    return byUnidade && byAno && byStatus;
  });
}

function calculateCertificateEligibleUnits(vistorias, unidades) {
  const map = new Map();

  for (const vistoria of vistorias) {
    if (!vistoria.unidadeId || !vistoria.dataVistoria) continue;
    if (normalizeStatus(vistoria.vistoriaRealizada) !== "sim") continue;

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

function buildCertificateHtml({ unidadeNome, ano, mes, totalRealizadas }) {
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
        <strong>${formatNumber(totalRealizadas)} vistorias realizadas</strong> em
        <strong>${escapeHtml(meses[mes])} de ${escapeHtml(ano)}</strong>.
      </p>
      <p>O download do certificado foi liberado.</p>
    </div>
  `;
}

function buildCertificateNotOkHtml({ unidadeNome, ano, mes, totalRealizadas }) {
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
        <strong>${formatNumber(totalRealizadas)} vistorias realizadas</strong> em
        <strong>${escapeHtml(meses[mes])} de ${escapeHtml(ano)}</strong>.
      </p>
      <p>São necessárias pelo menos <strong>4 vistorias realizadas no mês</strong>.</p>
    </div>
  `;
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

  overviewBaseText: document.getElementById("overviewBaseText"),

  publicKpiTotalVistorias: document.getElementById("publicKpiTotalVistorias"),
  publicKpiRealizadas: document.getElementById("publicKpiRealizadas"),
  publicKpiFocos: document.getElementById("publicKpiFocos"),
  publicKpiNaoRemediadas: document.getElementById("publicKpiNaoRemediadas"),
  publicKpiRemediadas: document.getElementById("publicKpiRemediadas"),
  publicKpiUnidades: document.getElementById("publicKpiUnidades"),
  publicKpiAptas: document.getElementById("publicKpiAptas"),

  kpiSemanasProjeto: document.getElementById("kpiSemanasProjeto"),
  kpiUnidades: document.getElementById("kpiUnidades"),
  kpiMunicipios: document.getElementById("kpiMunicipios"),
  kpiRealizadas: document.getElementById("kpiRealizadas"),
  kpiNaoRealizadas: document.getElementById("kpiNaoRealizadas"),
  kpiNaoInformadas: document.getElementById("kpiNaoInformadas"),
  kpiFocos: document.getElementById("kpiFocos"),
  kpiNaoRemediadas: document.getElementById("kpiNaoRemediadas"),

  gaugeRealizadas: document.getElementById("gaugeRealizadas"),
  gaugeNaoRealizadas: document.getElementById("gaugeNaoRealizadas"),
  gaugeNaoInformadas: document.getElementById("gaugeNaoInformadas"),
  pieFocos: document.getElementById("pieFocos"),
  pieRemediacao: document.getElementById("pieRemediacao"),
  barMotivosNaoVistoria: document.getElementById("barMotivosNaoVistoria"),
  barMotivosNaoRemediacao: document.getElementById("barMotivosNaoRemediacao"),
  barLocaisFoco: document.getElementById("barLocaisFoco"),

  historyTableBody: document.getElementById("historyTableBody"),
  historyCount: document.getElementById("historyCount"),

  certUnidade: document.getElementById("certUnidade"),
  certMes: document.getElementById("certMes"),
  certAno: document.getElementById("certAno"),
  checkCertificateBtn: document.getElementById("checkCertificateBtn"),
  downloadCertificateBtn: document.getElementById("downloadCertificateBtn"),
  certificateStatus: document.getElementById("certificateStatus")
};

const tabButtons = Array.from(document.querySelectorAll(".module-nav-card"));
const tabPanels = Array.from(document.querySelectorAll(".tab-panel"));

function activateTab(tabName) {
  for (const button of tabButtons) {
    const isActive = button.dataset.tab === tabName;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", isActive ? "true" : "false");
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
    unidadeId: els.filterUnidade?.value || "",
    ano: els.filterAno?.value || "",
    status: els.filterStatus?.value || ""
  };

  state.filteredVistorias = filterVistorias(state.vistorias, filters);
  renderManagementLayer();
}

function getDashboardMetrics(items) {
  const total = items.length;

  const realizadas = items.filter(
    (item) => normalizeStatus(item.vistoriaRealizada) === "sim"
  ).length;

  const naoRealizadas = items.filter(
    (item) => normalizeStatus(item.vistoriaRealizada) === "nao"
  ).length;

  const naoInformadas = items.filter(
    (item) => normalizeStatus(item.vistoriaRealizada) === "nao_informado"
  ).length;

  const focosEncontrados = items.filter(
    (item) => normalizeStatus(item.focoEncontrado) === "sim"
  ).length;

  const focosNaoEncontrados = items.filter(
    (item) => normalizeStatus(item.focoEncontrado) === "nao"
  ).length;

  const focosSemInfo = items.filter(
    (item) => normalizeStatus(item.focoEncontrado) === "nao_informado"
  ).length;

  const remediados = items.filter(
    (item) => normalizeStatus(item.focoRemediado) === "sim"
  ).length;

  const naoRemediados = items.filter(
    (item) => normalizeStatus(item.focoRemediado) === "nao"
  ).length;

  const remediacaoSemInfo = items.filter(
    (item) =>
      normalizeStatus(item.focoEncontrado) === "sim" &&
      normalizeStatus(item.focoRemediado) === "nao_informado"
  ).length;

  const semanasProjeto = uniqueSorted(items.map((item) => item.semanaAcumulada)).length;
  const unidades = uniqueSorted(items.map((item) => item.unidadeId)).length;
  const municipios = uniqueSorted(items.map((item) => item.municipio)).length;

  return {
    total,
    realizadas,
    naoRealizadas,
    naoInformadas,
    focosEncontrados,
    focosNaoEncontrados,
    focosSemInfo,
    remediados,
    naoRemediados,
    remediacaoSemInfo,
    semanasProjeto,
    unidades,
    municipios
  };
}

function renderPublicLayer() {
  const metrics = getDashboardMetrics(state.vistorias);
  const aptas = calculateCertificateEligibleUnits(state.vistorias, state.unidades);

  if (els.publicKpiTotalVistorias) {
    els.publicKpiTotalVistorias.textContent = formatNumber(metrics.total);
  }
  if (els.publicKpiRealizadas) {
    els.publicKpiRealizadas.textContent = formatNumber(metrics.realizadas);
  }
  if (els.publicKpiFocos) {
    els.publicKpiFocos.textContent = formatNumber(metrics.focosEncontrados);
  }
  if (els.publicKpiNaoRemediadas) {
    els.publicKpiNaoRemediadas.textContent = formatNumber(metrics.naoRemediados);
  }
  if (els.publicKpiRemediadas) {
    els.publicKpiRemediadas.textContent = formatNumber(metrics.remediados);
  }
  if (els.publicKpiUnidades) {
    els.publicKpiUnidades.textContent = formatNumber(state.unidades.length);
  }
  if (els.publicKpiAptas) {
    els.publicKpiAptas.textContent = formatNumber(aptas);
  }
}

function renderManagementKPIs() {
  const metrics = getDashboardMetrics(state.filteredVistorias);

  if (els.kpiSemanasProjeto) {
    els.kpiSemanasProjeto.textContent = formatNumber(metrics.semanasProjeto);
  }
  if (els.kpiUnidades) {
    els.kpiUnidades.textContent = formatNumber(metrics.unidades);
  }
  if (els.kpiMunicipios) {
    els.kpiMunicipios.textContent = formatNumber(metrics.municipios);
  }
  if (els.kpiRealizadas) {
    els.kpiRealizadas.textContent = formatNumber(metrics.realizadas);
  }
  if (els.kpiNaoRealizadas) {
    els.kpiNaoRealizadas.textContent = formatNumber(metrics.naoRealizadas);
  }
  if (els.kpiNaoInformadas) {
    els.kpiNaoInformadas.textContent = formatNumber(metrics.naoInformadas);
  }
  if (els.kpiFocos) {
    els.kpiFocos.textContent = formatNumber(metrics.focosEncontrados);
  }
  if (els.kpiNaoRemediadas) {
    els.kpiNaoRemediadas.textContent = formatNumber(metrics.naoRemediados);
  }
}

function renderManagementCharts() {
  const items = state.filteredVistorias;
  const metrics = getDashboardMetrics(items);
  const total = metrics.total || 1;

  renderGaugeChart(els.gaugeRealizadas, {
    titleValue: formatPercent((metrics.realizadas / total) * 100),
    titleLabel: `${formatNumber(metrics.realizadas)} de ${formatNumber(metrics.total)}`,
    percent: (metrics.realizadas / total) * 100,
    color: "#16a34a",
    legend: [
      { label: "Realizadas", value: formatNumber(metrics.realizadas), dotClass: "chart-dot--green" },
      { label: "Total", value: formatNumber(metrics.total), dotClass: "chart-dot--blue" }
    ]
  });

  renderGaugeChart(els.gaugeNaoRealizadas, {
    titleValue: formatPercent((metrics.naoRealizadas / total) * 100),
    titleLabel: `${formatNumber(metrics.naoRealizadas)} de ${formatNumber(metrics.total)}`,
    percent: (metrics.naoRealizadas / total) * 100,
    color: "#dc2626",
    legend: [
      {
        label: "Não realizadas",
        value: formatNumber(metrics.naoRealizadas),
        dotClass: "chart-dot--red"
      },
      { label: "Total", value: formatNumber(metrics.total), dotClass: "chart-dot--blue" }
    ]
  });

  renderGaugeChart(els.gaugeNaoInformadas, {
    titleValue: formatPercent((metrics.naoInformadas / total) * 100),
    titleLabel: `${formatNumber(metrics.naoInformadas)} de ${formatNumber(metrics.total)}`,
    percent: (metrics.naoInformadas / total) * 100,
    color: "#64748b",
    legend: [
      {
        label: "Não informadas",
        value: formatNumber(metrics.naoInformadas),
        dotClass: "chart-dot--muted"
      },
      { label: "Total", value: formatNumber(metrics.total), dotClass: "chart-dot--blue" }
    ]
  });

  renderPieChart(els.pieFocos, {
    centerValue: formatNumber(metrics.focosEncontrados),
    centerLabel: "com foco",
    slices: [
      { value: metrics.focosEncontrados, color: "#dc2626" },
      { value: metrics.focosNaoEncontrados, color: "#16a34a" },
      { value: metrics.focosSemInfo, color: "#64748b" }
    ],
    legend: [
      {
        label: "Foco encontrado",
        value: formatNumber(metrics.focosEncontrados),
        dotClass: "chart-dot--red"
      },
      {
        label: "Sem foco",
        value: formatNumber(metrics.focosNaoEncontrados),
        dotClass: "chart-dot--green"
      },
      {
        label: "Sem informação",
        value: formatNumber(metrics.focosSemInfo),
        dotClass: "chart-dot--muted"
      }
    ]
  });

  renderPieChart(els.pieRemediacao, {
    centerValue: formatNumber(metrics.remediados),
    centerLabel: "remediados",
    slices: [
      { value: metrics.remediados, color: "#16a34a" },
      { value: metrics.naoRemediados, color: "#dc2626" },
      { value: metrics.remediacaoSemInfo, color: "#64748b" }
    ],
    legend: [
      {
        label: "Remediados",
        value: formatNumber(metrics.remediados),
        dotClass: "chart-dot--green"
      },
      {
        label: "Não remediados",
        value: formatNumber(metrics.naoRemediados),
        dotClass: "chart-dot--red"
      },
      {
        label: "Sem informação",
        value: formatNumber(metrics.remediacaoSemInfo),
        dotClass: "chart-dot--muted"
      }
    ]
  });

  const motivosNaoVistoriaMap = new Map();
  const motivosNaoRemediacaoMap = new Map();
  const locaisFocoMap = new Map();

  for (const item of items) {
    const motivosNaoVistoria = normalizeListField(item.motivosNaoVistoriaResumo).map(prettifyLabel);
    const motivosNaoRemediacao = normalizeListField(item.motivosNaoRemediacaoResumo).map(prettifyLabel);
    const locaisFoco = normalizeListField(item.locaisFocoResumo).map(prettifyLabel);

    for (const motivo of motivosNaoVistoria) {
      if (!motivo || motivo === "-") continue;
      motivosNaoVistoriaMap.set(motivo, (motivosNaoVistoriaMap.get(motivo) || 0) + 1);
    }

    for (const motivo of motivosNaoRemediacao) {
      if (!motivo || motivo === "-") continue;
      motivosNaoRemediacaoMap.set(motivo, (motivosNaoRemediacaoMap.get(motivo) || 0) + 1);
    }

    for (const local of locaisFoco) {
      if (!local || local === "-") continue;
      locaisFocoMap.set(local, (locaisFocoMap.get(local) || 0) + 1);
    }
  }

  renderBarList(
    els.barMotivosNaoVistoria,
    topEntries(motivosNaoVistoriaMap, 8),
    "bar-item__fill--red"
  );

  renderBarList(
    els.barMotivosNaoRemediacao,
    topEntries(motivosNaoRemediacaoMap, 8),
    "bar-item__fill--amber"
  );

  renderBarList(
    els.barLocaisFoco,
    topEntries(locaisFocoMap, 8),
    "bar-item__fill--green"
  );
}

function renderHistory() {
  const rows = [...state.filteredVistorias]
    .sort((a, b) => String(b.dataVistoria || "").localeCompare(String(a.dataVistoria || "")))
    .slice(0, 200);

  if (els.historyCount) {
    els.historyCount.textContent = `${formatNumber(state.filteredVistorias.length)} registros`;
  }

  if (!rows.length) {
    if (els.historyTableBody) {
      els.historyTableBody.innerHTML = `
        <tr>
          <td colspan="6">Nenhum registro encontrado para os filtros selecionados.</td>
        </tr>
      `;
    }
    return;
  }

  if (!els.historyTableBody) return;

  els.historyTableBody.innerHTML = rows
    .map((item) => {
      const vistoriaStatus = getStatusLabel(item.vistoriaRealizada);
      const focoStatus = getStatusLabel(item.focoEncontrado);
      const remedStatus = getStatusLabel(item.focoRemediado);

      const motivos = [
        ...normalizeListField(item.motivosNaoVistoriaResumo).map(prettifyLabel),
        ...normalizeListField(item.motivosNaoRemediacaoResumo).map(prettifyLabel)
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

function renderManagementLayer() {
  renderManagementKPIs();
  renderManagementCharts();
  renderHistory();
}

function checkCertificateEligibility() {
  const unidadeId = els.certUnidade?.value;
  const ano = Number(els.certAno?.value);
  const mes = Number(els.certMes?.value);

  if (!unidadeId || !ano || !mes) {
    state.currentCertificate = null;

    if (els.downloadCertificateBtn) {
      els.downloadCertificateBtn.disabled = true;
    }

    if (els.certificateStatus) {
      els.certificateStatus.className = "certificate-status";
      els.certificateStatus.textContent =
        "Selecione unidade, mês e ano para verificar a conformidade.";
    }

    return;
  }

  const unidade = state.unidades.find((item) => String(item.id) === String(unidadeId));
  const unidadeNome = unidade?.nome || "Unidade";

  const vistoriasDoMes = state.vistorias.filter((item) => {
    if (String(item.unidadeId) !== String(unidadeId)) return false;
    if (Number(item.ano) !== ano) return false;
    if (monthFromIso(item.dataVistoria) !== mes) return false;
    return normalizeStatus(item.vistoriaRealizada) === "sim";
  });

  const totalRealizadas = vistoriasDoMes.length;
  const eligible = totalRealizadas >= 4;

  state.currentCertificate = {
    unidadeId,
    unidadeNome,
    ano,
    mes,
    totalRealizadas,
    eligible
  };

  if (els.downloadCertificateBtn) {
    els.downloadCertificateBtn.disabled = !eligible;
  }

  if (!els.certificateStatus) return;

  if (eligible) {
    els.certificateStatus.innerHTML = buildCertificateHtml({
      unidadeNome,
      ano,
      mes,
      totalRealizadas
    });
  } else {
    els.certificateStatus.innerHTML = buildCertificateNotOkHtml({
      unidadeNome,
      ano,
      mes,
      totalRealizadas
    });
  }
}

function downloadCertificate() {
  if (!state.currentCertificate || !state.currentCertificate.eligible) return;

  const { unidadeNome, ano, mes, totalRealizadas } = state.currentCertificate;

  try {
    AedesCerts.openPrintableCertificate({
      unidadeNome,
      ano,
      mes,
      total: totalRealizadas
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

  if (els.overviewBaseText) {
    els.overviewBaseText.textContent =
      `${formatNumber(totalUnidades)} unidades e ${formatNumber(totalVistorias)} vistorias carregadas`;
  }

  refreshFilters();
  renderPublicLayer();
  renderManagementLayer();

  if (els.dbStatus) {
    els.dbStatus.textContent =
      `Base carregada com ${formatNumber(totalUnidades)} unidades e ${formatNumber(totalVistorias)} vistorias.`;
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
    if (els.filterUnidade) els.filterUnidade.value = "";
    if (els.filterAno) els.filterAno.value = "";
    if (els.filterStatus) els.filterStatus.value = "";
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

  els.checkCertificateBtn?.addEventListener("click", checkCertificateEligibility);
  els.downloadCertificateBtn?.addEventListener("click", downloadCertificate);
}
const folderModal = document.getElementById("folderModal");
const openFolderModalBtn = document.getElementById("openFolderModalBtn");
const openFolderModalBtn2 = document.getElementById("openFolderModalBtn2");
const closeFolderModalBtn = document.getElementById("closeFolderModalBtn");
const closeFolderModalBtn2 = document.getElementById("closeFolderModalBtn2");

function openFolderModal() {
  if (!folderModal) return;
  folderModal.classList.add("is-open");
  folderModal.setAttribute("aria-hidden", "false");
}

function closeFolderModal() {
  if (!folderModal) return;
  folderModal.classList.remove("is-open");
  folderModal.setAttribute("aria-hidden", "true");
}

openFolderModalBtn?.addEventListener("click", openFolderModal);
openFolderModalBtn2?.addEventListener("click", openFolderModal);
closeFolderModalBtn?.addEventListener("click", closeFolderModal);
closeFolderModalBtn2?.addEventListener("click", closeFolderModal);
bindEvents();
bootstrap();